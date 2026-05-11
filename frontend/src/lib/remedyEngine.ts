/**
 * remedyEngine.ts
 * ----------------------------------------------------------------
 * Deterministic, sovereign remedy generator.
 *  No LLM. No network. No telemetry.
 *  Pure function of:
 *    • Retinol (sclera) reading
 *    • Tongue reading
 *    • Blood/PPG triage verdict + HR/HRV/asymmetry/vascular age
 *    • User-typed banter (free text symptoms)
 * → a Remedy Card with directive, top concern, three actions, ritual.
 * ----------------------------------------------------------------
 */
import type { ScleraReading, TongueReading } from "@/lib/imageAnalysis";
import type { TriageVerdict } from "@/SovereignLogic";

export type Profile = "sovereign" | "cruise" | "beauty";

export interface RitualScans {
  sclera: ScleraReading | null;
  tongue: TongueReading | null;
  verdict: TriageVerdict | null;
  heartRate: number;
  hrv: number;
  vascularAge: number;
  vascularAsymmetry: number;
  lectinSignature: number;
  syntheticInterference: boolean;
  /** profile selects banter voice; defaults to sovereign */
  profile?: Profile;
}

export interface RemedyCard {
  /** A short banter-voice opening line (the BiOracle's persona). */
  banter: string;
  /** Top concern across all signals. */
  topConcern: string;
  /** Heat band: stable / watch / urgent. */
  band: "stable" | "watch" | "urgent";
  /** 3 actionable items, ordered by priority. */
  actions: { kind: "food" | "herb" | "movement" | "rest" | "tactic"; text: string }[];
  /** One sovereign ritual to anchor the day. */
  ritual: string;
  /** Detected user-asked questions (echoed for transparency). */
  echoedSymptoms: string[];
  /** Flags this remedy is responding to. */
  flags: string[];
}

const KEYWORDS: Record<string, string[]> = {
  fatigue: ["tired", "exhausted", "fatigue", "drained", "no energy", "sleepy"],
  pain: ["pain", "hurts", "ache", "sore", "throbbing"],
  headache: ["headache", "migraine", "head"],
  digestion: ["bloated", "bloating", "gut", "stomach", "indigestion", "cramp", "gas"],
  sleep: ["sleep", "insomnia", "awake", "restless"],
  anxiety: ["anxious", "panic", "nervous", "racing", "stress"],
  bleeding: ["bleed", "blood", "hemorrhage", "wound", "cut", "spotting"],
  fever: ["fever", "feverish", "hot", "burning up"],
  vision: ["vision", "blurry", "eyes", "sight"],
};

function detectSymptoms(banter: string): string[] {
  const txt = (banter || "").toLowerCase();
  const found: string[] = [];
  for (const [tag, kws] of Object.entries(KEYWORDS)) {
    if (kws.some((k) => txt.includes(k))) found.push(tag);
  }
  return found;
}

