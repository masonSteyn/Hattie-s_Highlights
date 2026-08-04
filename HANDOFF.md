# Handoff

Everything a new session needs to pick this up. Written to be pasted or pointed
at wholesale — read it before touching anything, because several of the
decisions here look arbitrary until you know what they cost to learn.

---

## 1. What this is

A portfolio and booking site for **Hattie's Highlights**, a portrait/event
photographer. Two jobs: make her work look expensive, and get people to book.

It is **live and working**:

| | |
|---|---|
| Site | https://hatties-highlights.vercel.app |
| Editor | https://hatties-highlights.vercel.app/settings |
| Repo | https://github.com/masonSteyn/Hattie-s_Highlights (public) |
| Local | `/Users/masonsteyn/Desktop/ClaudeCode/hatties-highlights` |
| Owner | Mason (developer). **Hattie** is the non-technical client who edits it. |

Editor password is in `.env.local` as a hash, and in plain text at
`/tmp/hattie-password.txt` on Mason's machine. It cannot be recovered from the
hash — reissue with `node scripts/set-password.mjs "new password"`.

---

## 2. Stack, and why

**Next.js 16 (App Router), React 19.2.8, TypeScript, plain CSS. Six runtime
dependencies.** Deployed to Vercel.

**There is no CMS and no object storage.** Content lives in `content/site.json`
and photos in `public/photos/`, both committed to the repo. The editor publishes
by committing to GitHub, which makes Vercel rebuild.

This was arrived at, not chosen first. The build originally used Sanity — fully
implemented, schemas and all — and it was ripped out because the client did not
want another third-party account. **Do not suggest reintroducing a CMS without
asking.** The trade is understood and deliberate:

- No monthly bill, no service to go down, no account for Hattie.
- Every change is a commit, so any edit can be reverted.
- Publishing is **not instant** — about 60–90 seconds for the rebuild.

---

## 3. Layout

```
content/site.json      ALL editable content — the entire "CMS"
public/photos/         every photograph, served straight from the repo

src/app/(site)/        public site       — its own root layout
src/app/(editor)/      editor at /settings — its own root layout, no site chrome

src/lib/content.ts     the ONLY module that reads content
src/lib/github.ts      the ONLY module that writes it (server-only)
src/lib/auth.ts        session signing    │ split so the set-password CLI
src/lib/password.ts    scrypt hashing     │ can import the hashing half
src/lib/image-metadata.ts  format sniffing, EXIF stripping, upload limits
src/lib/rate-limit.ts  three buckets: request / send / login
src/lib/scheduling.ts  host allowlist for the booking iframe

scripts/set-password.mjs   generates EDITOR_PASSWORD_HASH + SESSION_SECRET
scripts/build-content.mjs  rebuilds site.json from public/photos
scripts/check-providers.mjs  asserts the scheduling allowlist has not drifted
```

Routes: `/`, `/portfolio`, `/portfolio/[category]` (4 static category pages),
`/about`, `/booking`, `/contact`, `/settings`.

---

## 4. How publishing works

Hattie edits at `/settings`. **Nothing is written as she types.** Changes are
held in a draft in her browser (localStorage), and a bar pinned to the bottom
says whether anything is unpublished. On **Publish changes**:

1. The draft is posted to a server action.
2. Photos were **already uploaded individually** when she picked them — each one
   validated, metadata-stripped, and stored as a git blob.
3. The publish request carries only the content JSON plus blob shas.
4. Photos + `content/site.json` land as **one commit** via GitHub's Git Data API.
5. Vercel rebuilds.

**This one-photo-at-a-time design is not optional.** See §7.

---

## 5. Environment variables

All in `.env.local` locally and Vercel → Settings → Environment Variables.
Nothing prefixed `NEXT_PUBLIC_` except the site URL; verified absent from every
client chunk.

| Name | Purpose |
|---|---|
| `GITHUB_TOKEN` | Fine-grained, this repo only, **Contents: read and write** |
| `GITHUB_REPO` | `masonSteyn/Hattie-s_Highlights` |
| `GITHUB_BRANCH` | `main` |
| `EDITOR_PASSWORD_HASH` | From `scripts/set-password.mjs` |
| `EDITOR_SESSION_SECRET` | 32+ chars. Changing it signs everyone out |
| `RESEND_API_KEY` | **NOT SET** — contact form cannot deliver |
| `CONTACT_FROM_EMAIL` | **NOT SET** |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | **NOT SET** — see §8 |
| `NEXT_PUBLIC_SITE_URL` | Public |

**Env var changes never affect an existing deployment.** Always redeploy after
changing one.

---

## 6. Access available to the assistant

Already authenticated on Mason's machine:

- **`gh`** — logged in as `masonSteyn`. Can push, read the repo, inspect commits.
- **`vercel`** — logged in as `masonvsteyn-8443`. Can deploy, read env var
  names, check builds. Project is linked.
- **Headless Chrome** at `/Applications/Google Chrome.app/...` with
  `puppeteer-core` in the scratchpad — this is how everything gets verified.

Not available: Sanity (removed), Resend, Upstash.

---

## 7. Things learned the hard way

Each of these cost real time. They are not hypothetical.

