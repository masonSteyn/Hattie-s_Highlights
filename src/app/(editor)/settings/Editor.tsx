"use client";

import Image from "next/image";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";

import { prepareUpload } from "@/lib/image-metadata";
import type { SiteContent } from "@/lib/content";

import { publish, signOut, type Result } from "./actions";

const idle: Result = { ok: true };

/** Where an unpublished draft is kept between page loads. */
const DRAFT_KEY = "hh.draft.v1";

type StagedImage = { path: string; dataUrl: string };

/* ── Draft state ─────────────────────────────────────────────────────────── */

type Draft = { content: SiteContent; newImages: StagedImage[] };

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
  const [draft, setDraft] = useState<Draft>(() => ({ content: clone(published), newImages: [] }));
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
      // Staged photos are held as data URLs, so a big batch can exceed the
      // storage quota. Losing the backup is survivable; losing the draft in
      // memory is not, so this is deliberately silent.
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
    setDraft({ content: clone(published), newImages: [] });
  }, [published]);

  const dirty = useMemo(
    () =>
      draft.newImages.length > 0 ||
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

/** Reads a file, validates and strips it in the browser for instant feedback.
 *  The server does this again on publish — this copy is for the preview and the
 *  error message, not for security. */
async function stageFile(file: File, targetPath: string): Promise<StagedImage | string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const prepared = prepareUpload(bytes);
  if (!prepared.ok) return `${file.name}: ${prepared.reason}`;

  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < prepared.bytes.length; i += chunk) {
    binary += String.fromCharCode(...prepared.bytes.subarray(i, i + chunk));
  }
  return {
    path: targetPath,
    dataUrl: `data:image/${prepared.format};base64,${btoa(binary)}`,
  };
}

function slugForUpload(name: string) {
  const base = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base.slice(0, 40) || "photo"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
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
  current: { src: string; width: number; height: number; lqip: string; alt: string };
  onPick: (file: File) => void;
  onAlt: (alt: string) => void;
}) {
  const isStaged = current.src.startsWith("data:");
  return (
    <div className="edForm edSwap">
      <div className="edSwapPreview">
        {isStaged ? (
          // eslint-disable-next-line @next/next/no-img-element -- a staged file is a data URL with no known dimensions yet
          <img src={current.src} alt={current.alt} />
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
  stage: (file: File, assign: (d: Draft, path: string, dataUrl: string) => void) => void;
}) {
  const home = draft.content.home;
  return (
    <Section title="Home page">
      <ImageSwap
        label="The big photo at the top"
        current={home.hero}
        onPick={(file) =>
          stage(file, (d, path, dataUrl) => {
            d.content.home.hero.src = dataUrl;
            d.content.home.hero.publishPath = path;
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
  stage: (file: File, assign: (d: Draft, path: string, dataUrl: string) => void) => void;
}) {
  const about = draft.content.about;
  return (
    <Section title="About page">
      <ImageSwap
        label="Your photo"
        current={about.portrait}
        onPick={(file) =>
          stage(file, (d, path, dataUrl) => {
            d.content.about.portrait.src = dataUrl;
            d.content.about.portrait.publishPath = path;
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
}: {
  draft: Draft;
  update: (fn: (d: Draft) => void) => void;
  stage: (file: File, assign: (d: Draft, path: string, dataUrl: string) => void) => void;
  errors: string[];
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
                stage(file, (d, path, dataUrl) => {
                  d.content.photos.push({
                    _id: path,
                    image: { src: dataUrl, width: 1600, height: 1067, lqip: "", alt: "", publishPath: path },
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

        {errors.length > 0 ? (
          <div className="edErrorList">
            {errors.map((e) => <p key={e} className="edError">{e}</p>)}
          </div>
        ) : null}
      </div>

      <ul className="edPhotoList">
        {photos.map((photo, index) => {
          const staged = photo.image.src.startsWith("data:");
          return (
            <li key={photo._id} className="edPhoto">
              <div className="edPhotoThumb">
                {staged ? (
                  // eslint-disable-next-line @next/next/no-img-element -- staged data URL, dimensions unknown until publish
                  <img src={photo.image.src} alt={photo.image.alt || "New photo"} />
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
                        const path = removed.image.publishPath;
                        if (path) d.newImages = d.newImages.filter((i) => i.path !== path);
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
}: {
  published: SiteContent;
  publishReady: boolean;
  publishReason: string | null;
}) {
  const [tab, setTab] = useState<Tab>("Photos");
  const { draft, update, discard, dirty, loaded } = useDraft(published);
  const [errors, setErrors] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState(publish, idle);

  // Once a publish succeeds the draft is the published state, so clear it.
  useEffect(() => {
    if (state.ok && state.message) {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [state]);

  const stage = useCallback(
    async (file: File, assign: (d: Draft, path: string, dataUrl: string) => void) => {
      const ext = file.name.match(/\.(jpe?g|png|webp)$/i)?.[0] ?? ".jpg";
      const path = `public/photos/${slugForUpload(file.name)}${ext.toLowerCase()}`;
      const result = await stageFile(file, path);

      if (typeof result === "string") {
        setErrors((e) => [...e, result]);
        return;
      }

      setErrors([]);
      update((d) => {
        d.newImages.push(result);
        assign(d, path.replace(/^public/, ""), result.dataUrl);
      });
    },
    [update],
  );

  // Server-side rendering has no draft yet; wait for the restore so the two
  // never disagree about what is on screen.
  if (!loaded) return <div className="ed"><p className="edIntro">Loading…</p></div>;

  const staged = draft.newImages.length;

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
        <p className="edBanner" role="alert">
          <strong>Changes cannot be published yet.</strong> {publishReason}
        </p>
      ) : null}

      <nav className="edTabs" aria-label="Sections">
        {TABS.map((name) => (
          <button key={name} className="edTab" aria-current={tab === name ? "page" : undefined}
            onClick={() => setTab(name)}>{name}</button>
        ))}
      </nav>

      <main className="edMain">
        {tab === "Photos" && <PhotosPanel draft={draft} update={update} stage={stage} errors={errors} />}
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
            <button className="edButton edButtonPrimary" disabled={!dirty || pending || !publishReady}>
              {pending ? "Publishing…" : "Publish changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
