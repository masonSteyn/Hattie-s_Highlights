import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifySessionToken } from "./auth";

/**
 * Cookie handling, kept apart from the crypto in auth.ts so the hashing and
 * signing can be tested without a request context.
 */

export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(): Promise<boolean> {
  const token = createSessionToken();
  if (!token) return false;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    // Not readable from JavaScript, so an XSS bug cannot lift the session.
    httpOnly: true,
    // HTTPS only in production; plain http locally or the cookie is dropped.
    secure: process.env.NODE_ENV === "production",
    // The editor is never linked to from anywhere else, so the strictest
    // setting costs nothing and removes CSRF as a category.
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return true;
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
