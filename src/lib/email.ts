import "server-only";

/**
 * Resend, over its REST API rather than the SDK — one fetch, no dependency, and
 * nothing about the key ever reaches a bundle that could be sent to a browser.
 */

const API = "https://api.resend.com/emails";

export type SendResult =
  | { ok: true; id: string }
  | { ok: true; id: null; skipped: "not-configured" }
  | { ok: false; error: string };

type SendArgs = {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
};

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL);
}

export async function sendEmail({
  to,
  replyTo,
  subject,
  text,
}: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;

  if (!key || !from) {
    // In development this is expected — there are no accounts yet. In
    // production it is a misconfiguration that would silently drop enquiries,
    // so it has to surface as a failure rather than a shrug.
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "Email is not configured (RESEND_API_KEY / CONTACT_FROM_EMAIL).",
      };
    }
    console.warn(
      `[email] Not configured — would have sent "${subject}" to ${to}.`,
    );
    return { ok: true, id: null, skipped: "not-configured" };
  }

  try {
    const response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        ...(replyTo ? { reply_to: [replyTo] } : {}),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[email] Resend rejected the send:", response.status, detail);
      return { ok: false, error: `Resend returned ${response.status}.` };
    }

    const body = (await response.json()) as { id: string };
    return { ok: true, id: body.id };
  } catch (error) {
    console.error("[email] Send failed:", error);
    return { ok: false, error: "Could not reach the email service." };
  }
}
