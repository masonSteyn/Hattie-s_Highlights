"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import type {
  AboutContent,
  Category,
  HomeContent,
  Photo,
  SiteSettings,
} from "@/lib/types";

import {
  deletePhoto,
  movePhoto,
  replaceImage,
  saveAboutText,
  saveAltText,
  saveAvailability,
  saveHomeText,
  setFeatured,
  signOut,
  uploadPhotos,
  type Result,
} from "./actions";

const idle: Result = { ok: true };

/* ── Shared bits ─────────────────────────────────────────────────────────── */

function Status({ state }: { state: Result }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "edOk" : "edError"} role="status">
      {state.message}
    </p>
  );
}

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="edSection">
      <h2 className="edSectionTitle display">{title}</h2>
      {intro ? <p className="edIntro">{intro}</p> : null}
      {children}
    </section>
  );
}

/* ── Availability banner ─────────────────────────────────────────────────── */

function BannerPanel({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveAvailability, idle);
  const [enabled, setEnabled] = useState(settings.availability.enabled);

  return (
    <Section
      title="The strip across the top"
      intro="The quickest way to tell people whether you are taking bookings. Leave it off when it is not true — an out-of-date one is worse than none."
    >
      <form action={action} className="edForm">
        <label className="edToggle">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.currentTarget.checked)}
          />
          <span>Show it on every page</span>
        </label>

        <label className="edLabel" htmlFor="banner-text">
          What it says
        </label>
        <input
          id="banner-text"
          name="text"
          className="edInput"
          defaultValue={settings.availability.text}
          maxLength={90}
          placeholder="Booking fall 2026 — 3 dates left"
        />

        <div className="edActions">
          <button className="edButton edButtonPrimary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <Status state={state} />
        </div>
      </form>
    </Section>
  );
}

/* ── Swap a single image ─────────────────────────────────────────────────── */

function ImageSwap({
  documentId,
  fieldName,
  label,
  current,
}: {
  documentId: string;
  fieldName: string;
  label: string;
  current: { src: string; width: number; height: number; lqip: string; alt: string };
}) {
  const [state, action, pending] = useActionState(replaceImage, idle);

  return (
    <form action={action} className="edForm edSwap">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="fieldName" value={fieldName} />

      <div className="edSwapPreview">
        <Image
          src={current.src}
          alt={current.alt}
          width={current.width}
          height={current.height}
          placeholder="blur"
          blurDataURL={current.lqip}
          sizes="320px"
        />
      </div>

      <div className="edSwapFields">
        <label className="edLabel" htmlFor={`${fieldName}-file`}>
          {label}
        </label>
        <input
          id={`${fieldName}-file`}
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="edFile"
          required
        />

        <label className="edLabel" htmlFor={`${fieldName}-alt`}>
          Describe it
        </label>
        <input
          id={`${fieldName}-alt`}
          name="alt"
          className="edInput"
          defaultValue={current.alt}
          minLength={8}
          maxLength={200}
          required
        />

        <div className="edActions">
          <button className="edButton" disabled={pending}>
            {pending ? "Uploading…" : "Swap photo"}
          </button>
          <Status state={state} />
        </div>
      </div>
    </form>
  );
}

/* ── Home page ───────────────────────────────────────────────────────────── */

