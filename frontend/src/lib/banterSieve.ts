/**
 * banterSieve.ts
 * ----------------------------------------------------------------
 *  The Sieve — pre-filter for the Remedy Engine.
 *
 *  Purpose: before BiOracle tells a Carrier to "see a doctor" or
 *  "take Ashwagandha", it asks the basics that explain 80 % of false
 *  alarms — caffeine, sleep debt, stress, hydration, last meal.
 *
 *  Output: a `SieveContext` object the RemedyEngine can consume to
 *    • DEMOTE elevated bands when the cause is benign-explained
 *      (e.g. HR up + 3 cups coffee → "caffeine-explained")
 *    • PROMOTE concerns when context amplifies risk
 *      (e.g. low sleep + high stress + chest pulse asymmetry)
 *    • ATTACH human-readable explanations to each downgrade.
 * ----------------------------------------------------------------
 */

export interface SieveAnswers {
  coffeeCups: number;          // cups in last 6 h (0..6)
  hoursSlept: number;          // last 24 h
  stress: 1 | 2 | 3 | 4 | 5;   // self-rated
  lastMealHrs: number;         // hours since last meal
  hydrationGlasses: number;    // glasses of water today
  meds: string;                // free-text (lowercased on parse)
  acute: boolean;              // "Are you in active pain right now?" hard override
}

export interface SieveContext {
  answers: SieveAnswers;
  explanations: string[];      // sentences to inject into banter
  demoteUrgency: boolean;      // RemedyEngine should downgrade urgency by one band
  promoteUrgency: boolean;     // RemedyEngine should upgrade urgency
  filterOut: string[];         // action substrings to remove
  filterIn: string[];          // action substrings to require / prefer
  doctorAdvisable: boolean;    // gate for "see a doctor" suggestion
  supplementAdvisable: boolean;// gate for "take supplement X" suggestion
}

const SEEN_MEDS_BLOCKERS = ["warfarin", "aspirin", "ssri", "lithium", "beta blocker", "beta-blocker", "metformin"];

export function evaluateSieve(answers: SieveAnswers, vitals?: { hr: number; bp: number; asymmetry: number }): SieveContext {
  const expl: string[] = [];
  const filterOut: string[] = [];
  const filterIn: string[] = [];
  let demote = false;
  let promote = false;

  // Caffeine context
  if (answers.coffeeCups >= 2) {
    expl.push(`Caffeine load: ${answers.coffeeCups} cups in 6 h — expect HR / BP +5..15 bpm/mmHg of baseline.`);
    if (vitals && vitals.hr > 90 && vitals.hr < 110) {
      demote = true;
      filterOut.push("ashwagandha", "anxiety", "doctor", "evaluation");
      expl.push("HR elevation is caffeine-consistent. We are not flagging it as cardiac until coffee drops out (~4 h).");
    }
  }

  // Sleep debt
  if (answers.hoursSlept < 5) {
    expl.push(`Sleep debt: ${answers.hoursSlept} h. HRV is normally suppressed in this state.`);
    filterIn.push("sleep");
    promote = answers.hoursSlept < 4;
  } else if (answers.hoursSlept >= 7) {
    expl.push(`Sleep solid (${answers.hoursSlept} h). The system has had time to repair.`);
  }

  // Stress
  if (answers.stress >= 4) {
    expl.push(`Self-reported stress is ${answers.stress}/5 — sympathetic tone elevated.`);
    filterIn.push("breath", "vagal", "walk");
    if (answers.stress === 5 && answers.hoursSlept < 6) promote = true;
  } else if (answers.stress <= 2) {
    expl.push(`Stress is low (${answers.stress}/5).`);
  }

  // Hydration
  if (answers.hydrationGlasses < 3) {
    expl.push(`Hydration thin (${answers.hydrationGlasses} glasses). HRV and BP may read low.`);
    filterIn.push("water", "electrolyte");
  }

  // Fasting / last meal
  if (answers.lastMealHrs > 6) {
    expl.push(`Fasted ${answers.lastMealHrs} h — expect mild HR variability, lower glucose, possible vagal drops.`);
  }

  // Meds
  const meds = (answers.meds || "").toLowerCase();
  const blockers = SEEN_MEDS_BLOCKERS.filter((m) => meds.includes(m));
  if (blockers.length) {
    expl.push(`Active medication noted (${blockers.join(", ")}). Hard gate on supplement suggestions.`);
    filterOut.push("supplement", "ashwagandha", "milk thistle", "magnesium", "elderberry");
  }

  // Acute pain — hard promotion
  if (answers.acute) {
    expl.push("You reported active pain — we widen the lens and recommend a witness call.");
    promote = true;
  }

  // Decision gates
  const supplementAdvisable = blockers.length === 0 && !answers.acute;
  // Doctor advisable when: promote == true, OR vitals genuinely outside benign band AND not benign-explained
  const vitalsTroubling =
    vitals !== undefined &&
    (vitals.hr > 110 || vitals.bp > 160 || vitals.asymmetry > 0.6);
  const doctorAdvisable = (promote && !demote) || (vitalsTroubling && !demote);

  return {
    answers,
    explanations: expl,
    demoteUrgency: demote && !promote,
    promoteUrgency: promote,
    filterOut,
    filterIn,
    doctorAdvisable,
    supplementAdvisable,
  };
}
