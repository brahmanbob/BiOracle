/**
 * pdfReport.ts
 * ----------------------------------------------------------------
 * Gold-on-Obsidian one-page clinical handoff PDF for BiOracle.
 *
 *   • Layout: A5 portrait (148 × 210 mm) — fits a clinician's pocket.
 *   • Theme: obsidian fill, gold serif headings, mono data tables.
 *   • Footer QR encodes ${REACT_APP_BACKEND_URL}/api/ledger/{scanId}
 *     so the medic can pull the full raw sensor trace.
 * ----------------------------------------------------------------
 */
import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { TriageVerdict } from "@/SovereignLogic";

export interface PDFInputs {
  scanId: string;
  backendUrl: string;
  verdict: TriageVerdict;
  heartRate: number;
  hrv: number;
  ppgAmplitude: number;
  vascularAge: number;
  agingIndex: number;
  vascularAsymmetry: number;
  lectinSignature: number;
  subSonicRatio: number;
  acousticState: string;
  acousticBpm: number;
  emfMicrotesla: number;
  emfSpikes: number;
  bloodGroup: string;
  patientLabel?: string;
}

const OBSIDIAN = "#0a0a0d";
const OBSIDIAN_2 = "#15151c";
const GOLD = "#d4af37";
const GOLD_BRIGHT = "#ffd966";
const RED = "#ff3b3b";
const MUTED = "#8a8475";