function HomePanel({ home }: { home: HomeContent }) {
  const [state, action, pending] = useActionState(saveHomeText, idle);

  return (
    <Section title="Home page">
      <ImageSwap
        documentId="homePage"
        fieldName="hero"
        label="The big photo at the top"
        current={home.hero}
      />

      <form action={action} className="edForm">
        <p className="edNote">
          The headline is in three parts because one word is set in the handwriting font. Keep that
          word to one — it is beautiful and very hard to read in long runs.
        </p>

        <div className="edRow">
          <div>
            <label className="edLabel" htmlFor="hb">
              First part
            </label>
            <input id="hb" name="headlineBefore" className="edInput" defaultValue={home.headlineBefore} maxLength={60} />
          </div>
          <div>
            <label className="edLabel" htmlFor="hs">
              Handwritten word
            </label>
            <input id="hs" name="headlineScript" className="edInput edScript" defaultValue={home.headlineScript} maxLength={18} />
          </div>
          <div>
            <label className="edLabel" htmlFor="ha">
              Last part (optional)
            </label>
            <input id="ha" name="headlineAfter" className="edInput" defaultValue={home.headlineAfter} maxLength={60} />
          </div>
        </div>

        <label className="edLabel" htmlFor="intro">
          The line under the photo
        </label>
        <textarea id="intro" name="intro" className="edInput edTextarea" rows={3} defaultValue={home.intro} maxLength={280} />

        <label className="edLabel" htmlFor="ch">
          Heading at the bottom
        </label>
        <input id="ch" name="closingHeading" className="edInput" defaultValue={home.closingHeading} maxLength={80} />

        <label className="edLabel" htmlFor="cb">
          Text at the bottom
        </label>
        <textarea id="cb" name="closingBody" className="edInput edTextarea" rows={2} defaultValue={home.closingBody} maxLength={280} />

        <div className="edActions">
          <button className="edButton edButtonPrimary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <Status state={state} />
        </div>
      </form>
    </Section>
  );
}

/* ── About page ──────────────────────────────────────────────────────────── */

function AboutPanel({ about }: { about: AboutContent }) {
  const [state, action, pending] = useActionState(saveAboutText, idle);

  return (
    <Section title="About page">
      <ImageSwap
        documentId="aboutPage"
        fieldName="portrait"
        label="Your photo"
        current={about.portrait}
      />

      <form action={action} className="edForm">
        <label className="edLabel" htmlFor="ah">
          Heading
        </label>
        <input id="ah" name="heading" className="edInput" defaultValue={about.heading} maxLength={60} />

        <label className="edLabel" htmlFor="ab">
          About you
        </label>
        <p className="edNote">Leave a blank line between paragraphs.</p>
        <textarea
          id="ab"
          name="body"
          className="edInput edTextarea"
          rows={14}
          defaultValue={about.body.join("\n\n")}
        />

        <label className="edLabel" htmlFor="pq">
          The one handwritten line
        </label>
        <input id="pq" name="pullQuote" className="edInput edScript" defaultValue={about.pullQuote} maxLength={60} />

        <div className="edActions">
          <button className="edButton edButtonPrimary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <Status state={state} />
        </div>
      </form>
    </Section>
  );
}

/* ── Photos ──────────────────────────────────────────────────────────────── */

