"use client";

import Image from "next/image";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SiteContent } from "@/lib/content";
import { needsReencode, reencode, type Prepared } from "@/lib/downscale";
import { UPLOAD_LIMITS, tooLargeMessage } from "@/lib/upload-limits";

import { publish, signOut, stagePhoto, type Result } from "./actions";

const idle: Result = { ok: true };

/**
 * Where an unpublished draft is kept between page loads.
 *
 * Versioned. A draft written by an older build can have a different shape, and
 * restoring one blindly used to throw during render — which bricked the editor
 * permanently, because the bad draft was reloaded on every visit and there was
 * no way to clear it from the UI. Bumping this key retires old drafts outright;
 * `isDraft` below is the second line of defence for anything else.
 */
const DRAFT_KEY = "hh.draft.v3";
/** Retired keys, cleared on load so they cannot accumulate. */
const OLD_DRAFT_KEYS = ["hh.draft.v1", "hh.draft.v2"];

/** A photo already uploaded to GitHub, waiting to be committed. */
type BlobRef = { path: string; sha: string };

/** What a freshly uploaded photo looks like to the panels. `preview` is a small
 *  thumbnail shown until the real file is live at `src`. */
type StagedInfo = { src: string; width: number; height: number; lqip: string; preview: string };

/* ── Draft state ─────────────────────────────────────────────────────────── */

type Draft = {
  content: SiteContent;
  blobs: BlobRef[];
  /** Fingerprint of the content this draft started from. Publishing compares it
   *  against what is actually live, so a tab left open cannot overwrite work
   *  done since it was opened. */
  baseFingerprint: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Is this actually a draft this build understands?
 *
 * Anything stored in a browser is untrusted input: it can be from an older
 * version, hand-edited, or truncated by a full disk. The editor must degrade to
 * "start from what is published" rather than to a blank error page.
 */
function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<Draft>;
  if (!Array.isArray(d.blobs)) return false;
  if (typeof d.baseFingerprint !== "string" || !d.baseFingerprint) return false;
  if (!d.content || typeof d.content !== "object") return false;

  const c = d.content as Partial<SiteContent>;
  return (
    Array.isArray(c.photos) &&
    Array.isArray(c.categories) &&
    Boolean(c.home) &&
    Boolean(c.about) &&
    Boolean(c.settings)
  );
}

/**
 * Everything is edited locally and published in one go.
 *
 * The alternative — saving each field as it changes — would mean a git commit
 * and a site rebuild per keystroke. Holding a draft means Hattie can change ten
 * things, look at them together, and publish once. It also gives her a way out:
 * nothing is committed until she says so, and Discard puts it all back.
 */
function useDraft(published: SiteContent, baseFingerprint: string) {
  const [draft, setDraft] = useState<Draft>(() => ({
    content: clone(published),
    blobs: [],
    baseFingerprint,
  }));
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
      for (const key of OLD_DRAFT_KEYS) window.localStorage.removeItem(key);

      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isDraft(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, an external store unavailable during SSR
          setDraft(parsed);
        } else {
          // Unrecognisable: drop it rather than render from it. Losing an
          // unpublished draft is bad; an editor that cannot open at all is
          // worse, and the published site is never at risk either way.
          window.localStorage.removeItem(DRAFT_KEY);
          console.warn("[editor] Discarded a draft this version does not understand.");
        }
      }
    } catch {
      /* Corrupt or full storage: fall back to the published content. */
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* Nothing more to do — the published content still renders. */
      }
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
    setDraft({ content: clone(published), blobs: [], baseFingerprint });
  }, [published, baseFingerprint]);

  /* The restored draft was built on an older version of the site than this page
     is showing — someone has published since. Publishing it would write the old
     content back over the new, so it is caught here rather than at the end. */
  const stale = loaded && draft.baseFingerprint !== baseFingerprint;

  const dirty = useMemo(
    () =>
      draft.blobs.length > 0 ||
      JSON.stringify(draft.content) !== JSON.stringify(published),
    [draft, published],
  );

  return { draft, update, discard, dirty, loaded, stale };
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