export function generateRemedy(scans: RitualScans, banterText: string): RemedyCard {
  const symptoms = detectSymptoms(banterText);
  const flags: string[] = [];
  const actions: RemedyCard["actions"] = [];

  // ---- Top-line band determination ----
  let band: RemedyCard["band"] = "stable";
  let topConcern = "All sovereign signals within range.";

  if (scans.verdict?.critical) {
    band = "urgent";
    flags.push(...scans.verdict.flags);
    if (scans.verdict.flags.includes("internal-bleeding-suspect")) {
      topConcern = "Vascular asymmetry suggests internal bleeding — clinical evaluation now.";
    } else {
      topConcern = "Lectin spike critical — stop ingestion, hydrate, seek evaluation.";
    }
  } else if (scans.verdict?.level === "elevated" || scans.lectinSignature > 0.5 || scans.vascularAsymmetry > 0.5) {
    band = "watch";
    topConcern = "Multiple signals trending up — re-scan in 15 min.";
  } else if (scans.sclera?.indicator === "jaundiced") {
    band = "watch";
    topConcern = "Sclera yellow shift — liver / β-carotene review.";
    flags.push("sclera-jaundice");
  } else if (scans.tongue?.state === "heat") {
    band = "watch";
    topConcern = "Tongue heat-pattern — internal inflammation likely.";
    flags.push("tongue-heat");
  } else if (scans.tongue?.state === "qi-deficient") {
    topConcern = "Tongue qi-deficient — replenishment indicated.";
    flags.push("tongue-qi-deficient");
  } else if (scans.tongue?.state === "stasis") {
    band = "watch";
    topConcern = "Tongue stasis (purple) — circulation work indicated.";
    flags.push("tongue-stasis");
  }

  // ---- Build action stack ----
  // Vascular age vs chronological deviation
  if (scans.vascularAge && scans.vascularAge > 50) {
    actions.push({
      kind: "movement",
      text: `APG vascular age ${scans.vascularAge} y — daily 12-min brisk walk + 4-7-8 breath rounds.`,
    });
  }
  // HRV low
  if (scans.hrv && scans.hrv < 30) {
    actions.push({
      kind: "rest",
      text: "HRV low — protect sleep window, no caffeine after 13:00, magnesium glycinate 300mg evening.",
    });
  }
  // Sclera signals
  if (scans.sclera?.indicator === "jaundiced") {
    actions.push({ kind: "food", text: "Beet + carrot + ginger juice 200ml AM; halve seed-oil intake 3 days." });
    actions.push({ kind: "herb", text: "Milk thistle 200mg w/ breakfast for 1 week, then reassess sclera." });
  } else if (scans.sclera?.indicator === "irritated") {
    actions.push({ kind: "tactic", text: "Eye-rinse with saline; 20-20-20 screen rule; check pollen / allergen exposure." });
  }
  // Tongue signals
  if (scans.tongue?.state === "heat") {
    actions.push({ kind: "food", text: "Mung bean soup, cucumber, watermelon; avoid alcohol & fried foods 48h." });
  } else if (scans.tongue?.state === "qi-deficient") {
    actions.push({ kind: "food", text: "Bone broth + slow-cooked grains; iron-rich (lentils, liver) + B-12 review." });
    actions.push({ kind: "herb", text: "Astragalus tea 2× day for 1 week." });
  } else if (scans.tongue?.state === "stasis") {
    actions.push({ kind: "movement", text: "Light cardio 20min + warming spices (cinnamon, cardamom)." });
  } else if (scans.tongue?.state === "damp-heat") {
    actions.push({ kind: "food", text: "Drop refined sugar 72h; bitter greens (rocket, dandelion); barley water." });
  }
  // Lectin signature
  if (scans.lectinSignature > 0.5) {
    actions.push({
      kind: "food",
      text: "Trial 72h lectin-light: skip nightshades + raw legumes; pressure-cook beans only.",
    });
  }
  // Symptom-driven additions
  if (symptoms.includes("sleep")) {
    actions.push({ kind: "tactic", text: "Sleep stack: no screens 60min before, room <19 °C, glycine 3g." });
  }
  if (symptoms.includes("anxiety")) {
    actions.push({ kind: "tactic", text: "4-7-8 breath × 4 rounds; cold water on wrists; L-theanine 200mg." });
  }
  if (symptoms.includes("headache")) {
    actions.push({
      kind: "tactic",
      text: "Hydrate 500ml + electrolytes; check jaw clench; magnesium glycinate 300mg.",
    });
  }
  if (symptoms.includes("digestion")) {
    actions.push({
      kind: "food",
      text: "Bone broth + cooked white rice today; avoid raw veg until tongue normalises.",
    });
  }
  if (symptoms.includes("bleeding")) {
    band = "urgent";
    actions.unshift({
      kind: "tactic",
      text: "Stabilise + photograph the site, count pulses for 60s, hand the medic PDF.",
    });
    flags.push("user-reported-bleeding");
  }
  if (symptoms.includes("fever")) {
    actions.push({ kind: "rest", text: "Hydrate 2L w/ electrolytes; willow / elderberry; rest 48h." });
  }
  if (symptoms.includes("vision")) {
    actions.push({ kind: "tactic", text: "Re-run the Retinol scan in natural light; if persistent → clinical eye exam." });
  }
  if (scans.syntheticInterference) {
    actions.push({
      kind: "tactic",
      text: "Walk 5m from current EMF source, re-scan vitals away from the device used as transmitter.",
    });
  }

  // ---- Dedup + trim to 3 ----
  const seen = new Set<string>();
  const top3 = actions.filter((a) => {
    const k = `${a.kind}:${a.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 3);

  // Fallback if everything is fine
  if (top3.length === 0) {
    top3.push(
      { kind: "movement", text: "20-minute walk in sunlight before 11 AM." },
      { kind: "food", text: "One bitter green + one fermented food today." },
      { kind: "rest", text: "Lights out by 22:30 — let the vagus do the housekeeping." },
    );
  }

  // ---- Ritual line ----
  const ritualPool = [
    "Stand barefoot on soil 5 min at sunrise. Breathe through the nose only.",
    "Cold water on face + wrists; speak your day's intent out loud.",
    "Hold a slow exhale 8s × 6 rounds. Notice where the body lets go first.",
    "One cup of warm water with lemon before any input.",
    "Walk to a horizon you cannot reach. Return when ready.",
  ];
  const ritual = ritualPool[Math.floor(Date.now() / 86400000) % ritualPool.length];

  // ---- Banter voice (profile-aware) ----
  const profile: Profile = scans.profile ?? "sovereign";
  const banter = bantersByProfile(profile, band);

  return {
    banter,
    topConcern,
    band,
    actions: top3,
    ritual,
    echoedSymptoms: symptoms,
    flags,
  };
}

function bantersByProfile(profile: Profile, band: RemedyCard["band"]): string {
  const lib: Record<Profile, Record<RemedyCard["band"], string>> = {
    sovereign: {
      urgent: "Carrier — I see it. The signal is loud. We move.",
      watch:  "I hear the system whispering. Not loud yet. Worth catching now.",
      stable: "Body sounds clean today. We tune, we don't react.",
    },
    cruise: {
      urgent: "Hard stop. CNS is red. Rack the bar — recovery first, ego second.",
      watch:  "Heads up — system's at 70 %. Drop intensity 1 notch, finish strong.",
      stable: "Green light. Send the next set. Make it crisp.",
    },
    beauty: {
      urgent: "Pause, love. The skin is telling us something — let's listen before we layer.",
      watch:  "A whisper from the dermis. Hydrate, breathe, we adjust the ritual tonight.",
      stable: "You're luminous today. Maintain the cadence — sleep, water, sunlight.",
    },
  };
  return lib[profile][band];
}
