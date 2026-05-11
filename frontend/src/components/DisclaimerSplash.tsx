import React, { useEffect, useState } from "react";
import {
  acceptDisclaimer,
  isDisclaimerAccepted,
  getVaultState,
  registerCarrierBiometric,
  registerCarrierPassphrase,
  setPassphraseForSession,
  isPlatformAuthLikely,
} from "@/lib/sovereignVault";

interface Props {
  onEnter: () => void;
}

/**
 * First-launch sovereign disclaimer + vault setup.
 *
 *   1. Obsidian/Gold disclaimer card with the carrier-acceptance copy.
 *   2. After acceptance: offer biometric vault setup (with passphrase fallback).
 *   3. On vault registration → calls onEnter().
 */
const DisclaimerSplash: React.FC<Props> = ({ onEnter }) => {
  const [accepted, setAccepted] = useState<boolean>(() => isDisclaimerAccepted());
  const [vault, setVault] = useState(getVaultState());
  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"choose" | "passphrase">("choose");

  useEffect(() => {
    isPlatformAuthLikely().then(setBioAvailable);
  }, []);

  // Already accepted + registered → enter
  useEffect(() => {
    if (accepted && vault.registered) onEnter();
  }, [accepted, vault.registered, onEnter]);

  if (accepted && vault.registered) return null;

  const acceptAndContinue = () => {
    acceptDisclaimer();
    setAccepted(true);
  };

  const setupBiometric = async () => {
    setBusy(true); setErr(null);
    try {
      const v = await registerCarrierBiometric();
      setVault(v);
    } catch (e: any) {
      setErr(e?.message || "Biometric setup failed");
    } finally {
      setBusy(false);
    }
  };

  const setupPassphrase = async () => {
    setBusy(true); setErr(null);
    try {
      if (passphrase !== confirm) throw new Error("Passphrases don't match");
      const v = await registerCarrierPassphrase(passphrase);
      setPassphraseForSession(passphrase);
      setVault(v);
    } catch (e: any) {
      setErr(e?.message || "Passphrase setup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bo-disclaimer" data-testid="disclaimer-splash">
      <div className="bo-disclaimer-card">
        <div className="frame-glow" />
        <span className="sigil">⟁ B I · O R A C L E ⟁</span>
        <h1 className="bo-serif">Sovereign Carrier Agreement</h1>

        {!accepted ? (
          <>
            <p className="copy">
              <span className="lead">BiOracle is a Wellness Guide.</span>
              &nbsp;It does not diagnose, treat, or cure.
            </p>
            <p className="copy">
              By entering, you assume <em>full sovereignty</em> over your biological data.
              All readings are companion signatures — not clinical determinations.
              Hand sensitive data to a qualified professional, not to apps.
            </p>
            <ul className="terms">
              <li>Sensors run on-device. Nothing leaves your phone unless you tap <em>Commit</em>.</li>
              <li>The Ledger is encrypted at rest with your biometric (or passphrase).</li>
              <li>Lose this device → the data on it becomes unreadable noise.</li>
              <li>You may revoke and wipe the Vault any time from Stealth → Reset Vault.</li>
            </ul>
            <div className="actions">
              <button className="bo-glass-btn primary" onClick={acceptAndContinue} data-testid="btn-disclaimer-accept">
                I am the Sovereign Carrier · Enter
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="copy">
              <span className="lead">Seal your Sovereign Vault.</span>
              &nbsp;Pick one method. All on-device readings will be AES-GCM encrypted.
            </p>

            {mode === "choose" ? (
              <div className="vault-options">
                <button
                  className="bo-glass-btn primary"
                  onClick={setupBiometric}
                  disabled={busy || bioAvailable === false}
                  data-testid="btn-vault-biometric"
                >
                  {bioAvailable === false ? "Biometric not available" : busy ? "Awaiting prompt…" : "Use Biometric (recommended)"}
                </button>
                <button
                  className="bo-glass-btn"
                  onClick={() => setMode("passphrase")}
                  disabled={busy}
                  data-testid="btn-vault-passphrase-mode"
                >
                  Use Passphrase
                </button>
              </div>
            ) : (
              <div className="vault-passphrase">
                <input
                  type="password"
                  placeholder="Choose a passphrase (≥6 chars)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="bo-banter-input"
                  data-testid="input-passphrase"
                />
                <input
                  type="password"
                  placeholder="Confirm passphrase"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bo-banter-input"
                  data-testid="input-passphrase-confirm"
                />
                <div className="actions">
                  <button
                    className="bo-glass-btn primary"
                    onClick={setupPassphrase}
                    disabled={busy || passphrase.length < 6 || passphrase !== confirm}
                    data-testid="btn-vault-passphrase-set"
                  >
                    {busy ? "Sealing…" : "Seal Vault"}
                  </button>
                  <button className="bo-glass-btn" onClick={() => setMode("choose")} data-testid="btn-vault-back">
                    Back
                  </button>
                </div>
                <p className="warn">
                  ⚠︎ Passphrase is held in memory only for this session. Lose it → vault unreadable. There is no recovery.
                </p>
              </div>
            )}

            {err && <p className="bo-error" data-testid="vault-error">⚠︎ {err}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default DisclaimerSplash;
