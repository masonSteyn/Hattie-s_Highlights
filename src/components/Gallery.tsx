"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { useDialog } from "@/lib/useDialog";
import type { Photo } from "@/lib/types";

/** How far a touch has to travel before it counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 48;

/**
 * Masonry gallery plus lightbox.
 *
 * Two things keep this fast with a library of a hundred-plus photographs:
 *
 *  - The grid is CSS multi-column. Every image is one column wide and free to be
 *    its own height, so nothing is cropped to a square and the browser does the
 *    packing with no measurement pass and no layout JS.
 *  - Only the current slide and its two neighbours are ever mounted in the
 *    lightbox. Mounting a hundred full-bleed <Image>s to show one would defeat
 *    the point of lazy-loading the grid.
 */
export function Gallery({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const open = index !== null;
  const close = useCallback(() => setIndex(null), []);

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => {
        if (current === null) return current;
        // Wraps, so arrowing off either end continues rather than dead-ending.
        return (current + delta + photos.length) % photos.length;
      });
    },
    [photos.length],
  );

  useDialog({ open, ref: dialogRef, onClose: close });

  // Arrow keys. Escape, the focus trap, and scroll lock come from useDialog.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, go]);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    if (!start) return;
    touchStart.current = null;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    // Ignore anything more vertical than horizontal, so a scroll gesture that
    // drifts sideways does not page the gallery.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  };

  const current = index === null ? null : photos[index];

  return (
    <>
      <ul className="masonry gallery">
        {photos.map((photo, i) => (
          <li key={photo._id} className="cell">
            <button
              type="button"
              className="frame"
              onClick={() => setIndex(i)}
              aria-label={`Open photograph: ${photo.image.alt}`}
              aria-haspopup="dialog"
            >
              <Image
                src={photo.image.src}
                alt={photo.image.alt}
                width={photo.image.width}
                height={photo.image.height}
                placeholder="blur"
                blurDataURL={photo.image.lqip}
                // The first row is above the fold on most viewports; everything
                // after it waits until it is near.
                loading={i < 3 ? "eager" : "lazy"}
                sizes="(max-width: 640px) 100vw, (max-width: 1023px) 50vw, 30vw"
              />
            </button>
          </li>
        ))}
      </ul>

      {open && current ? (
        <div
          ref={dialogRef}
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photograph ${index + 1} of ${photos.length}`}
        >
          <div className="lightboxBar">
            <p className="eyebrow lightboxCount">
              {index + 1} / {photos.length}
            </p>
            <button
              type="button"
              className="lightboxBtn"
              onClick={close}
              aria-label="Close viewer"
            >
              <X size={22} strokeWidth={1.25} aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            className="lightboxBtn lightboxPrev"
            onClick={() => go(-1)}
            aria-label="Previous photograph"
          >
            <ChevronLeft size={26} strokeWidth={1.25} aria-hidden="true" />
          </button>

          <figure
            className="lightboxStage"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <Image
              key={current._id}
              src={current.image.src}
              alt={current.image.alt}
              width={current.image.width}
              height={current.image.height}
              placeholder="blur"
              blurDataURL={current.image.lqip}
              priority
              sizes="(max-width: 1023px) 100vw, 84vw"
            />
            {current.caption ? (
              <figcaption className="lightboxCaption">{current.caption}</figcaption>
            ) : null}
          </figure>

          <button
            type="button"
            className="lightboxBtn lightboxNext"
            onClick={() => go(1)}
            aria-label="Next photograph"
          >
            <ChevronRight size={26} strokeWidth={1.25} aria-hidden="true" />
          </button>

          {/* Neighbours, decoded but never painted, so arrowing through the
              gallery does not flash a blur placeholder on every step. */}
          <div className="lightboxPreload" aria-hidden="true">
            {[-1, 1].map((delta) => {
              const neighbour =
                photos[(index + delta + photos.length) % photos.length];
              if (!neighbour || neighbour._id === current._id) return null;
              return (
                <Image
                  key={neighbour._id}
                  src={neighbour.image.src}
                  alt=""
                  width={neighbour.image.width}
                  height={neighbour.image.height}
                  sizes="(max-width: 1023px) 100vw, 84vw"
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