export async function generateBioracleReport(inputs: PDFInputs): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const W = 148;
  const H = 210;
  const M = 12; // margin

  // ---- Obsidian background ----
  pdf.setFillColor(OBSIDIAN);
  pdf.rect(0, 0, W, H, "F");

  // subtle inner panel
  pdf.setFillColor(OBSIDIAN_2);
  pdf.roundedRect(M / 2, M / 2, W - M, H - M, 3, 3, "F");

  // ---- Gold border ----
  pdf.setDrawColor(GOLD);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(M / 2, M / 2, W - M, H - M, 3, 3, "S");
  pdf.setLineWidth(0.15);
  pdf.roundedRect(M / 2 + 1.6, M / 2 + 1.6, W - M - 3.2, H - M - 3.2, 2, 2, "S");

  // ---- Header sigil ----
  pdf.setTextColor(GOLD);
  pdf.setFont("times", "italic");
  pdf.setFontSize(9);
  pdf.text("⟁  B I · O R A C L E  ⟁", W / 2, M + 4, { align: "center" });

  pdf.setFont("times", "normal");
  pdf.setFontSize(20);
  pdf.setTextColor(GOLD_BRIGHT);
  pdf.text("Sovereign Triage Report", W / 2, M + 12, { align: "center" });

  pdf.setFontSize(7);
  pdf.setTextColor(MUTED);
  pdf.setFont("courier", "normal");
  const ts = new Date(inputs.verdict.timestamp).toUTCString();
  pdf.text(`SCAN · ${inputs.scanId.slice(0, 8).toUpperCase()}   ·   ${ts}`, W / 2, M + 16, { align: "center" });
  if (inputs.patientLabel) {
    pdf.text(`Carrier: ${inputs.patientLabel}`, W / 2, M + 19, { align: "center" });
  }

  // gold separator
  pdf.setDrawColor(GOLD);
  pdf.setLineWidth(0.3);
  pdf.line(M, M + 22, W - M, M + 22);

  // ---- Verdict block ----
  const isCritical = inputs.verdict.critical;
  pdf.setFont("times", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(isCritical ? RED : GOLD_BRIGHT);
  pdf.text(inputs.verdict.level.replace(/-/g, " ").toUpperCase(), M, M + 30);

  pdf.setFont("courier", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED);
  pdf.text(`SCORE  ${inputs.verdict.score.toFixed(1)} / 100`, W - M, M + 30, { align: "right" });

  pdf.setFont("times", "italic");
  pdf.setFontSize(10);
  pdf.setTextColor("#ece5cf");
  const directiveLines = pdf.splitTextToSize(inputs.verdict.directive, W - 2 * M);
  pdf.text(directiveLines, M, M + 36);

  // ---- Flags ----
  if (inputs.verdict.flags.length > 0) {
    let fx = M;
    let fy = M + 36 + directiveLines.length * 4.4 + 4;
    pdf.setFont("courier", "bold");
    pdf.setFontSize(6.5);
    inputs.verdict.flags.forEach((flag) => {
      const isDanger = flag.includes("critical") || flag.includes("bleeding") || flag.includes("synthetic");
      const txt = flag.toUpperCase();
      const tw = pdf.getTextWidth(txt) + 4;
      if (fx + tw > W - M) {
        fx = M;
        fy += 5;
      }
      pdf.setFillColor(isDanger ? "#3a0a0a" : "#2a230d");
      pdf.setDrawColor(isDanger ? RED : GOLD);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(fx, fy - 3, tw, 4, 1.2, 1.2, "FD");
      pdf.setTextColor(isDanger ? "#ff8a72" : GOLD_BRIGHT);
      pdf.text(txt, fx + 2, fy);
      fx += tw + 2;
    });
  }

  // ---- Signal table ----
  const tableY = M + 70;
  pdf.setDrawColor(GOLD);
  pdf.setLineWidth(0.2);
  pdf.line(M, tableY - 4, W - M, tableY - 4);

  pdf.setFont("times", "italic");
  pdf.setFontSize(11);
  pdf.setTextColor(GOLD);
  pdf.text("Sensor Telemetry", M, tableY);

  const rows: Array<[string, string]> = [
    ["Heart Rate", `${inputs.heartRate.toFixed(1)} bpm`],
    ["HRV (SDNN)", `${inputs.hrv.toFixed(1)} ms`],
    ["PPG amplitude", inputs.ppgAmplitude.toFixed(2)],
    ["Vascular Age (APG)", `${inputs.vascularAge} y · AGI ${inputs.agingIndex.toFixed(2)}`],
    ["Vascular asymmetry", `${(inputs.vascularAsymmetry * 100).toFixed(0)} %`],
    ["Lectin signature", `${(inputs.lectinSignature * 100).toFixed(0)} %`],
    ["Sub-50 Hz energy", `${(inputs.subSonicRatio * 100).toFixed(0)} %`],
    ["Acoustic state", `${inputs.acousticState} · ${inputs.acousticBpm.toFixed(1)} ev/min`],
    ["EMF magnitude", `${inputs.emfMicrotesla.toFixed(1)} µT · ${inputs.emfSpikes} spikes >65µT`],
    ["Sovereign ABO", inputs.bloodGroup],
  ];

  pdf.setFont("courier", "normal");
  pdf.setFontSize(8.5);
  let ry = tableY + 6;
  rows.forEach(([k, v], i) => {
    if (i % 2 === 0) {
      pdf.setFillColor("#1a1a22");
      pdf.rect(M, ry - 3.4, W - 2 * M, 4.6, "F");
    }
    pdf.setTextColor(MUTED);
    pdf.text(k, M + 1.5, ry);
    pdf.setTextColor(GOLD_BRIGHT);
    pdf.text(v, W - M - 1.5, ry, { align: "right" });
    ry += 4.6;
  });

  // ---- QR code ----
  const qrTarget = `${inputs.backendUrl}/api/ledger/${inputs.scanId}`;
  const qrDataUrl = await QRCode.toDataURL(qrTarget, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
    color: { dark: "#ffd966", light: "#0a0a0d" },
  });

  const qrSize = 30;
  const qrX = W / 2 - qrSize / 2;
  const qrY = H - M - qrSize - 8;
  // gold frame around QR
  pdf.setDrawColor(GOLD);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(qrX - 1.4, qrY - 1.4, qrSize + 2.8, qrSize + 2.8, 1, 1, "S");
  pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  pdf.setFont("courier", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(MUTED);
  pdf.text("Scan for raw sensor ledger", W / 2, qrY + qrSize + 3.5, { align: "center" });
  pdf.setTextColor(GOLD);
  pdf.text(qrTarget, W / 2, qrY + qrSize + 6.5, { align: "center" });

  // ---- Footer ----
  pdf.setDrawColor(GOLD);
  pdf.setLineWidth(0.2);
  pdf.line(M, H - M - 2, W - M, H - M - 2);
  pdf.setFont("times", "italic");
  pdf.setFontSize(7);
  pdf.setTextColor(MUTED);
  pdf.text("Sovereign · not a substitute for clinical diagnosis · hand to attending medic", W / 2, H - M + 1, {
    align: "center",
  });

  return pdf;
}

export async function downloadBioracleReport(inputs: PDFInputs): Promise<void> {
  const pdf = await generateBioracleReport(inputs);
  pdf.save(`bioracle-${inputs.scanId.slice(0, 8)}-${inputs.verdict.level}.pdf`);
}

export async function getBioracleReportBlob(inputs: PDFInputs): Promise<Blob> {
  const pdf = await generateBioracleReport(inputs);
  return pdf.output("blob");
}