/**
 * Upload progress and failures, for every tab.
 *
 * This used to live inside the Photos panel, which meant a failed upload on the
 * Home or About tab — where the hero and the portrait are replaced — set the
 * error in state and then rendered it nowhere. Picking a file appeared to do
 * absolutely nothing: no preview, no error, not even a dirty marker. Keeping it
 * here, above whichever panel is showing, is what stops that recurring the next
 * time something gains an image field.
 */
function UploadStatus({
  errors,
  uploading,
  preparing,
}: {
  errors: string[];
  uploading: number;
  preparing: number;
}) {
  if (uploading === 0 && preparing === 0 && errors.length === 0) return null;

  return (
    <div className="edUploadStatus">
      {preparing > 0 ? (
        <p className="edUploading" role="status">
          Resizing {preparing} photo{preparing === 1 ? "" : "s"}…
        </p>
      ) : null}

      {uploading > 0 ? (
        <p className="edUploading" role="status">
          Uploading {uploading} photo{uploading === 1 ? "" : "s"}…
        </p>
      ) : null}

      {errors.length > 0 ? (
        // Keyed by position, not by message: two files can fail for the same
        // reason, and identical keys let React drop one of the two.
        <div className="edErrorList" role="alert">
          {errors.map((e, i) => (
            <p key={`${i}-${e}`} className="edError">{e}</p>
          ))}
        </div>
      ) : null}
    </div>
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
        <Field label={label} hint="JPEG, PNG, or WebP. Large photos are resized for you.">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="edFile"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Clear the input before handling it. A file input fires no
              // change event when the same file is picked twice running, so
              // without this the obvious response to a failed upload — choose
              // that photo again — does nothing whatsoever.
              e.target.value = "";
              if (f) onPick(f);
            }}
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

/** A new session type needs an id nothing else is using. */
function newSessionId() {
  return `session-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function BookingPanel({
  draft,
  update,
}: {
  draft: Draft;
  update: (fn: (d: Draft) => void) => void;
}) {
  const booking = draft.content.booking;
  const sessions = draft.content.sessionTypes;

  const move = (index: number, delta: number) =>
    update((d) => {
      const target = index + delta;
      if (target < 0 || target >= d.content.sessionTypes.length) return;
      const [moved] = d.content.sessionTypes.splice(index, 1);
      d.content.sessionTypes.splice(target, 0, moved);
    });

  return (
    <Section title="Booking page">
      <div className="edForm">
        <Field label="Heading">
          <input className="edInput" value={booking.heading} maxLength={60}
            onChange={(e) => update((d) => { d.content.booking.heading = e.target.value; })} />
        </Field>

        <Field label="What to expect" hint="Sits above the calendar. Leave a blank line between paragraphs.">
          <textarea className="edInput edTextarea" rows={8} value={booking.intro.join("\n\n")}
            onChange={(e) =>
              update((d) => {
                d.content.booking.intro = e.target.value
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean);
              })
            } />
        </Field>

        <Field
          label="If the calendar will not load"
          hint="Shown under the calendar. Your email address and “— tell me the date and I will check it by hand” are added after this automatically."
        >
          <input className="edInput" value={booking.fallbackNote} maxLength={120}
            onChange={(e) => update((d) => { d.content.booking.fallbackNote = e.target.value; })} />
        </Field>
      </div>

      <div className="edForm">
        <p className="edNote">
          Session types and their starting prices. These show on this page <em>and</em> fill the
          dropdown on the Contact page, so a change here shows up in both — including on enquiries
          people send you.
        </p>

        <ul className="edSessionList">
          {sessions.map((session, index) => (
            <li key={session._id} className="edSession">
              <div className="edSessionFields">
                <Field label="Name">
                  <input className="edInput" value={session.title} maxLength={60}
                    onChange={(e) =>
                      update((d) => { d.content.sessionTypes[index].title = e.target.value; })
                    } />
                </Field>

                <Field label="Starting price" hint="Whole dollars. Shown as “from $X”.">
                  <input
                    className="edInput"
                    type="number"
                    min={0}
                    step={10}
                    value={session.startingPrice}
                    onChange={(e) =>
                      update((d) => {
                        // An empty box reads as 0 rather than NaN, which would
                        // reach the store and render as "from $NaN".
                        const n = Number(e.target.value);
                        d.content.sessionTypes[index].startingPrice =
                          Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
                      })
                    } />
                </Field>

                <Field label="Description">
                  <textarea className="edInput edTextarea" rows={2} maxLength={300}
                    value={session.description}
                    onChange={(e) =>
                      update((d) => { d.content.sessionTypes[index].description = e.target.value; })
                    } />
                </Field>
              </div>

              <div className="edSessionActions">
                <button type="button" className="edButtonSmall" disabled={index === 0}
                  onClick={() => move(index, -1)} aria-label={`Move ${session.title} up`}>↑</button>
                <button type="button" className="edButtonSmall" disabled={index === sessions.length - 1}
                  onClick={() => move(index, 1)} aria-label={`Move ${session.title} down`}>↓</button>
                <button type="button" className="edButtonSmall"
                  onClick={() =>
                    update((d) => { d.content.sessionTypes.splice(index, 1); })
                  }
                  aria-label={`Remove ${session.title}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="edButtonSmall"
          onClick={() =>
            update((d) => {
              d.content.sessionTypes.push({
                _id: newSessionId(),
                title: "New session type",
                description: "",
                startingPrice: 0,
                order: d.content.sessionTypes.length,
              });
            })
          }
        >
          Add a session type
        </button>
      </div>
    </Section>
  );
}

