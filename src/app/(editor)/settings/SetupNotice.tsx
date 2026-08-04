/**
 * Shown when the editor has no password configured.
 *
 * It refuses to let anyone in rather than falling open — a half-configured
 * login that lets everybody through is far worse than one that lets nobody
 * through and says why.
 */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="signIn">
      <div className="signInCard">
        <p className="edEyebrow">Not set up yet</p>
        <h1 className="signInTitle display">Set an editor password</h1>

        <p className="signInHint">
          Nobody can sign in until this is done. Run this once, then paste both lines into{" "}
          <code>.env.local</code>:
        </p>

        <pre className="edCode">node scripts/set-password.mjs &quot;a long password&quot;</pre>

        <p className="signInHint">Currently missing:</p>
        <ul className="edMissing">
          {missing.map((item) => (
            <li key={item}>
              <code>{item}</code>
            </li>
          ))}
        </ul>

        <p className="signInFoot">
          On Vercel, add the same two values under Settings → Environment Variables and redeploy.
        </p>
      </div>
    </main>
  );
}