function UploadPanel({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState(uploadPhotos, idle);

  return (
    <form action={action} className="edForm edUpload">
      <label className="edLabel" htmlFor="photos">
        Add photos
      </label>
      <input
        id="photos"
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="edFile"
        required
      />
      <p className="edNote">
        Drag them straight off the camera — no need to resize. Where the photo was taken is removed
        automatically before it is stored.
      </p>

      <div className="edRow">
        <div>
          <label className="edLabel" htmlFor="category">
            Category
          </label>
          <select id="category" name="category" className="edInput" required defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            {categories.map((c) => (
              <option key={c._id} value={c.slug}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="edGrow">
          <label className="edLabel" htmlFor="alt">
            Describe them
          </label>
          <input
            id="alt"
            name="alt"
            className="edInput"
            placeholder="Bride and her dad laughing on the church steps"
            minLength={8}
            required
          />
        </div>
      </div>

      <div className="edActions">
        <button className="edButton edButtonPrimary" disabled={pending}>
          {pending ? "Uploading…" : "Add photos"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

function PhotoRow({ photo, index, total }: { photo: Photo; index: number; total: number }) {
  const [featuredState, featuredAction] = useActionState(setFeatured, idle);
  const [altState, altAction, altPending] = useActionState(saveAltText, idle);
  const [moveState, moveAction] = useActionState(movePhoto, idle);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePhoto, idle);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="edPhoto">
      <div className="edPhotoThumb">
        <Image
          src={photo.image.src}
          alt={photo.image.alt}
          width={photo.image.width}
          height={photo.image.height}
          placeholder="blur"
          blurDataURL={photo.image.lqip}
          sizes="160px"
        />
      </div>

      <div className="edPhotoBody">
        <form action={altAction} className="edPhotoAlt">
          <input type="hidden" name="id" value={photo._id} />
          <label className="sr-only" htmlFor={`alt-${photo._id}`}>
            Description
          </label>
          <input
            id={`alt-${photo._id}`}
            name="alt"
            className="edInput edInputSmall"
            defaultValue={photo.image.alt}
            minLength={8}
          />
          <button className="edButtonSmall" disabled={altPending}>
            {altPending ? "…" : "Save"}
          </button>
        </form>
        <Status state={altState} />

        <div className="edPhotoControls">
          <form action={featuredAction}>
            <input type="hidden" name="id" value={photo._id} />
            <input type="hidden" name="featured" value={String(!photo.featured)} />
            <button
              className={photo.featured ? "edStar edStarOn" : "edStar"}
              aria-pressed={photo.featured}
            >
              {photo.featured ? "★ On home page" : "☆ Add to home page"}
            </button>
          </form>

          <form action={moveAction} className="edMove">
            <input type="hidden" name="id" value={photo._id} />
            <button name="direction" value="up" className="edButtonSmall" disabled={index === 0} aria-label="Move earlier">
              ↑
            </button>
            <button name="direction" value="down" className="edButtonSmall" disabled={index === total - 1} aria-label="Move later">
              ↓
            </button>
          </form>

          {confirming ? (
            <form action={deleteAction} className="edDelete">
              <input type="hidden" name="id" value={photo._id} />
              <input
                name="confirm"
                className="edInput edInputSmall"
                placeholder="Type DELETE"
                aria-label="Type DELETE to confirm"
                autoFocus
              />
              <button className="edButtonSmall edButtonDanger" disabled={deletePending}>
                {deletePending ? "…" : "Delete"}
              </button>
              <button type="button" className="edButtonSmall" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="edButtonSmall edLink" onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}
        </div>
        <Status state={moveState} />
        <Status state={featuredState} />
        <Status state={deleteState} />
      </div>
    </li>
  );
}

/* ── Shell ───────────────────────────────────────────────────────────────── */

const TABS = ["Photos", "Home page", "About page", "Banner"] as const;
type Tab = (typeof TABS)[number];

export function Editor({
  settings,
  home,
  about,
  photos,
  categories,
  readOnlyReason,
}: {
  settings: SiteSettings;
  home: HomeContent;
  about: AboutContent;
  photos: Photo[];
  categories: Category[];
  readOnlyReason: string | null;
}) {
  const [tab, setTab] = useState<Tab>("Photos");
  const featuredCount = photos.filter((p) => p.featured).length;

  return (
    <div className="ed">
      <header className="edHeader">
        <div>
          <p className="edEyebrow">Hattie&apos;s Highlights</p>
          <h1 className="edTitle display">Edit your site</h1>
        </div>
        <div className="edHeaderActions">
          <a className="edButtonSmall" href="/" target="_blank" rel="noreferrer">
            View site ↗
          </a>
          <form action={signOut}>
            <button className="edButtonSmall">Sign out</button>
          </form>
        </div>
      </header>

      {readOnlyReason ? (
        <p className="edBanner" role="alert">
          <strong>Nothing can be saved yet.</strong> {readOnlyReason}
        </p>
      ) : null}

      <nav className="edTabs" aria-label="Sections">
        {TABS.map((name) => (
          <button
            key={name}
            className="edTab"
            aria-current={tab === name ? "page" : undefined}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <main className="edMain">
        {tab === "Photos" && (
          <Section
            title="Photos"
            intro={`${photos.length} on the site, ${featuredCount} showing on the home page. The order here is the order they appear.`}
          >
            <UploadPanel categories={categories} />
            <ul className="edPhotoList">
              {photos.map((photo, i) => (
                <PhotoRow key={photo._id} photo={photo} index={i} total={photos.length} />
              ))}
            </ul>
          </Section>
        )}

        {tab === "Home page" && <HomePanel home={home} />}
        {tab === "About page" && <AboutPanel about={about} />}
        {tab === "Banner" && <BannerPanel settings={settings} />}
      </main>
    </div>
  );
}