function PhotosPanel({
  draft,
  update,
  stage,
}: {
  draft: Draft;
  update: (fn: (d: Draft) => void) => void;
  stage: (file: File, assign: (d: Draft, staged: StagedInfo) => void) => void;
}) {
  const { photos, categories } = draft.content;
  const [category, setCategory] = useState(categories[0]?.slug ?? "portraits");
  const featured = photos.filter((p) => p.featured).length;

  /* Scroll a newly added photo into view.
     New photos go on the end of the list, and the box you add them from is at
     the top — so with two dozen already there, uploading one changed nothing
     you could see without scrolling past everything else. It looked like the
     upload had done nothing, which is exactly what the previous upload bug
     looked like, and left no obvious way to undo an accidental one. */
  const listRef = useRef<HTMLUListElement>(null);
  const stagedCount = photos.filter((p) => p.image.preview).length;

  useEffect(() => {
    if (stagedCount === 0) return;
    const rows = listRef.current?.querySelectorAll('[data-staged="true"]');
    const newest = rows?.[rows.length - 1];
    newest?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [stagedCount]);

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
          hint="Drag them straight off the camera — anything too large is resized for you. Where the photo was taken is removed automatically."
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="edFile"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              // Same reason as the single-image picker: re-selecting the same
              // files after a failure has to fire again.
              e.target.value = "";
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

      </div>

      <ul className="edPhotoList" ref={listRef}>
        {photos.map((photo, index) => {
          const staged = Boolean(photo.image.preview);
          return (
            <li key={photo._id} className="edPhoto" data-staged={staged ? "true" : undefined}>
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

/* ── Your details ────────────────────────────────────────────────────────── */

/**
 * The set-once tier.
 *
 * These change once a year, not once a week, so they sit behind their own tab
 * rather than competing with the photo list. Everything here is Hattie's own
 * information — where she works, how to reach her — which is exactly the sort
 * of thing that should not require asking a developer.
 */
function DetailsPanel({ draft, update }: { draft: Draft; update: (fn: (d: Draft) => void) => void }) {
  const b = draft.content.settings.business;
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    update((d) => {
      (d.content.settings.business as unknown as Record<string, string>)[key] = e.target.value;
    });

  return (
    <Section
      title="Your details"
      intro="Where you work and how people reach you. You will rarely need to touch this — but it is yours to change."
    >
      <div className="edForm">
        <Field label="Business name">
          <input className="edInput" value={b.name} onChange={set("name")} maxLength={80} />
        </Field>

        <div className="edRow">
          <div>
            <Field label="City">
              <input
                className="edInput"
                value={b.city}
                onChange={set("city")}
                maxLength={60}
                placeholder="Boulder"
              />
            </Field>
          </div>
          <div>
            <Field label="State or region">
              <input
                className="edInput"
                value={b.region}
                onChange={set("region")}
                maxLength={60}
                placeholder="Colorado"
              />
            </Field>
          </div>
        </div>

        <Field
          label="Areas you travel to"
          hint="How you would describe it out loud — “Boulder and the Front Range”."
        >
          <input className="edInput" value={b.serviceArea} onChange={set("serviceArea")} maxLength={120} />
        </Field>

        <Field
          label="Where enquiries go"
          hint="Every message from the contact form is sent to this address. Make sure it is one you read."
        >
          <input
            className="edInput"
            type="email"
            value={b.email}
            onChange={set("email")}
            maxLength={200}
          />
        </Field>

        <div className="edRow">
          <div>
            <Field label="Phone (optional)">
              <input className="edInput" value={b.phone} onChange={set("phone")} maxLength={40} />
            </Field>
          </div>
          <div>
            <Field label="Hours">
              <input className="edInput" value={b.hours} onChange={set("hours")} maxLength={60} />
            </Field>
          </div>
        </div>
      </div>

      <div className="edForm">
        <Field
          label="Booking calendar link"
          hint="Paste the link to your Calendly (or Cal.com, SavvyCal, Acuity) booking page. This is what fills the Booking page."
        >
          <input
            className="edInput"
            value={draft.content.settings.schedulingUrl}
            onChange={(e) => update((d) => { d.content.settings.schedulingUrl = e.target.value; })}
            maxLength={300}
            placeholder="https://calendly.com/your-name/consult"
          />
        </Field>

        {draft.content.settings.business.social.map((link, i) => (
          <Field key={link.label} label={link.label}>
            <input
              className="edInput"
              value={link.href}
              onChange={(e) =>
                update((d) => {
                  d.content.settings.business.social[i].href = e.target.value;
                })
              }
              maxLength={300}
              placeholder={`https://${link.label.toLowerCase()}.com/your-name`}
            />
          </Field>
        ))}
      </div>
    </Section>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────────── */

const TABS = [
  "Photos",
  "Home page",
  "About page",
  "Booking page",
  "Banner",
  "Your details",
] as const;
type Tab = (typeof TABS)[number];

export function Editor({
  published,
  baseFingerprint,
  publishReady,
  publishReason,
  publishEnv,
}: {
  published: SiteContent;
  baseFingerprint: string;
  publishReady: boolean;
  publishReason: string | null;
  publishEnv: { name: string; present: boolean; note?: string }[];
}) {
  const [tab, setTab] = useState<Tab>("Photos");
  const { draft, update, discard, dirty, loaded, stale } = useDraft(published, baseFingerprint);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  // Resizing is separate from uploading because it is the slow part for a big
  // photo, and "Uploading…" sitting still for four seconds looks like a hang.
  const [preparing, setPreparing] = useState(0);
  const [state, formAction, pending] = useActionState(publish, idle);

  /* Once a publish succeeds the draft is the published state, so clear it.
     The page itself is now out of date — it is still rendering the content the
     build had before the publish — so further editing has to wait for a reload.
     Without this the next publish would be refused as stale, which is correct
     but reads as a failure rather than as "you are one reload behind". */
  const publishedThisSession = state.ok && Boolean(state.message);
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
      /* Shrink before sending, if it needs shrinking.
         A camera original is far over the limit the request body can carry, and
         that limit is the platform's rather than ours — so the choice is
         re-encode it here or refuse it. Anything already small enough, and not
         carrying a rotation that has to be baked in, is passed through
         untouched and keeps its original bytes. */
      let prepared: Prepared = { kind: "unchanged", file };
      try {
        // Asked first, so the notice below appears only for photos actually
        // being re-encoded rather than flashing on every upload.
        if (await needsReencode(file)) {
          setPreparing((n) => n + 1);
          try {
            prepared = await reencode(file);
          } finally {
            setPreparing((n) => n - 1);
          }
        }
      } catch {
        prepared = { kind: "failed", reason: "that photo could not be read." };
      }

      if (prepared.kind === "failed") {
        setErrors((e) => [...e, `${file.name}: ${prepared.reason}`]);
        return;
      }

      /* Still too big even shrunk — a huge transparent PNG can land here.
         Checked before the network because over the transport limit the request
         is rejected by the framework before any of our code runs, so the server
         cannot explain what went wrong: all it can produce is "the upload did
         not complete", which reads like a connection problem and sends you off
         retrying a file that will never work. */
      const upload = prepared.file;
      if (upload.size > UPLOAD_LIMITS.maxBytes) {
        setErrors((e) => [...e, `${file.name}: ${tooLargeMessage(upload.size)}`]);
        return;
      }

      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("photo", upload);
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
        {/* Above the panels, so an upload that fails on any tab says so. */}
        <UploadStatus errors={errors} uploading={uploading} preparing={preparing} />

        {tab === "Photos" && (
          <PhotosPanel draft={draft} update={update} stage={stage} />
        )}
        {tab === "Home page" && <HomePanel draft={draft} update={update} stage={stage} />}
        {tab === "About page" && <AboutPanel draft={draft} update={update} stage={stage} />}
        {tab === "Booking page" && <BookingPanel draft={draft} update={update} />}
        {tab === "Banner" && <BannerPanel draft={draft} update={update} />}
        {tab === "Your details" && <DetailsPanel draft={draft} update={update} />}
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

          {/* Both of these disable the button, so both have to say why. A
              control that is greyed out with no explanation is the same problem
              as a failure with no message. */}
          {stale ? (
            <p className="edError" role="alert">
              The site has changed since this page was opened — it was probably
              published from another tab or another device. Reload this page
              before going further, otherwise publishing would put the older
              version back and undo that work. Anything unpublished here will
              need doing again.
            </p>
          ) : null}

          {publishedThisSession && !stale ? (
            <p className="edOk" role="status">
              Published. Reload this page before making more changes — it is
              still showing the version from before you published.
            </p>
          ) : null}
          {state.message ? (
            <p className={state.ok ? "edOk" : "edError"} role="status">
              {state.message}
              {state.url ? <> <a href={state.url} target="_blank" rel="noreferrer">View the change ↗</a></> : null}
            </p>
          ) : null}

          {/* A publish that would remove photographs shows them first. Names
              like "img-1965-msjv147ekl2.jpg" mean nothing to the person
              deciding, so this shows the actual pictures — they are already
              live at those paths, which is the whole reason they are at risk. */}
          {state.confirm ? (
            <div className="edConfirmRemovals">
              <ul className="edRemovalList">
                {state.confirm.photos.map((src) => (
                  <li key={src} className="edRemoval">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a published file, shown at thumbnail size for a yes/no decision */}
                    <img src={src} alt="" width={64} height={64} />
                    <span className="edRemovalName">{src.replace("/photos/", "")}</span>
                  </li>
                ))}
              </ul>
            </div>
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
            {state.confirm ? (
              <button
                className="edButton"
                name="confirmRemovals"
                value={state.confirm.token}
                disabled={pending}
              >
                {pending
                  ? "Publishing…"
                  : `Yes, remove ${state.confirm.photos.length} and publish`}
              </button>
            ) : null}
            <button
              className="edButton edButtonPrimary"
              disabled={
                !dirty || pending || !publishReady || uploading > 0 || preparing > 0 ||
                stale || publishedThisSession
              }
            >
              {pending
                ? "Publishing…"
                : uploading > 0 || preparing > 0
                  ? "Waiting for photos…"
                  : "Publish changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
