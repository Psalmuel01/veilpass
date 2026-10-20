"use client";
import { useState } from "react";
import { AppShell } from "../../components/app-shell";
export default function IssuerControls() {
  const [token, setToken] = useState("");
  const [identity, setIdentity] = useState("");
  const [level, setLevel] = useState<1 | 2>(1);
  const [offer, setOffer] = useState("");
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  async function act(action: "approve" | "revoke") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const m = await import("../../../../integrations/issuance/src/wire");
      const body =
        action === "approve"
          ? { action, level, holder: m.decodeWire(identity) }
          : { action, id };
      const response = await fetch("/api/issuance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: m.encodeWire(body),
      });
      const text = await response.text();
      if (!response.ok)
        throw new Error(JSON.parse(text).error || "Issuer operation failed");
      if (action === "approve") {
        setOffer(text);
        setNotice(
          "Holder-bound offer approved. Share it with this holder within five minutes.",
        );
      } else {
        setNotice(
          "Credential revoked. Subsequent checks against this issuer will reject it.",
        );
        setId("");
        setConfirmRevoke(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Issuer operation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell section="Signed issuer" environment="Local operator">
      <main className="vp-dashboard vp-holder">
        <div className="vp-page-heading">
          <div>
            <div className="vp-eyebrow">ISSUE WITH INTENTION</div>
            <h1>
              Approve the learning.
              <br />
              <span>Let holders own the keys.</span>
            </h1>
            <p>
              Issue developer qualifications to a holder’s public enrollment
              identity.
            </p>
          </div>
        </div>
        <div className="vp-sandbox-note">
          <p>
            Local issuer administration · Requires the operator token from your
            local setup. This service uses encrypted persistent storage.
            Institutional identity checks and multi-user issuer accounts are
            separate deployment requirements.
          </p>
        </div>
        {error && (
          <div role="alert" className="vp-alert vp-alert-error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="vp-alert">
            {notice}
          </div>
        )}
        <section className="vp-wallet-empty">
          <div className="vp-holder-controls">
            <label htmlFor="issuer-token">Issuer operator token</label>
            <input
              id="issuer-token"
              type="password"
              autoComplete="off"
              value={token}
              disabled={busy}
              onChange={(e) => setToken(e.target.value)}
            />
            <small>
              Kept in this page’s memory only. Reload to end the operator
              session.
            </small>
            <h2>Approve an enrollment</h2>
            <label htmlFor="issuer-identity">
              Holder’s public enrollment identity
            </label>
            <textarea
              id="issuer-identity"
              rows={5}
              value={identity}
              disabled={busy}
              onChange={(e) => {
                setIdentity(e.target.value);
                setOffer("");
              }}
            />
            <label htmlFor="issuer-level">Approved qualification level</label>
            <select
              id="issuer-level"
              disabled={busy}
              value={level}
              onChange={(e) => {
                setLevel(Number(e.target.value) as 1 | 2);
                setOffer("");
              }}
            >
              <option value={1}>Level 1 · approved training</option>
              <option value={2}>Level 2 · professional qualification</option>
            </select>
            <p>
              Confirm the holder earned this qualification before approving.
              Possession of a signing key does not establish a person’s
              identity.
            </p>
            <button
              className="vp-button vp-button-blue"
              disabled={busy || token.length < 32 || !identity}
              onClick={() => void act("approve")}
            >
              {busy ? "Working…" : "Approve holder enrollment"}
            </button>
            {offer && (
              <>
                <label htmlFor="issuer-offer">
                  Approved offer · share with the holder
                </label>
                <textarea id="issuer-offer" rows={7} value={offer} readOnly />
              </>
            )}
            <h2>Revoke a credential</h2>
            <label htmlFor="issuer-credential">Credential reference</label>
            <input
              id="issuer-credential"
              value={id}
              disabled={busy}
              onChange={(e) => {
                setId(e.target.value);
                setConfirmRevoke(false);
              }}
              placeholder="64-character credential reference"
            />
            <label>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={confirmRevoke}
                disabled={busy}
                onChange={(e) => setConfirmRevoke(e.target.checked)}
              />{" "}
              I have reviewed this reference and understand revocation is
              permanent.
            </label>
            <button
              className="vp-button vp-button-outline"
              disabled={
                busy ||
                token.length < 32 ||
                !/^[0-9a-f]{64}$/.test(id) ||
                !confirmRevoke
              }
              onClick={() => void act("revoke")}
            >
              Revoke credential
            </button>
            <button
              className="vp-button vp-button-outline"
              disabled={busy}
              onClick={() => {
                setToken("");
                setIdentity("");
                setOffer("");
                setId("");
                setNotice("Operator session cleared.");
              }}
            >
              Clear operator session
            </button>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
