# Hattie's Highlights

Portfolio and booking site for a portrait and event photographer.

Next.js 16 (App Router) · content and photos committed to this repo ·
Resend for mail · deployed to Vercel.

No CMS, no object storage, no monthly bill. The editor publishes by committing
to this repository, which makes Vercel rebuild.

For the client-facing guide, see **[HATTIE-GUIDE.md](./HATTIE-GUIDE.md)**.
Picking this up cold? Start with **[HANDOFF.md](./HANDOFF.md)** — it covers the
architecture, what is done, what is not, and the traps that cost real time.

---

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

**It runs with no configuration at all.** Content comes from
`content/site.json` and photos from `public/photos/`, both committed to this
repo, so the site works offline and before any account exists. `/settings`
explains what to set rather than erroring.

---

## Setting up the editor

Two things, both one-time.

**1. A password for Hattie**

```bash
node scripts/set-password.mjs "a long password"
```

Paste both printed lines into `.env.local`. The password itself is never stored
— only a scrypt hash of it — so it cannot be recovered, only replaced.

**2. A GitHub token so the editor can publish**

github.com/settings/personal-access-tokens → **Fine-grained token**, scoped to
**this repository only**, with **Contents: Read and write**. Nothing else.

Add to `.env.local`:

```bash
GITHUB_TOKEN=github_pat_...
```

Also set `GITHUB_REPO=your-username/hatties-highlights`.

That is the whole setup. There is no CMS account, no storage service, and
nothing for Hattie to sign up for.

---

## How publishing works

Hattie edits at `/settings`. Nothing is written as she types — changes are held
in her browser, backed up to localStorage so a closed tab does not lose an
afternoon. When she taps **Publish changes**:

1. The whole draft is posted to a server action.
2. Every new photo is re-validated and metadata-stripped **on the server**, so
   it does not matter what the browser sent.
3. Dimensions and a blur placeholder are derived with `sharp`.
4. Photos and `content/site.json` go up as **one commit** via GitHub's Git Data
   API — all of it lands or none of it does.
5. Vercel sees the push and rebuilds. Live in a minute or two.

The trade this makes: publishing is not instant. In exchange there is no
service to pay for or go down, and every change is a commit that can be
reverted.

Regenerate the store from the files on disk at any time:

```bash
npm run content
```

---

## Environment variables

Everything is documented in `.env.example`. In short:

| Variable | Needed | Notes |
|---|---|---|
| `GITHUB_TOKEN` | for publishing | Fine-grained, this repo only, Contents: read and write |
| `GITHUB_REPO` | for publishing | `owner/repository` |
| `GITHUB_BRANCH` | optional | Defaults to `main` |
| `EDITOR_PASSWORD_HASH` | for the editor | From `scripts/set-password.mjs`. Colon-separated, never `$` |
| `EDITOR_SESSION_SECRET` | for the editor | 32+ chars. Changing it signs everyone out |
| `RESEND_API_KEY` | for the contact form | Server-only |
| `CONTACT_FROM_EMAIL` | for the contact form | Must be on a domain verified in Resend |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recommended | Rate limiting; see below |
| `NEXT_PUBLIC_SITE_URL` | production | Absolute origin, no trailing slash |

Anything not prefixed `NEXT_PUBLIC_` is server-only and never reaches the
browser — verified by grepping the built client chunks for each name.

The GitHub token is used by the running site, but only inside
`src/lib/github.ts`, which carries the `server-only` guard and is imported
exclusively by the publish action after it has checked the session. It never
reaches a client bundle — verified by grepping the built chunks.

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
   Variables** (Production *and* Preview). `GITHUB_TOKEN`, `GITHUB_REPO`,
   `EDITOR_PASSWORD_HASH`, and `EDITOR_SESSION_SECRET` are all required — the
   editor cannot publish without the first two and will not let anyone in
   without the other two.
4. Deploy.
5. **Settings → Domains** → add `hattieshighlights.com` and follow the DNS
   records it gives you.
6. Set `NEXT_PUBLIC_SITE_URL` to the real domain and redeploy.

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

Development only — it cycles the real library up to the requested count.

---

## How it fits together

```
content/site.json    all editable content — the whole "CMS"
public/photos/       every photograph, served straight from the repo

src/app/(site)/      the public site  — its own root layout
src/app/(editor)/    the editor       — password login at /settings
src/lib/content.ts   the ONLY module that reads content
src/lib/github.ts    the ONLY module that writes it
src/lib/auth.ts      session signing  │ split so the set-password CLI
src/lib/password.ts  scrypt hashing   │ script can import the hashing
```

`content/site.json` is imported at build time, so rendering a page costs a
memory read. There is nothing to be slow, rate-limited, or down.

### Notes for whoever works on this next

- **`next.config.ts` cannot import from `src/`.** Next compiles it and requires
  the output, where relative `.ts` and `.json` imports do not resolve. The
  scheduling allowlist is therefore duplicated into it, with
  `npm run check:providers` failing if the copies drift.
- **Images are validated and stripped on the server**, in the publish action,
  not in the browser. The browser copy exists only for instant feedback. Keep it
  that way: the server copy is the one that is a guarantee.
- **The CSP is split** between `/settings` and everything else. The
  `/:path((?!settings).*)` lookahead matters — without it the catch-all also
  matches the editor and, being declared last, wins, losing its noindex and
  no-store headers.
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
