# Hattie's Highlights

Portfolio and booking site for a portrait and event photographer.

Next.js 16 (App Router) · Sanity for content and media · Resend for mail ·
deployed to Vercel.

For the client-facing guide, see **[HATTIE-GUIDE.md](./HATTIE-GUIDE.md)**.

---

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**It runs with no configuration at all.** With no Sanity project set, the site
serves bundled fixture content from `src/lib/fixtures/` and sample photos from
`public/mock/`, so the whole thing can be built and reviewed before any accounts
exist. `/studio` shows setup instructions instead of erroring.

---

## Connecting the CMS

This is the only setup step that genuinely needs a human — creating the project
requires signing in to Sanity.

**1. Create the project**

```bash
npx sanity@latest init
```

Choose *Use the default dataset configuration* and note the project id it prints.

**2. Point the site at it**

```bash
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SANITY_PROJECT_ID` to that id.

**3. Import the starter content**

Create an **Editor** token at [sanity.io/manage](https://sanity.io/manage) →
your project → API → Tokens, and put it in `.env.local` as
`SANITY_API_WRITE_TOKEN`. Then:

```bash
npm run seed:dry
```

```bash
npm run seed
```

This uploads all 19 photos and creates every page, category, and session type,
so the Studio opens on the real site rather than on empty forms. It uses
`createOrReplace`, so re-running it converges rather than duplicating.

Keep the write token: unlike a pure-Studio setup, the editor at `/settings`
uses it to save Hattie's changes server-side. It is the one credential here that
can destroy data, so it belongs only in `.env.local` and in Vercel's environment
variables — never in the repo and never prefixed `NEXT_PUBLIC_`.

**4. Add the editor credentials**

The site has its own editor at `/settings`, so Hattie never needs a Sanity
account. Generate the two secrets:

```bash
node scripts/set-password.mjs "a long password"
```

Paste both lines into `.env.local`. Unlike the seed token, `SANITY_API_WRITE_TOKEN`
**stays** — the editor writes through it server-side.

Then give Hattie the password. That is the whole handover.

---

## Environment variables

Everything is documented in `.env.example`. In short:

| Variable | Needed | Notes |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | for the CMS | Public by design — identifies a dataset, grants nothing |
| `NEXT_PUBLIC_SANITY_DATASET` | for the CMS | `production` |
| `SANITY_API_WRITE_TOKEN` | seeding + editor | Server-only. The editor writes through this |
| `EDITOR_PASSWORD_HASH` | for the editor | From `scripts/set-password.mjs`. Colon-separated, never `$` |
| `EDITOR_SESSION_SECRET` | for the editor | 32+ chars. Changing it signs everyone out |
| `RESEND_API_KEY` | for the contact form | Server-only |
| `CONTACT_FROM_EMAIL` | for the contact form | Must be on a domain verified in Resend |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recommended | Rate limiting; see below |
| `NEXT_PUBLIC_SITE_URL` | production | Absolute origin, no trailing slash |

Anything not prefixed `NEXT_PUBLIC_` is server-only and never reaches the
browser — verified by grepping the built client chunks for each name.

The write token *is* used by the running site, but only inside
`src/sanity/write.ts`, which carries the `server-only` guard and is imported
exclusively by server actions that check the session first. It never reaches a
client bundle. The Studio at `/studio` is separate and authenticates each editor
against Sanity directly.

Two behaviours worth knowing:

- **Without Resend configured, the contact form fails loudly in production** and
  succeeds with a developer note in development. It will not silently drop an
  enquiry.
- **Without Upstash, rate limiting falls back to an in-process counter.** That
  does not hold across the many short-lived instances Vercel runs, so the limit
  is effectively bypassable. Fine locally, worth fixing before launch.

---

## Deploying to Vercel

1. Push to GitHub.
2. Vercel → **Add New → Project** → import the repo. The framework is detected;
   no build settings to change.
3. Add every variable from the table above under **Settings → Environment
   Variables** (Production *and* Preview). `SANITY_API_WRITE_TOKEN`,
   `EDITOR_PASSWORD_HASH`, and `EDITOR_SESSION_SECRET` are all required — the
   editor cannot save without the first and will not let anyone in without the
   other two.
4. Deploy.
5. **Settings → Domains** → add `hattieshighlights.com` and follow the DNS
   records it gives you.
6. In [sanity.io/manage](https://sanity.io/manage) → API → **CORS origins**, add
   `https://hattieshighlights.com` with credentials allowed. Without this the
   Studio loads on the live domain but cannot talk to Sanity.
7. Set `NEXT_PUBLIC_SITE_URL` to the real domain and redeploy.

---

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm run seed
```

```bash
npm run check:providers
```

Also available: `npm start` (serve the production build), `npm run seed:dry`
(preview the seed without writing), and `npm run fixtures` (regenerate fixture
metadata from `public/mock`).

To load-test the portfolio at a realistic library size:

```bash
MOCK_PHOTOS=120 npm run build && MOCK_PHOTOS=120 npm start
```

Fixture-only; it has no effect once Sanity supplies the photos.

---

## How it fits together

```
src/app/(site)/      the public site        — its own root layout
src/app/(editor)/    Hattie's editor        — password login at /settings
src/app/(studio)/    the full Sanity Studio — for you, not for her
src/lib/auth.ts      session signing        │ the login, split so the CLI
src/lib/password.ts  scrypt hashing         │ script can use the hashing
src/sanity/write.ts  the ONLY module that can change content
src/lib/content.ts   the ONLY module that knows where content comes from
src/lib/fixtures/    fallback content, deletable once Sanity is populated
```

### Two doors, on purpose

- **`/settings`** — password, four tabs, photos and headline text. This is what
  Hattie uses and all she ever needs.
- **`/studio`** — the full Sanity Studio, for prices, categories, SEO, and
  anything structural. Needs a Sanity account, so it is yours rather than hers.

Both write to the same dataset. The ⚙ in the site's sidebar points at
`/settings`.

`content.ts` asks Sanity and falls back to the fixtures per query, so a document
that has not been created yet shows sample content rather than a blank page.
Components never know which source answered.

### Notes for whoever works on this next

- **`next.config.ts` cannot import from `src/`.** Next compiles it and requires
  the output, where relative `.ts` and `.json` imports do not resolve. The
  scheduling allowlist is therefore duplicated into it, with
  `npm run check:providers` failing if the copies drift.
- **Images can only enter through one door.** `form.image.directUploads` is off
  in `sanity.config.ts`, so Sanity's own drag-and-drop is disabled and the
  custom asset source in `sanity/components/CleanUploadSource.tsx` is the sole
  entry point. That is what makes magic-byte validation and EXIF stripping a
  guarantee rather than a suggestion. Do not re-enable it.
- **The CSP is split** three ways: `/studio`, `/settings`, and everything else.
  The public policy has no `unsafe-eval`. The
  `/:path((?!studio|settings).*)` lookahead matters — without it the catch-all
  also matches those two and, being declared last, wins.
- **`npm install <pkg>` has rewritten `package.json` from scratch here**,
  dropping every other dependency and the security overrides. Back it up before
  adding packages and check the diff afterwards.
- The `overrides` block exists to clear advisories in transitive dependencies.
  Re-check with `npm audit` before removing any of it, and re-check *after* every
  `npm install` — adding one package has twice re-opened advisories that
  overrides had already closed.
- **Never use `$` in a value destined for `.env`.** dotenv expands `$name`, so a
  `$`-delimited password hash arrives at the server silently mangled: the app
  boots fine and simply rejects every password. That is why the hash format is
  colon-separated.
- The editor's login has no reset flow by design. To change the password, re-run
  `scripts/set-password.mjs` and redeploy; to revoke every session immediately,
  change `EDITOR_SESSION_SECRET`.
