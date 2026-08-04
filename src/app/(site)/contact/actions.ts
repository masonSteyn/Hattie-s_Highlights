"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getContact, getSessionTypes, getSettings, getBudgetRanges } from "@/lib/content";
import { emailConfigured, sendEmail } from "@/lib/email";
import { rateLimit, rateLimitConfig } from "@/lib/rate-limit";

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Field name → message, so errors render beside the input that caused them. */
  fieldErrors?: Record<string, string>;
  /** Echoed back so a rejected submission does not wipe what was typed. */
  values?: Record<string, string>;
  /**
   * Increments on every response. The form is keyed on it so the fields remount
   * carrying the echoed values — without that, an uncontrolled <select> silently
   * resets to its placeholder after a failed submit and the next attempt fails
   * on a field the person had already answered.
   */
  submission: number;
};

const MAX = { name: 120, location: 160, message: 4000 } as const;

const schema = z.object({
  name: z.string().trim().min(1, "Please add your name.").max(MAX.name),
  email: z.email("That email address does not look right.").max(200),
  sessionType: z.string().trim().min(1, "Pick a session type."),
  eventDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use the date picker."),
  location: z.string().trim().max(MAX.location).optional().default(""),
  budget: z.string().trim().min(1, "Pick a budget range."),
  message: z
    .string()
    .trim()
    .min(10, "A sentence or two is plenty — just not blank.")
    .max(MAX.message),
});

/** Trims and collapses anything destined for an email header. */
function headerSafe(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

function clientIdentifier(headerList: Headers) {
  // Vercel sets x-forwarded-for; the left-most entry is the client. Falling back
  // to a constant means an unknown client shares one bucket, which throttles
  // rather than exempts.
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
}

export async function submitContact(
  previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const submission = previous.submission + 1;
  const raw = Object.fromEntries(
    ["name", "email", "sessionType", "eventDate", "location", "budget", "message"].map(
      (field) => [field, String(formData.get(field) ?? "")],
    ),
  );

  // Honeypot. A real person never sees this field, so anything in it is a bot.
  // It returns the success state rather than an error — telling a scraper it was
  // caught only teaches it to fix its next attempt.
  if (String(formData.get("company") ?? "").trim() !== "") {
    console.warn("[contact] Honeypot triggered.");
    return { status: "success", submission };
  }

  const headerList = await headers();
  const client = clientIdentifier(headerList);

  const tooBusy = `That is a few too many messages in a short window. Try again in ${
    rateLimitConfig.request.windowSeconds / 60
  } minutes, or email me directly.`;

  // Endpoint guard: counts every attempt, valid or not.
  const requests = await rateLimit(client, "request");
  if (!requests.ok) {
    return { status: "error", message: tooBusy, values: raw, submission };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= issue.message;
    }
    return {
      status: "error",
      message: "Some details need another look.",
      fieldErrors,
      values: raw,
      submission,
    };
  }

  const data = parsed.data;

  // The dropdowns are CMS-driven, so their options are re-checked server-side
  // rather than trusted from the submitted form.
  const [sessionTypes, budgets, settings, copy] = await Promise.all([
    getSessionTypes(),
    getBudgetRanges(),
    getSettings(),
    getContact(),
  ]);

  const session = sessionTypes.find((s) => s._id === data.sessionType);
  const budget = budgets.find((b) => b.value === data.budget);

  if (!session || !budget) {
    return {
      status: "error",
      message: "That session type or budget is no longer available — please reselect.",
      fieldErrors: {
        ...(session ? {} : { sessionType: "Pick a session type." }),
        ...(budget ? {} : { budget: "Pick a budget range." }),
      },
      values: raw,
      submission,
    };
  }

  // Inbox guard: only a submission that is actually about to be delivered
  // spends from this bucket.
  const sends = await rateLimit(client, "send");
  if (!sends.ok) {
    return { status: "error", message: tooBusy, values: raw, submission };
  }

  const summary = [
    `From:     ${data.name} <${data.email}>`,
    `Session:  ${session.title}`,
    `Date:     ${data.eventDate || "not given"}`,
    `Location: ${data.location || "not given"}`,
    `Budget:   ${budget.label}`,
    "",
    data.message,
  ].join("\n");

  const toHattie = await sendEmail({
    to: settings.business.email,
    replyTo: data.email,
    subject: `${session.title} enquiry — ${headerSafe(data.name)}`,
    text: summary,
  });

  if (!toHattie.ok) {
    return {
      status: "error",
      message: `Something went wrong sending that. Please email ${settings.business.email} directly — your message did not reach me.`,
      values: raw,
      submission,
    };
  }

  // The auto-response is a courtesy. If it fails, the enquiry still arrived, so
  // it is logged rather than surfaced as a failure to the sender.
  const autoResponse = await sendEmail({
    to: data.email,
    subject: copy.autoResponseSubject,
    text: copy.autoResponseBody,
  });
  if (!autoResponse.ok) {
    console.error("[contact] Auto-response failed:", autoResponse.error);
  }

  return {
    status: "success",
    submission,
    message: emailConfigured()
      ? undefined
      : "Note for the developer: email is not configured, so nothing was actually sent.",
  };
}
