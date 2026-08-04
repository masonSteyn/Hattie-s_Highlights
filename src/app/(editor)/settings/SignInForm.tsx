"use client";

import { useActionState } from "react";

import { signIn, type Result } from "./actions";

const initial: Result = { ok: true };

/**
 * The whole login.
 *
 * One field, no username, no "forgot password", no "create account". Every one
 * of those is a place to leak whether an account exists or to be phished, and
 * none of them earns its keep for a site with exactly one editor.
 */
export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <main className="signIn">
      <form action={formAction} className="signInCard">
        <h1 className="signInTitle display">Edit your site</h1>
        <p className="signInHint">Enter the password you were given.</p>

        <label className="edLabel" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="edInput"
          autoComplete="current-password"
          autoFocus
          required
          // Long passphrases are encouraged, so nothing here fights them.
          maxLength={200}
          aria-describedby={state.ok ? undefined : "signin-error"}
          aria-invalid={state.ok ? undefined : true}
        />

        {!state.ok && state.message ? (
          <p className="edError" id="signin-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <button type="submit" className="edButton edButtonPrimary" disabled={pending}>
          {pending ? "Checking…" : "Sign in"}
        </button>

        <p className="signInFoot">
          Forgotten it? It cannot be recovered — ask whoever set this up to issue a new one.
        </p>
      </form>
    </main>
  );
}