**Server Actions cap the request body at 1MB** (Vercel's platform at 4.5MB). A
camera export is ~19MB base64-encoded. Batching photos into the publish call
failed *before reaching application code*, surfacing only as "a server error
occurred". Hence one upload per request. **Do not batch image bytes into a
server action.**

**Never put `$` in a value destined for `.env`.** dotenv expands `$name`, so a
`$`-delimited password hash arrives silently mangled — the app boots fine and
rejects every password. The hash format is colon-separated for this reason.

**`npm install <pkg>` rewrote `package.json` from scratch twice**, dropping every
other dependency and the security overrides. Back it up before adding packages
and diff afterwards. Prefer editing `package.json` directly then `npm install`.

**The `overrides` block clears 18 advisories** in transitive dependencies.
`npm audit` is currently **0 vulnerabilities** and should stay there. Re-check
after every install — adding one package has re-opened them before.

**`next.config.ts` cannot import from `src/`.** Next compiles it and requires the
output, where relative `.ts` and `.json` imports do not resolve. The scheduling
allowlist is therefore duplicated into it, guarded by `npm run check:providers`.

**The editor's draft is versioned** (`hh.draft.v2`). When the shape changed, an
old draft threw during render and — because it reloaded every visit — made the
editor permanently unopenable with no UI escape. Any shape change must bump the
key. `isDraft()` validates before use.

**Vercel deploy lag.** Pushes land within ~20s normally, but two commits seconds
apart can look dropped. Check before concluding it failed.

**macOS TCC blocks the preview launcher from `~/Desktop`.** `preview_start` with
a `launch.json` name fails with `EPERM: uv_cwd`. Run the dev server via Bash and
attach with `preview_start({url})` instead.

**Headless Chrome does not perform Cmd+A or triple-click selection.** Typing
after either appends rather than replaces. This looks exactly like a broken
input and is not. Use `setSelectionRange` to make a real selection. *A false bug
was fixed and reverted on the back of this — measure before concluding.*

---

## 8. State of play

### Done and verified

- All six public pages; masonry galleries at native aspect ratios
- Lightbox: arrow keys, wrapping, swipe, focus trap, focus restore
- Contact form: zod validation, honeypot, two rate-limit buckets, real
  success/error states
- Editor: password login, five tabs (Photos, Home, About, Banner, Your details),
  drafts that survive a reload, single-commit publishing
- **EXIF/GPS stripped losslessly** — container surgery, not re-encoding; pixels
  verified bit-identical, ICC profile preserved
- Security: per-surface CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy,
  scheduling-host allowlist, 0 npm vulnerabilities
- Accessibility: no horizontal overflow at 375px, one `h1` per page, alt on every
  image, skip link first, 44px targets, visible focus, reduced-motion respected
- Performance with 120 photos: **LCP 140ms desktop / 964ms mobile (4× CPU,
  Fast 3G), CLS 0**
- Favicon: SVG + 180px Apple icon + hand-built 3-resolution `.ico`

### Not done

1. **SEO** — no JSON-LD, sitemap.xml, robots.txt, or Open Graph tags. Page
   titles are generic. **`settings.business.city` exists in the store and in the
   editor but nothing reads it** — wiring it into titles and `LocalBusiness`
   schema is the main prize here.
2. **Analytics** — Plausible is allowed in the CSP but no script is added.
3. **Resend** — contact form fails loudly in production by design until
   configured. Enquiries currently cannot be delivered.
4. **Upstash** — without it rate limiting falls back to an in-process counter
   that does not hold across Vercel's instances, so **the login throttle is
   effectively bypassable in production.** Highest-value remaining fix.
5. **Placeholder content** — About paragraphs still start "TODO: Hattie to
   replace" (deliberately visible). Facebook link and Calendly URL are still
   bare site roots, which is why the Booking iframe is blank. City/region/service
   area are empty for Hattie to fill in.

---

## 9. Design rules — the client will reject violations

Palette is exactly five colours plus ink. **No additions.**

```
cream  #FFF7E6   base, nearly every surface
blush  #F7C8D3   primary accent — buttons, active states, underlines
sage   #A8B58A   secondary — dividers, tags, hover
mist   #C1CFDC   tertiary — subtle section shifts, form focus
coral  #F3ABA7   rare emphasis only — booking CTA
ink    #2B2724   text. NEVER pure #000
```

One derived value exists: `--sage-deep #6E7C52`, for focus rings only. Plain
sage on cream is **2.04:1** and fails both AA and the 3:1 non-text minimum.
Muted text is ink at lower opacity, never a picked grey.

**Type:** Instrument Serif (display) + Inter (UI/body) + Petit Formal Script
(wordmark, one accent word per page title, at most one pull-quote). The script
is unreadable below ~28px and exhausting past six words — this is enforced in
validation, not left to judgement.

**Radius philosophy: square.** Photos are never rounded. 2px only on controls.

**Explicitly forbidden by the brief:** purple/indigo gradients, gradients
anywhere except a photo overlay, glassmorphism, emoji as icons, uniform drop
shadows, three-column icon+heading+filler grids, fade-in-on-scroll everywhere,
centred body text, evenly-spaced sections. Copy must never say "elevate",
"seamless", "curated", "journey", "capture moments that last a lifetime", or
"let's tell your story".

---

## 10. Verifying anything

**Assert nothing you have not measured.** The pattern used throughout:

```bash
npm run dev            # then drive it with headless Chrome
npx tsc --noEmit
npx eslint .
npm run build
npm audit              # must stay at 0
npm run check:providers
```

Client bundles must never contain secrets:

```bash
grep -rlE 'GITHUB_TOKEN|EDITOR_PASSWORD_HASH|EDITOR_SESSION_SECRET|scrypt:' .next/static/
```

Load-test the portfolio at a realistic size:

```bash
MOCK_PHOTOS=120 npm run build && MOCK_PHOTOS=120 npm start
```

Deploy and check:

```bash
vercel deploy --prod --yes
```

---

## 11. Working style the client expects

Staged, with check-ins. Show visual proof rather than describing it. State what
was actually verified versus what is assumed — several times in this build a
confident claim turned out to be wrong on inspection, and saying so plainly was
better than quietly correcting it. Flag placeholder or invented data loudly;
never leave made-up business details in the content store.
