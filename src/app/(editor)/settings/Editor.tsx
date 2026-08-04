"use client";

import Image from "next/image";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";

import type { SiteContent } from "@/lib/content";

import { publish, signOut, stagePhoto, type Result } from "./actions";

const idle: Result = { ok: true };

/** Where an unpublished draft is kept between page loads. */
const DRAFT_KEY = "hh.draft.v1";

/** A photo already uploaded to GitHub, waiting to be committed. */
type BlobRef = { path: string; sha: string };

/** What a freshly uploaded photo looks like to the panels. `preview` is a small
 *  thumbnail shown until the real file is live at `src`. */
type StagedInfo = { src: string; width: number; height: number; lqip: string; preview: string };

/* ── Draft state ─────────────────────────────────────────────────────────── */

type Draft = { content: SiteContent; blobs: BlobRef[] };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Everything is edited locally and published in one go.
 *
 * The alternative — saving each field as it changes — would mean a git commit
 * and a site rebuild per keystroke. Holding a draft means Hattie can change ten
 * things, look at them together, and publish once. It also gives her a way out:
 * nothing is committed until she says so, and Discard puts it all back.
 */
function useDraft(published: SiteContent) {
  const [draft, setDraft] = useState<Draft>(() => ({ content: clone(published), blobs: [] }));
  const [loaded, setLoaded] = useState(false);

  // Restore an unfinished draft — a closed tab should not cost an afternoon's
  // work.
  //
  // This must run after mount rather than in the state initialiser: localStorage
  // does not exist during server rendering, so reading it eagerly would make the
  // server and client disagree about what to render. Reading an external store
  // on mount is the documented exception to the set-state-in-effect rule.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, an external store unavailable during SSR
      if (saved) setDraft(JSON.parse(saved) as Draft);
    } catch {
      /* Corrupt or full storage: fall back to the published content. */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Only small preview thumbnails are kept, so this is unlikely — but a
      // full storage quota must not take the in-memory draft down with it.
    }
  }, [draft, loaded]);

  const update = useCallback((fn: (d: Draft) => void) => {
    setDraft((current) => {
      const next = clone(current);
      fn(next);
      return next;
    });
  }, []);

  const discard = useCallback(() => {
    window.localStorage.removeItem(DRAFT_KEY);
    setDraft({ content: clone(published), blobs: [] });
  }, [published]);

  const dirty = useMemo(
    () =>
      draft.blobs.length > 0 ||
      JSON.stringify(draft.content) !== JSON.stringify(published),
    [draft, published],
  );

  return { draft, update, discard, dirty, loaded };
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <>
      <label className="edLabel">{label}</label>
      {hint ? <p className="edNote">{hint}</p> : null}
      {children}
    </>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="edSection">
      <h2 className="edSectionTitle display">{title}</h2>
      {intro ? <p className="edIntro">{intro}</p> : null}
      {children}
    </section>
  );
}

/* ── Panels ──────────────────────────────────────────────────────────────── */

function BannerPanel({ draft, update }: { draft: Draft; update: (fn: (d: Draft) => void) => void }) {
  const banner = draft.content.settings.availability;
  return (
    <Section
      title="The strip across the top"
      intro="The quickest way to tell people whether you are taking bookings. Leave it off when it is not true — an out-of-date one is worse than none."
    >
      <div className="edForm">
        <label className="edToggle">
          <input
            type="checkbox"
            checked={banner.enabled}
            onChange={(e) => update((d) => { d.content.settings.availability.enabled = e.target.checked; })}
          />
          <span>Show it on every page</span>
        </label>

        <Field label="What it says">
          <input
            className="edInput"
            value={banner.text}
            maxLength={90}
            placeholder="Booking fall 2026 — 3 dates left"
            onChange={(e) => update((d) => { d.content.settings.availability.text = e.target.value; })}
          />
        </Field>
      </div>
    </Section>
  );
}

function ImageSwap({
  label,
  current,
  onPick,
  onAlt,
}: {
  label: string;
  current: { src: string; width: number; height: number; lqip: string; alt: string; preview?: string };
  onPick: (file: File) => void;
  onAlt: (alt: string) => void;
}) {
  const isStaged = Boolean(current.preview);
  return (
    <div className="edForm edSwap">
      <div className="edSwapPreview">
        {isStaged ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: thumbnail, not a file next/image can optimise
          <img src={current.preview} alt={current.alt} />
        ) : (
          <Image
            src={current.src}
            alt={current.alt}
            width={current.width}
            height={current.height}
            placeholder="blur"
            blurDataURL={current.lqip}
            sizes="320px"
          />
        )}
        {isStaged ? <p className="edStaged">Not published yet</p> : null}
      </div>

      <div className="edSwapFields">
        <Field label={label}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="edFile"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
          />
        </Field>
        <Field label="Describe it">
          <input className="edInput" value={current.alt} onChange={(e) => onAlt(e.target.value)} maxLength={200} />
        </Field>
      </div>
    </div>
  );
}

