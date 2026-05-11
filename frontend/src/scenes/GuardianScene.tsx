import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { usePPGScanner } from "@/hardware/usePPGScanner";
import { computeVascularAge } from "@/lib/vascularAge";
import { downloadBioracleReport, getBioracleReportBlob, type PDFInputs } from "@/lib/pdfReport";
import { emergencyTriage, fingerprintToABO } from "@/SovereignLogic";
import {
  loadTrustedContact, saveTrustedContact, clearTrustedContact,
  dispatchTrustedLink, type TrustedContact,
} from "@/lib/trustedLink";

interface Props {
  accent: string;
  onClose: () => void;
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL as string;
const API = `${BACKEND_URL}/api`;

const DEFAULT_BLOOD = fingerprintToABO({
  ridgeDensity: 12.5, whorlRatio: 0.4, loopRatio: 0.4, archRatio: 0.2, minutiaeIndex: 0.55,
});

const GuardianScene: React.FC<Props> = ({ accent, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ppg = usePPGScanner(videoRef);
  const [contact, setContact] = useState<TrustedContact | null>(() => loadTrustedContact());
  const [draft, setDraft] = useState<TrustedContact>({
    name: "", email: "", phone: "", relation: "daughter", autoDispatch: false,
  });
  const [editing, setEditing] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef<number | null>(null);
  const [ledgerId, setLedgerId] = useState<string | null>(null);

  useEffect(() => {
    if (ppg.state.active && ppg.state.elapsedSec >= 14 && !ppg.state.lastResult) ppg.finalize();
  }, [ppg.state.active, ppg.state.elapsedSec, ppg.state.lastResult, ppg]);

  const result = ppg.state.lastResult;
  const apg = result ? computeVascularAge({ samples: ppg.state.rawSamples, fs: ppg.state.sampleRate || 30 }) : null;

  const verdict = result ? emergencyTriage({
    lectin: 0,
    vascularAsymmetry: result.asymmetry,
    emf: 0,
    heartRate: result.heartRate,
    blood: DEFAULT_BLOOD,
  }) : null;

  const trigger = !!verdict && (verdict.critical || verdict.level === "elevated" || (result?.asymmetry ?? 0) > 0.5);

  const commitLedger = async (): Promise<string | null> => {
    if (ledgerId) return ledgerId;
    if (!result || !verdict) return null;
    try {
      const payload = {
        lectin: 0,
        vascular_asymmetry: result.asymmetry,
        emf: 0,
        heart_rate: result.heartRate,
        blood: DEFAULT_BLOOD,
        verdict,
        raw: { ppg: result, apg, profile: "guardian" },
      };
      const res = await axios.post(`${API}/triage/scan`, payload);
      const sid = res.data.id as string;
      setLedgerId(sid);
      return sid;
    } catch {
      return null;
    }
  };

  const buildPdfInputs = async (): Promise<PDFInputs | null> => {
    if (!result || !verdict) return null;
    const sid = (await commitLedger()) || "local-" + Date.now().toString(36);
    return {
      scanId: sid,
      backendUrl: BACKEND_URL,
      verdict,
      heartRate: result.heartRate,
      hrv: result.hrv,
      ppgAmplitude: result.signalAmplitude,
      vascularAge: apg?.vascularAge ?? 0,
      agingIndex: apg?.agingIndex ?? 0,
      vascularAsymmetry: result.asymmetry,
      lectinSignature: 0,
      subSonicRatio: 0,
      acousticState: "n/a",
      acousticBpm: 0,
      emfMicrotesla: 0,
      emfSpikes: 0,
      bloodGroup: `${DEFAULT_BLOOD.group}${DEFAULT_BLOOD.rh}`,
      patientLabel: contact?.name ? `Cared-for of ${contact.name}` : "Sovereign Elder",
    };
  };

  const send = async () => {
    if (!contact) return;
    setDispatchStatus("Preparing PDF…");
    const inputs = await buildPdfInputs();
    if (!inputs) { setDispatchStatus("No scan data yet."); return; }
    const blob = await getBioracleReportBlob(inputs);
    setDispatchStatus("Reaching trusted link…");
    const channel = await dispatchTrustedLink(contact, blob, {
      carrier: inputs.patientLabel || "Cared-for",
      verdict: verdict!.level,
      directive: verdict!.directive,
      flags: verdict!.flags,
      scanId: inputs.scanId,
      ledgerUrl: `${inputs.backendUrl}/api/ledger/${inputs.scanId}`,
    });
    const msg = channel === "share" ? "Shared via system Share sheet."
              : channel === "mailto" ? "Email composer opened with summary."
              : channel === "copy" ? "Summary copied to clipboard."
              : "All channels failed — please share manually.";
    setDispatchStatus(msg);
  };

  const downloadOnly = async () => {
    const inputs = await buildPdfInputs();
    if (!inputs) return;
    await downloadBioracleReport(inputs);
  };

  // 5-second press-to-dispatch (prevents false positives)
  const startHold = () => {
    if (!contact || !trigger) return;
    setHoldProgress(0);
    const startTs = Date.now();
    holdRef.current = window.setInterval(() => {
      const pct = Math.min(1, (Date.now() - startTs) / 5000);
      setHoldProgress(pct);
      if (pct >= 1) {
        if (holdRef.current) { window.clearInterval(holdRef.current); holdRef.current = null; }
        send();
      }
    }, 80);
  };
  const stopHold = () => {
    if (holdRef.current) { window.clearInterval(holdRef.current); holdRef.current = null; }
    setHoldProgress(0);
  };

  const saveContact = () => {
    if (!draft.name || !draft.email) return;
    saveTrustedContact(draft);
    setContact(draft);
    setEditing(false);
  };

  return (
    <div className="bo-immersion profile-guardian" style={{ ["--accent" as any]: accent }} data-testid="guardian-immersion">
      <header className="bo-imm-header">
        <button className="bo-back" onClick={() => { ppg.stop(); onClose(); }} data-testid="btn-back-dash">← Dashboard</button>
        <span className="bo-imm-title">GUARDIAN · TRUSTED LINK</span>
      </header>

      <div className="bo-imm-body">
        <div className="bo-scene-card guardian">
          <h2 className="bo-step-title">Vascular Watch · with a Witness</h2>
          <p className="bo-step-instructions">
            One scan, one trusted contact. If asymmetry trips the triage, you press-and-hold
            for five seconds and the Gold-on-Obsidian PDF goes — calmly, supportively — to your witness.
          </p>

          {/* Contact panel */}
          <div className="bo-trusted-panel" data-testid="trusted-panel">
            {contact && !editing ? (
              <>
                <div className="contact">
                  <span className="nm">{contact.name}</span>
                  <span className="rel">{contact.relation || "trusted contact"}</span>
                  <span className="em">{contact.email}</span>
                  {contact.phone && <span className="ph">{contact.phone}</span>}
                </div>
                <div className="ctl">
                  <button className="bo-glass-btn" onClick={() => { setDraft(contact); setEditing(true); }} data-testid="btn-trusted-edit">Edit</button>
                  <button className="bo-glass-btn" onClick={() => { clearTrustedContact(); setContact(null); }} data-testid="btn-trusted-clear">Clear</button>
                </div>
              </>
            ) : (
              <div className="form" data-testid="trusted-form">
                <input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="trusted-name" />
                <input placeholder="Email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} data-testid="trusted-email" />
                <input placeholder="Phone (optional)" value={draft.phone || ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} data-testid="trusted-phone" />
                <input placeholder="Relation (e.g. daughter, physician)" value={draft.relation || ""} onChange={(e) => setDraft({ ...draft, relation: e.target.value })} data-testid="trusted-relation" />
                <div className="ctl">
                  <button className="bo-glass-btn primary" onClick={saveContact} data-testid="btn-trusted-save">Save</button>
                  {contact && <button className="bo-glass-btn" onClick={() => setEditing(false)} data-testid="btn-trusted-cancel">Cancel</button>}
                </div>
              </div>
            )}
          </div>

          {/* Vascular scan */}
          <video ref={videoRef} playsInline muted autoPlay style={{ width: 1, height: 1, opacity: 0, position: "absolute" }} data-testid="guardian-video" />

          <div className="bo-blood-stats" data-testid="guardian-stats">
            <div><span>HR</span><b>{result?.heartRate || ppg.state.liveHeartRate || 0}</b><em>bpm</em></div>
            <div><span>HRV</span><b>{result?.hrv || 0}</b><em>ms</em></div>
            <div><span>Asym</span><b>{result ? (result.asymmetry * 100).toFixed(0) : 0}</b><em>%</em></div>
            <div><span>Age</span><b>{apg?.vascularAge || 0}</b><em>y</em></div>
          </div>

          <div className="bo-step-progress">
            <span style={{ width: `${Math.min(100, (ppg.state.elapsedSec / 14) * 100)}%` }} />
          </div>

          {verdict && (
            <div className={`bo-guardian-verdict tier-${verdict.level}`} data-testid="guardian-verdict">
              <span className="ribbon">VERDICT · {verdict.level.toUpperCase()}</span>
              <p className="dir">{verdict.directive}</p>
              {verdict.flags.length > 0 && (
                <div className="flags">
                  {verdict.flags.map((f) => <span key={f} className="flag">{f}</span>)}
                </div>
              )}
            </div>
          )}

          {ppg.state.permissionError && <p className="bo-error">⚠︎ {ppg.state.permissionError}</p>}
          {dispatchStatus && <p className="bo-dispatch-status" data-testid="dispatch-status">{dispatchStatus}</p>}

          <div className="bo-step-controls">
            {!ppg.state.active && !result ? (
              <button className="bo-glass-btn primary" onClick={ppg.start} data-testid="btn-guardian-start">Begin Vascular Scan</button>
            ) : ppg.state.active && !result ? (
              <button className="bo-glass-btn" disabled>Scanning {ppg.state.elapsedSec.toFixed(1)}s</button>
            ) : (
              <>
                <button className="bo-glass-btn" onClick={ppg.stop} data-testid="btn-guardian-rescan">Re-scan</button>
                <button className="bo-glass-btn" onClick={downloadOnly} data-testid="btn-guardian-pdf">Save PDF</button>
                {trigger && contact && (
                  <button
                    className="bo-glass-btn primary hold-send"
                    onMouseDown={startHold}
                    onMouseUp={stopHold}
                    onMouseLeave={stopHold}
                    onTouchStart={startHold}
                    onTouchEnd={stopHold}
                    data-testid="btn-guardian-dispatch"
                  >
                    <span className="fill" style={{ width: `${holdProgress * 100}%` }} />
                    <span className="lbl">{holdProgress > 0 ? `Hold… ${Math.ceil((1 - holdProgress) * 5)}s` : "Press 5s · Send Trusted Link"}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardianScene;
