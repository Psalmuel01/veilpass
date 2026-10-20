"use client";
import { serviceResponse } from "../../lib/service-response";
import { useEffect, useRef, useState } from "react";
import { holderError } from "../../lib/holder-error";
import { AppShell } from "../../components/app-shell";
import { inspectBackup } from "../../../../packages/holder-backup";
import type {
  Holder,
  LocalVerifier,
  PresentationWitness,
} from "../../../../integrations/issuance/src/index";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type { SignedNetworkConfig } from "../../lib/signed-midnight";
import type { ChallengeV3 } from "../../../../integrations/issuance/src/verifier";
const STORAGE = "veilpass.signed-holder.v1";
const load = () => import("../../../../integrations/issuance/src/index");
type RecordView = { id: string; level: number; expiresAt: number };
export default function HolderWallet() {
  const holder = useRef<Holder | undefined>(undefined);
  const pending = useRef<
    { verifier: LocalVerifier; witness: PresentationWitness } | undefined
  >(undefined);
  const [backup, setBackup] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [records, setRecords] = useState<RecordView[] | undefined>();
  const [identity, setIdentity] = useState("");
  const [offer, setOffer] = useState("");
  const [policy, setPolicy] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState("");
  const selection = useRef(0);
  const wallet = useRef<ConnectedAPI | undefined>(undefined);
  const networkConfig = useRef<SignedNetworkConfig | undefined>(undefined);
  const networkPresentation = useRef<
    | { version: 3; challengeId: string; transactionReference: string }
    | undefined
  >(undefined);
  const [wallets, setWallets] = useState<[string, string][]>([]);
  const [walletName, setWalletName] = useState("");
  const [stage, setStage] = useState("");
  function lock() {
    selection.current++;
    holder.current?.lock();
    holder.current = undefined;
    pending.current = undefined;
    networkPresentation.current = undefined;
    setStage("");
    setRecords(undefined);
    setIdentity("");
    setResult("");
    setPassphrase("");
    setNotice("Holder locked. Unlock the encrypted backup to continue.");
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        inspectBackup(saved);
        setBackup(saved);
        setNotice(
          "Encrypted browser vault found. Enter its passphrase to unlock.",
        );
      }
    } catch {
      setError(
        "Browser storage is unavailable or contains an unsupported backup. Import your recovery file.",
      );
    }
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (holder.current) lock();
      }, 5 * 60000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
      selection.current++;
      holder.current?.lock();
      holder.current = undefined;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setResult("");
    try {
      await action();
    } catch (e) {
      setError(holderError(e));
      setStage((current) => (current === "confirmed" ? current : ""));
    } finally {
      setPassphrase("");
      setBusy(false);
    }
  }
  function view(m: Awaited<ReturnType<typeof load>>, h: Holder) {
    setRecords(h.credentials());
    setIdentity(m.encodeWire(h.publicIdentity()));
  }
  async function importFile(file?: File) {
    lock();
    setBackup("");
    setError("");
    setNotice("");
    const version = selection.current;
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 1500000) throw new Error("Backup too large.");
      const text = await file.text();
      inspectBackup(text);
      if (version === selection.current) {
        setBackup(text);
        setNotice("Encrypted backup loaded. Enter its passphrase to unlock.");
      }
    } catch {
      setError("Choose a valid VeilPass signed-holder backup, up to 1.5 MB.");
    } finally {
      setBusy(false);
    }
  }
  async function unlock() {
    const m = await load(),
      version = selection.current;
    const h = await m.Holder.restore(backup, passphrase);
    if (version !== selection.current) {
      h.lock();
      return;
    }
    holder.current?.lock();
    holder.current = h;
    view(m, h);
    setNotice(
      "Holder ownership and credential signatures checked locally. Current issuer trust and revocation are checked separately.",
    );
  }
  async function create() {
    const version = selection.current,
      m = await load(),
      h = new m.Holder();
    try {
      const encrypted = await h.backup(passphrase);
      if (version !== selection.current) {
        h.lock();
        return;
      }
      holder.current?.lock();
      holder.current = h;
      setBackup(encrypted);
      view(m, h);
      setNotice(
        "Holder key generated on this device. Export your encrypted backup before enrolling. Your signing seed is never sent to the issuer.",
      );
    } catch (e) {
      h.lock();
      throw e;
    }
  }
  async function api(body?: unknown, id?: string) {
    const m = await load();
    const response = await serviceResponse(
      `/api/issuance${id ? `?id=${encodeURIComponent(id)}` : ""}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: m.encodeWire(body),
          }
        : { cache: "no-store" },
    );
    const text = await response.text();
    if (!response.ok) {
      let message = "Issuer unavailable";
      try {
        message = JSON.parse(text).error;
      } catch {}
      throw new Error(message);
    }
    return m.decodeWire(text);
  }
  async function enroll() {
    const h = holder.current;
    if (!h) throw new Error("Unlock your holder first.");
    if (passphrase.length < 12)
      throw new Error(
        "Enter your vault passphrase to encrypt the issued credential.",
      );
    // Preserve the existing recovery passphrase instead of silently rotating it.
    const m = await load();
    const recovered = await m.Holder.restore(backup, passphrase);
    recovered.lock();
    const trust = (await api()) as Parameters<Holder["accept"]>[1];
    const approval = m.decodeWire(offer) as Parameters<Holder["request"]>[0];
    if (m.encodeWire(approval.issuer) !== m.encodeWire(trust))
      throw new Error("Offer issuer differs from configured issuer.");
    const q = (await api({
      action: "issue",
      request: h.request(approval),
    })) as Parameters<Holder["accept"]>[0];
    h.accept(q, trust);
    setBackup(await h.backup(passphrase));
    view(m, h);
    setOffer("");
    pending.current = undefined;
    setNotice(
      "Signed credential issued to your holder key. Export or save the updated encrypted backup now.",
    );
  }
  async function evaluate(id: string, replay = false) {
    const h = holder.current;
    if (!h) throw new Error("Unlock your holder first.");
    const m = await load();
    const status = (await api(undefined, id)) as ReturnType<
      ConstructorParameters<typeof m.LocalVerifier>[0]["read"]
    >;
    if (!status)
      throw new Error("Credential is not registered by this issuer.");
    if (replay) {
      if (!pending.current) throw new Error("Run a policy check first.");
      pending.current.verifier.verify(pending.current.witness);
      return;
    }
    const trust = (await api()) as Parameters<Holder["accept"]>[1];
    const verifier = new m.LocalVerifier(
      { trust, read: () => status },
      "veilpass:browser:signed",
      policy === 1 ? "hackathon.example" : "community.example",
      policy,
    );
    const witness = h.present(id, verifier.challenge());
    pending.current = { verifier, witness };
    setResult(JSON.stringify(verifier.verify(witness), null, 2));
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([backup], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "veilpass-holder.backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Encrypted backup exported. Keep it and its passphrase safe.");
  }
  async function discoverWallets() {
    const response = await serviceResponse("/api/signed-network", { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json()).error);
    const m = await load();
    networkConfig.current = m.decodeWire(
      await response.text(),
    ) as SignedNetworkConfig;
    setWallets(
      Object.entries(window.midnight || {})
        .filter(([, w]) => typeof w.connect === "function")
        .map(([id, w]) => [id, w.name]),
    );
    setNotice(
      "Network configuration loaded. Select an installed wallet. If none appear, install a compatible Midnight wallet and refresh discovery.",
    );
  }
  async function connect(id: string) {
    if (!networkConfig.current)
      throw new Error("Load the network configuration first.");
    const m = await import("../../lib/signed-midnight");
    wallet.current = await m.connectSignedWallet(id, networkConfig.current);
    setWalletName(wallets.find((w) => w[0] === id)?.[1] || "Midnight wallet");
  }
  async function networkAction(action: string, presentation?: unknown) {
    const response = await serviceResponse("/api/signed-network", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, policy, presentation }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  async function proveCredential(id: string) {
    const h = holder.current,
      connected = wallet.current,
      config = networkConfig.current;
    if (!h || !connected || !config)
      throw new Error("Unlock your holder and connect a wallet first.");
    networkPresentation.current = undefined;
    setStage("preparing");
    const challenge = (await networkAction("challenge")) as ChallengeV3;
    const response = await serviceResponse(`/api/issuance?id=${id}&path=1`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error("Current issuer status path unavailable.");
    const model = await load(),
      data = model.decodeWire(await response.text()) as {
        path: Parameters<
          (typeof import("../../lib/signed-midnight"))["proveSigned"]
        >[3];
      };
    const m = await import("../../lib/signed-midnight");
    networkPresentation.current = await m.proveSigned(
      connected,
      h,
      id,
      data.path,
      config,
      challenge,
      setStage,
    );
    setNotice(
      "Authorization confirmed on Midnight. Verify its transaction with the independent verifier. You can retry verification without generating another proof.",
    );
  }
  async function verifyNetwork() {
    if (!networkPresentation.current)
      throw new Error("Generate a confirmed authorization first.");
    setResult(
      JSON.stringify(
        await networkAction("verify", networkPresentation.current),
        null,
        2,
      ),
    );
  }
  return (
    <AppShell section="Holder wallet" environment="Browser signing">
      <main className="vp-dashboard vp-holder">
        <div className="vp-page-heading">
          <div>
            <div className="vp-eyebrow">YOUR KEYS. YOUR QUALIFICATIONS.</div>
            <h1>
              Credentials that
              <br />
              <span>belong to you.</span>
            </h1>
            <p>
              Create a holder key, receive a signed qualification, and keep an
              encrypted recovery copy under your control.
            </p>
          </div>
        </div>
        <div className="vp-sandbox-note">
          <p>
            Signed issuance preview · Local policy checks run real signature
            constraints in your browser. They are not zero-knowledge proofs or
            application authorizations. Enrollment uses the configured signed
            issuer service.
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
            <h2>
              {records
                ? "Your holder is unlocked"
                : "Your private holder wallet"}
            </h2>
            <p>
              Signing keys are created on this device. Only public enrollment
              data and signatures go to the issuer. Unlocked holders lock after
              five minutes of inactivity.
            </p>
            <label htmlFor="holder-file">
              Import an encrypted holder backup
            </label>
            <input
              id="holder-file"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <label htmlFor="holder-passphrase">Vault passphrase</label>
            <input
              id="holder-passphrase"
              type="password"
              autoComplete="off"
              minLength={12}
              maxLength={1024}
              value={passphrase}
              disabled={busy}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            {!records && (
              <div className="vp-holder-actions">
                <button
                  className="vp-button vp-button-blue"
                  disabled={busy || !!backup || passphrase.length < 12}
                  onClick={() => void run(create)}
                >
                  {busy ? "Working…" : "Create holder wallet"}
                </button>
                {backup && (
                  <button
                    className="vp-button vp-button-blue"
                    disabled={busy || passphrase.length < 12}
                    onClick={() => void run(unlock)}
                  >
                    Unlock on this device
                  </button>
                )}
              </div>
            )}
            {records && (
              <>
                <label htmlFor="holder-identity">
                  Share this public enrollment identity with your issuer
                </label>
                <textarea
                  id="holder-identity"
                  readOnly
                  value={identity}
                  rows={5}
                />
                <label htmlFor="holder-offer">
                  Paste the issuer’s approved enrollment offer
                </label>
                <textarea
                  id="holder-offer"
                  value={offer}
                  disabled={busy}
                  onChange={(e) => setOffer(e.target.value)}
                  rows={5}
                />
                <button
                  className="vp-button vp-button-blue"
                  disabled={busy || !offer || passphrase.length < 12}
                  onClick={() => void run(enroll)}
                >
                  Receive signed credential
                </button>
                <small>
                  Enter the existing vault passphrase before receiving a
                  credential, so your updated backup can be encrypted.
                </small>
                <h3>
                  {records.length} signed credential
                  {records.length === 1 ? "" : "s"}
                </h3>
                <label htmlFor="holder-policy">
                  Policy to check on this device
                </label>
                <select
                  id="holder-policy"
                  value={policy}
                  disabled={busy}
                  onChange={(e) => {
                    setPolicy(Number(e.target.value) as 1 | 2);
                    setResult("");
                    pending.current = undefined;
                    networkPresentation.current = undefined;
                    setStage("");
                  }}
                >
                  <option value={1}>Approved training · level 1</option>
                  <option value={2}>Professional level · level 2</option>
                </select>
                {records.map((record) => (
                  <article key={record.id}>
                    <h3>Developer qualification · level {record.level}</h3>
                    <p>
                      Expires{" "}
                      {new Date(record.expiresAt * 1000).toLocaleString()}
                    </p>
                    <p className="vp-holder-reference">
                      Reference: {record.id}
                    </p>
                    <button
                      className="vp-button vp-button-outline"
                      disabled={busy}
                      onClick={() => void run(() => evaluate(record.id))}
                    >
                      Check signatures and eligibility locally
                    </button>
                    {pending.current && (
                      <button
                        className="vp-button vp-button-outline"
                        disabled={busy}
                        onClick={() =>
                          void run(() => evaluate(record.id, true))
                        }
                      >
                        Test replay rejection
                      </button>
                    )}
                    {walletName && (
                      <button
                        className="vp-button vp-button-blue"
                        disabled={busy}
                        onClick={() =>
                          void run(() => proveCredential(record.id))
                        }
                      >
                        Generate V3 network authorization
                      </button>
                    )}
                  </article>
                ))}
                <details>
                  <summary>Proof-backed V3 verification</summary>
                  <p>
                    Requires a configured V3 deployment, current published
                    status root, a holder-controlled local prover and an
                    installed wallet. Local signature checks above do not
                    authorize an application.
                  </p>
                  <button
                    className="vp-button vp-button-outline"
                    disabled={busy}
                    onClick={() => void run(discoverWallets)}
                  >
                    Load network and discover wallets
                  </button>
                  {wallets.map(([id, name]) => (
                    <button
                      key={id}
                      className="vp-button vp-button-outline"
                      disabled={busy || !!walletName}
                      onClick={() => void run(() => connect(id))}
                    >
                      Connect {name}
                    </button>
                  ))}
                  {walletName && (
                    <>
                      <p>Connected: {walletName}</p>
                      <button
                        className="vp-button vp-button-outline"
                        disabled={busy}
                        onClick={() => {
                          wallet.current = undefined;
                          setWalletName("");
                          networkPresentation.current = undefined;
                          setStage("");
                        }}
                      >
                        Forget wallet connection
                      </button>
                    </>
                  )}
                  {stage && <p role="status">Network authorization: {stage}</p>}
                  {networkPresentation.current && (
                    <>
                      <p className="vp-holder-reference">
                        Transaction:{" "}
                        {networkPresentation.current.transactionReference}
                      </p>
                      <button
                        className="vp-button vp-button-blue"
                        disabled={busy}
                        onClick={() => void run(verifyNetwork)}
                      >
                        Verify confirmed transaction
                      </button>
                    </>
                  )}
                </details>
                <button
                  className="vp-button vp-button-outline"
                  disabled={busy}
                  onClick={lock}
                >
                  Lock holder
                </button>
              </>
            )}
            {result && <pre aria-label="Verification result">{result}</pre>}
            {backup && (
              <div className="vp-holder-actions">
                <button
                  className="vp-button vp-button-outline"
                  disabled={busy}
                  onClick={download}
                >
                  Export encrypted backup
                </button>
                <button
                  className="vp-button vp-button-outline"
                  disabled={busy}
                  onClick={() => {
                    try {
                      localStorage.setItem(STORAGE, backup);
                      setNotice(
                        "Encrypted backup saved in this browser. Export a separate recovery copy too.",
                      );
                    } catch {
                      setError(
                        "Could not save browser vault. Export your encrypted backup instead.",
                      );
                    }
                  }}
                >
                  Save encrypted browser vault
                </button>
                <button
                  className="vp-button vp-button-outline"
                  disabled={busy}
                  onClick={() => {
                    try {
                      localStorage.removeItem(STORAGE);
                    } catch {}
                    lock();
                    setBackup("");
                    setOffer("");
                    setNotice(
                      "Holder and encrypted browser vault removed. Exported files remain available.",
                    );
                  }}
                >
                  Remove holder from this browser
                </button>
              </div>
            )}
            <p>
              Passphrases cannot be reset. Back up after every issuance. Browser
              storage can be cleared; exported backups are your recovery path.
              Locking releases application references and clears signing seeds
              where possible; browser memory is not a hardware keystore.
            </p>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