function HomePanel({
  draft,
  update,
  stage,
}: {
  draft: Draft;
  update: (fn: (d: Draft) => void) => void;
  stage: (file: File, assign: (d: Draft, staged: StagedInfo) => void) => void;
}) {
  const home = draft.content.home;
  return (
    <Section title="Home page">
      <ImageSwap
        label="The big photo at the top"
        current={home.hero}
        onPick={(file) =>
          void stage(file, (d, staged) => {
            d.content.home.hero = { ...d.content.home.hero, ...staged };
          })
        }
        onAlt={(alt) => update((d) => { d.content.home.hero.alt = alt; })}
      />

      <div className="edForm">
        <p className="edNote">
          The headline is in three parts because one word is set in the handwriting font. Keep that
          word to one — it is beautiful and very hard to read in long runs.
        </p>
        <div className="edRow">
          <div>
            <Field label="First part">
              <input className="edInput" value={home.headlineBefore} maxLength={60}
                onChange={(e) => update((d) => { d.content.home.headlineBefore = e.target.value; })} />
            </Field>
          </div>
          <div>
            <Field label="Handwritten word">
              <input className="edInput edScript" value={home.headlineScript} maxLength={18}
                onChange={(e) => update((d) => { d.content.home.headlineScript = e.target.value; })} />
            </Field>
          </div>
          <div>
            <Field label="Last part (optional)">
              <input className="edInput" value={home.headlineAfter} maxLength={60}
                onChange={(e) => update((d) => { d.content.home.headlineAfter = e.target.value; })} />
            </Field>
          </div>
        </div>

        <Field label="The line under the photo">
          <textarea className="edInput edTextarea" rows={3} value={home.intro} maxLength={280}
            onChange={(e) => update((d) => { d.content.home.intro = e.target.value; })} />
        </Field>
        <Field label="Heading at the bottom">
          <input className="edInput" value={home.closingHeading} maxLength={80}
            onChange={(e) => update((d) => { d.content.home.closingHeading = e.target.value; })} />
        </Field>
        <Field label="Text at the bottom">
          <textarea className="edInput edTextarea" rows={2} value={home.closingBody} maxLength={280}
            onChange={(e) => update((d) => { d.content.home.closingBody = e.target.value; })} />
        </Field>
      </div>
    </Section>
  );
}

function AboutPanel({
  draft,
  update,
  stage,
}: {
  draft: Draft;
  update: (fn: (d: Draft) => void) => void;
  stage: (file: File, assign: (d: Draft, staged: StagedInfo) => void) => void;
}) {
  const about = draft.content.about;
  return (
    <Section title="About page">
      <ImageSwap
        label="Your photo"
        current={about.portrait}
        onPick={(file) =>
          void stage(file, (d, staged) => {
            d.content.about.portrait = { ...d.content.about.portrait, ...staged };
          })
        }
        onAlt={(alt) => update((d) => { d.content.about.portrait.alt = alt; })}
      />

      <div className="edForm">
        <Field label="Heading">
          <input className="edInput" value={about.heading} maxLength={60}
            onChange={(e) => update((d) => { d.content.about.heading = e.target.value; })} />
        </Field>
        <Field label="About you" hint="Leave a blank line between paragraphs.">
          <textarea className="edInput edTextarea" rows={14} value={about.body.join("\n\n")}
            onChange={(e) =>
              update((d) => {
                d.content.about.body = e.target.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
              })
            } />
        </Field>
        <Field label="The one handwritten line">
          <input className="edInput edScript" value={about.pullQuote} maxLength={60}
            onChange={(e) => update((d) => { d.content.about.pullQuote = e.target.value; })} />
        </Field>
      </div>
    </Section>
  );
}

