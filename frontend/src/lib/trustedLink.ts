/**
 * trustedLink.ts
 * ----------------------------------------------------------------
 * Guardian module — "Trusted Link".
 *
 *  Sovereign: contact is stored only in localStorage (no server, no telemetry).
 *  When a critical vascular asymmetry / triage event fires, the app:
 *    1. Generates the Gold-on-Obsidian PDF (handed off by caller).
 *    2. Attempts navigator.share() with the PDF Blob attached.
 *    3. Falls back to mailto: with a pre-filled body if Share is unavailable.
 *
 *  The user (Caregiver) must press the explicit dispatch button — even
 *  when auto-send is enabled, we show a 5-second hold-confirm so a false
 *  positive cannot ping a contact silently.
 * ----------------------------------------------------------------
 */

const STORAGE_KEY = "bo.guardian.trustedLink.v14";

export interface TrustedContact {
  name: string;
  email: string;
  phone?: string;
  relation?: string;     // "daughter", "physician", "neighbour"
  autoDispatch: boolean; // honour or require explicit press
}

export function loadTrustedContact(): TrustedContact | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TrustedContact;
  } catch {
    return null;
  }
}

export function saveTrustedContact(c: TrustedContact): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch { /* quota / safari private mode */ }
}

export function clearTrustedContact(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export interface DispatchSummary {
  carrier: string;            // patient / caregiver label
  verdict: string;            // 'critical' / 'elevated' / 'stable'
  directive: string;
  flags: string[];
  scanId: string;
  ledgerUrl: string;
}

/**
 * Attempt to send the report. Returns the channel used.
 *  - "share"   — navigator.share fired with file attached
 *  - "mailto"  — opened mail composer with pre-filled body
 *  - "copy"    — copied summary to clipboard as last resort
 *  - "none"    — failed; caller should show manual instructions
 */
export async function dispatchTrustedLink(
  contact: TrustedContact,
  pdfBlob: Blob,
  summary: DispatchSummary,
): Promise<"share" | "mailto" | "copy" | "none"> {
  const file = new File(
    [pdfBlob],
    `bioracle-${summary.scanId.slice(0, 8)}-${summary.verdict}.pdf`,
    { type: "application/pdf" },
  );

  const subject = `BiOracle Triage — ${summary.verdict.toUpperCase()} for ${summary.carrier}`;
  const body = [
    `Hello ${contact.name},`,
    "",
    `This is an automated, supportive notice from the BiOracle Guardian module.`,
    `Carrier: ${summary.carrier}`,
    `Verdict: ${summary.verdict}`,
    `Directive: ${summary.directive}`,
    summary.flags.length ? `Flags: ${summary.flags.join(", ")}` : "",
    "",
    `Full ledger: ${summary.ledgerUrl}`,
    "",
    "Please reach out — this is informational, not an emergency call.",
    "— BiOracle Sovereign Ledger",
  ].filter(Boolean).join("\n");

  // 1. navigator.share with attachment
  try {
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ title: subject, text: body, files: [file] });
      return "share";
    }
  } catch { /* user cancel or no API */ }

  // 2. mailto fallback (cannot attach files via mailto in spec)
  try {
    const mail = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mail, "_blank");
    return "mailto";
  } catch { /* ignore */ }

  // 3. Clipboard fallback
  try {
    await navigator.clipboard.writeText(`${subject}\n\n${body}`);
    return "copy";
  } catch { /* ignore */ }

  return "none";
}
