"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitContact, type ContactState } from "@/app/(site)/contact/actions";
import type { BudgetRange, SessionType } from "@/lib/types";

const initial: ContactState = { status: "idle", submission: 0 };

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field" data-invalid={error ? "true" : undefined}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p className="fieldError" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ContactForm({
  sessionTypes,
  budgetRanges,
  fallbackEmail,
}: {
  sessionTypes: SessionType[];
  budgetRanges: BudgetRange[];
  fallbackEmail: string;
}) {
  const [state, formAction, pending] = useActionState(submitContact, initial);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Move focus to the outcome so a screen-reader user is told what happened
  // instead of being left on a submit button that appears to have done nothing.
  useEffect(() => {
    if (state.status !== "idle") summaryRef.current?.focus();
  }, [state]);

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const describedBy = (id: string, hint?: boolean) =>
    [hint ? `${id}-hint` : null, errors[id] ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  if (state.status === "success") {
    return (
      <div
        className="outcome outcomeSuccess"
        role="status"
        tabIndex={-1}
        ref={summaryRef}
      >
        <p className="outcomeHeading display">Got it — thank you.</p>
        <p>
          I answer everything within one working day. If you do not hear from me,
          email{" "}
          <a className="fallbackLink" href={`mailto:${fallbackEmail}`}>
            {fallbackEmail}
          </a>{" "}
          and nudge me.
        </p>
        {state.message ? <p className="outcomeNote">{state.message}</p> : null}
      </div>
    );
  }

  return (
    // Keyed on the submission counter so a rejected attempt remounts every
    // field with the values the server echoed back. Uncontrolled <select>s do
    // not otherwise survive the re-render, which silently emptied the two
    // dropdowns and made the next attempt fail on questions already answered.
    <form
      key={state.submission}
      action={formAction}
      className="form"
      noValidate
    >
      {state.status === "error" ? (
        <div
          className="outcome outcomeError"
          role="alert"
          tabIndex={-1}
          ref={summaryRef}
        >
          {state.message}
        </div>
      ) : null}

      {/* Honeypot. Hidden from sight and from assistive tech, and excluded from
          the tab order, so only an automated filler ever populates it. */}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field id="name" label="Your name" error={errors.name}>
        <input
          id="name"
          name="name"
          type="text"
          className="input"
          autoComplete="name"
          required
          maxLength={120}
          defaultValue={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy("name")}
        />
      </Field>

      <Field id="email" label="Email" error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          maxLength={200}
          defaultValue={values.email}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email")}
        />
      </Field>

      <Field id="sessionType" label="What kind of session" error={errors.sessionType}>
        <select
          id="sessionType"
          name="sessionType"
          className="input select"
          required
          defaultValue={values.sessionType ?? ""}
          aria-invalid={errors.sessionType ? true : undefined}
          aria-describedby={describedBy("sessionType")}
        >
          <option value="" disabled>
            Choose one
          </option>
          {sessionTypes.map((session) => (
            <option key={session._id} value={session._id}>
              {session.title}
            </option>
          ))}
        </select>
      </Field>

      <div className="fieldRow">
        <Field
          id="eventDate"
          label="Date"
          hint="Approximate is fine."
          error={errors.eventDate}
        >
          <input
            id="eventDate"
            name="eventDate"
            type="date"
            className="input"
            defaultValue={values.eventDate}
            aria-invalid={errors.eventDate ? true : undefined}
            aria-describedby={describedBy("eventDate", true)}
          />
        </Field>

        <Field
          id="location"
          label="Where"
          hint="Venue, town, or just a rough area."
          error={errors.location}
        >
          <input
            id="location"
            name="location"
            type="text"
            className="input"
            maxLength={160}
            defaultValue={values.location}
            aria-invalid={errors.location ? true : undefined}
            aria-describedby={describedBy("location", true)}
          />
        </Field>
      </div>

      <Field
        id="budget"
        label="Budget range"
        hint="So my first reply can be a real number rather than a rate card."
        error={errors.budget}
      >
        <select
          id="budget"
          name="budget"
          className="input select"
          required
          defaultValue={values.budget ?? ""}
          aria-invalid={errors.budget ? true : undefined}
          aria-describedby={describedBy("budget", true)}
        >
          <option value="" disabled>
            Choose one
          </option>
          {budgetRanges.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="message" label="What are you after" error={errors.message}>
        <textarea
          id="message"
          name="message"
          className="input textarea"
          rows={6}
          required
          maxLength={4000}
          defaultValue={values.message}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy("message")}
        />
      </Field>

      <div className="formActions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </button>
        <p className="formNote">
          Or email{" "}
          <a className="fallbackLink" href={`mailto:${fallbackEmail}`}>
            {fallbackEmail}
          </a>
          .
        </p>
      </div>
    </form>
  );
}