function PhotosPanel({
  draft,
  update,
  stage,
  errors,
  uploading,
}: {
  draft: Draft;
  update: (fn: (d: Draft) => void) => void;
  stage: (file: File, assign: (d: Draft, staged: StagedInfo) => void) => void;
  errors: string[];
  uploading: number;
}) {
  const { photos, categories } = draft.content;
  const [category, setCategory] = useState(categories[0]?.slug ?? "portraits");
  const featured = photos.filter((p) => p.featured).length;

  const move = (index: number, delta: number) =>
    update((d) => {
      const target = index + delta;
      if (target < 0 || target >= d.content.photos.length) return;
      const [moved] = d.content.photos.splice(index, 1);
      d.content.photos.splice(target, 0, moved);
    });

  return (
    <Section
      title="Photos"
      intro={`${photos.length} on the site, ${featured} showing on the home page. The order here is the order they appear.`}
    >
      <div className="edForm edUpload">
        <Field
          label="Add photos"
          hint="Drag them straight off the camera — no need to resize. Where the photo was taken is removed automatically."
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="edFile"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              for (const file of files) {
                void stage(file, (d, staged) => {
                  d.content.photos.push({
                    _id: staged.src,
                    image: { ...staged, alt: "" },
                    categories: [category],
                    featured: false,
                    order: d.content.photos.length,
                  });
                });
              }
              e.target.value = "";
            }}
          />
        </Field>

        <Field label="Put them in">
          <select className="edInput" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c._id} value={c.slug}>{c.title}</option>
            ))}
          </select>
        </Field>

        {uploading > 0 ? (
          <p className="edUploading" role="status">
            Uploading {uploading} photo{uploading === 1 ? "" : "s"}…
          </p>
        ) : null}

        {errors.length > 0 ? (
          <div className="edErrorList">
            {errors.map((e) => <p key={e} className="edError">{e}</p>)}
          </div>
        ) : null}
      </div>

      <ul className="edPhotoList">
        {photos.map((photo, index) => {
          const staged = Boolean(photo.image.preview);
          return (
            <li key={photo._id} className="edPhoto">
              <div className="edPhotoThumb">
                {staged ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a data: thumbnail, not a file next/image can optimise
                  <img src={photo.image.preview} alt={photo.image.alt || "New photo"} />
                ) : (
                  <Image src={photo.image.src} alt={photo.image.alt} width={photo.image.width}
                    height={photo.image.height} placeholder="blur" blurDataURL={photo.image.lqip} sizes="160px" />
                )}
                {staged ? <p className="edStaged">New</p> : null}
              </div>

              <div className="edPhotoBody">
                <input
                  className="edInput edInputSmall"
                  value={photo.image.alt}
                  placeholder="Describe this photo — screen readers and Google both use it"
                  onChange={(e) => update((d) => { d.content.photos[index].image.alt = e.target.value; })}
                />

                <div className="edPhotoControls">
                  <button
                    type="button"
                    className={photo.featured ? "edStar edStarOn" : "edStar"}
                    aria-pressed={photo.featured}
                    onClick={() => update((d) => { d.content.photos[index].featured = !d.content.photos[index].featured; })}
                  >
                    {photo.featured ? "★ On home page" : "☆ Add to home page"}
                  </button>

                  <div className="edMove">
                    <button type="button" className="edButtonSmall" aria-label="Move earlier"
                      disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                    <button type="button" className="edButtonSmall" aria-label="Move later"
                      disabled={index === photos.length - 1} onClick={() => move(index, 1)}>↓</button>
                  </div>

                  <button
                    type="button"
                    className="edButtonSmall edLink"
                    onClick={() =>
                      update((d) => {
                        const removed = d.content.photos.splice(index, 1)[0];
                        // Drop the upload too, so removing a just-added photo
                        // does not commit an orphan file.
                        d.blobs = d.blobs.filter((b) => b.path !== `public${removed.image.src}`);
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────────── */

const TABS = ["Photos", "Home page", "About page", "Banner"] as const;
type Tab = (typeof TABS)[number];

export function Editor({
  published,
  publishReady,
  publishReason,
  publishEnv,
}: {
  published: SiteContent;
  publishReady: boolean;
  publishReason: string | null;
  publishEnv: { name: string; present: boolean; note?: string }[];
}) {
  const [tab, setTab] = useState<Tab>("Photos");
  const { draft, update, discard, dirty, loaded } = useDraft(published);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [state, formAction, pending] = useActionState(publish, idle);

  // Once a publish succeeds the draft is the published state, so clear it.
  useEffect(() => {
    if (state.ok && state.message) {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [state]);

  /**
   * Uploads one photo and records a reference to it.
   *
   * The file goes straight to the server, which validates it, strips its
   * metadata, and stores it as a git blob — nothing is committed until Publish.
   * Only a reference and a small preview come back, which is what keeps the
   * publish request small enough to succeed and the draft small enough to
   * survive in localStorage.
   */
  const stage = useCallback(
    async (file: File, assign: (d: Draft, staged: StagedInfo) => void) => {
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("photo", file);
        const result = await stagePhoto(body);

        if (!result.ok) {
          setErrors((e) => [...e, result.message]);
          return;
        }

        setErrors([]);
        const { path, sha, width, height, lqip, preview } = result.photo;
        update((d) => {
          d.blobs.push({ path, sha });
          assign(d, { src: path.replace(/^public/, ""), width, height, lqip, preview });
        });
      } catch {
        setErrors((e) => [
          ...e,
          `${file.name}: the upload did not complete. Check your connection and try again.`,
        ]);
      } finally {
        setUploading((n) => n - 1);
      }
    },
    [update],
  );

  // Server-side rendering has no draft yet; wait for the restore so the two
  // never disagree about what is on screen.
  if (!loaded) return <div className="ed"><p className="edIntro">Loading…</p></div>;

  const staged = draft.blobs.length;

  return (
    <div className="ed">
      <header className="edHeader">
        <div>
          <p className="edEyebrow">Hattie&apos;s Highlights</p>
          <h1 className="edTitle display">Edit your site</h1>
        </div>
        <div className="edHeaderActions">
          <a className="edButtonSmall" href="/" target="_blank" rel="noreferrer">View site ↗</a>
          <form action={signOut}>
            <button className="edButtonSmall">Sign out</button>
          </form>
        </div>
      </header>

      {!publishReady ? (
        <div className="edBanner" role="alert">
          <p>
            <strong>Changes cannot be published yet.</strong> {publishReason}
          </p>
          {/* What the server can actually see, so a missing variable and a
              misspelled one stop looking the same. */}
          <ul className="edEnvList">
            {publishEnv.map((v) => (
              <li key={v.name}>
                <span aria-hidden="true">{v.present ? "✓" : "✗"}</span>{" "}
                <code>{v.name}</code>{" "}
                {v.present ? (v.note ?? "is set") : "is not visible to the server"}
              </li>
            ))}
          </ul>
          <p className="edNote">
            Set these in Vercel under Settings → Environment Variables, tick
            Production, then redeploy — variables do not reach a build that already
            happened.
          </p>
        </div>
      ) : null}

      <nav className="edTabs" aria-label="Sections">
        {TABS.map((name) => (
          <button key={name} className="edTab" aria-current={tab === name ? "page" : undefined}
            onClick={() => setTab(name)}>{name}</button>
        ))}
      </nav>

      <main className="edMain">
        {tab === "Photos" && (
          <PhotosPanel draft={draft} update={update} stage={stage} errors={errors} uploading={uploading} />
        )}
        {tab === "Home page" && <HomePanel draft={draft} update={update} stage={stage} />}
        {tab === "About page" && <AboutPanel draft={draft} update={update} stage={stage} />}
        {tab === "Banner" && <BannerPanel draft={draft} update={update} />}
      </main>

      {/* Always visible, so it is never a question where the save button went. */}
      <div className="edPublishBar" data-dirty={dirty}>
        <div className="edPublishState">
          {dirty ? (
            <>
              <strong>Unpublished changes</strong>
              {staged > 0 ? ` · ${staged} new photo${staged === 1 ? "" : "s"}` : ""}
            </>
          ) : (
            "Everything is published."
          )}
          {state.message ? (
            <p className={state.ok ? "edOk" : "edError"} role="status">
              {state.message}
              {state.url ? <> <a href={state.url} target="_blank" rel="noreferrer">View the change ↗</a></> : null}
            </p>
          ) : null}
        </div>

        <div className="edPublishActions">
          {dirty ? (
            <button type="button" className="edButtonSmall edLink" onClick={discard} disabled={pending}>
              Discard
            </button>
          ) : null}
          <form action={formAction}>
            <input type="hidden" name="draft" value={JSON.stringify(draft)} />
            <button
              className="edButton edButtonPrimary"
              disabled={!dirty || pending || !publishReady || uploading > 0}
            >
              {pending ? "Publishing…" : uploading > 0 ? "Waiting for uploads…" : "Publish changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
