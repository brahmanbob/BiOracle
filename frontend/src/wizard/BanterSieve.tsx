import React, { useState } from "react";
import type { SieveAnswers, SieveContext } from "@/lib/banterSieve";
import { evaluateSieve } from "@/lib/banterSieve";

interface Props {
  vitals?: { hr: number; bp: number; asymmetry: number };
  onComplete: (ctx: SieveContext) => void;
  onSkip: () => void;
  accent: string;
}

const DEFAULTS: SieveAnswers = {
  coffeeCups: 1,
  hoursSlept: 7,
  stress: 3,
  lastMealHrs: 3,
  hydrationGlasses: 4,
  meds: "",
  acute: false,
};

const BanterSieve: React.FC<Props> = ({ vitals, onComplete, onSkip, accent }) => {
  const [a, setA] = useState<SieveAnswers>(DEFAULTS);

  const submit = () => {
    const ctx = evaluateSieve(a, vitals);
    onComplete(ctx);
  };

  return (
    <div className="bo-sieve" style={{ ["--accent" as any]: accent }} data-testid="banter-sieve">
      <div className="head">
        <span className="ribbon">◈ THE SIEVE</span>
        <h3>Before we point at a doctor or a herb — context.</h3>
        <p>Five quick questions. Skip if you must. We'd rather know than guess.</p>
      </div>

      <div className="grid">
        <Field label="Coffee (cups, last 6 h)">
          <input
            type="range" min={0} max={6} step={1}
            value={a.coffeeCups}
            onChange={(e) => setA({ ...a, coffeeCups: Number(e.target.value) })}
            data-testid="sieve-coffee"
          />
          <span className="num">{a.coffeeCups}</span>
        </Field>

        <Field label="Sleep last night (hours)">
          <input
            type="range" min={0} max={12} step={0.5}
            value={a.hoursSlept}
            onChange={(e) => setA({ ...a, hoursSlept: Number(e.target.value) })}
            data-testid="sieve-sleep"
          />
          <span className="num">{a.hoursSlept}</span>
        </Field>

        <Field label="Stress (1 calm · 5 burning)">
          <input
            type="range" min={1} max={5} step={1}
            value={a.stress}
            onChange={(e) => setA({ ...a, stress: Number(e.target.value) as any })}
            data-testid="sieve-stress"
          />
          <span className="num">{a.stress}</span>
        </Field>

        <Field label="Hours since last meal">
          <input
            type="range" min={0} max={16} step={0.5}
            value={a.lastMealHrs}
            onChange={(e) => setA({ ...a, lastMealHrs: Number(e.target.value) })}
            data-testid="sieve-meal"
          />
          <span className="num">{a.lastMealHrs} h</span>
        </Field>

        <Field label="Water (glasses today)">
          <input
            type="range" min={0} max={12} step={1}
            value={a.hydrationGlasses}
            onChange={(e) => setA({ ...a, hydrationGlasses: Number(e.target.value) })}
            data-testid="sieve-water"
          />
          <span className="num">{a.hydrationGlasses}</span>
        </Field>

        <Field label="Active medications (free text)">
          <textarea
            rows={2}
            placeholder="e.g. metformin, low-dose aspirin"
            value={a.meds}
            onChange={(e) => setA({ ...a, meds: e.target.value })}
            data-testid="sieve-meds"
          />
        </Field>

        <label className="toggle" data-testid="sieve-acute-label">
          <input
            type="checkbox"
            checked={a.acute}
            onChange={(e) => setA({ ...a, acute: e.target.checked })}
            data-testid="sieve-acute"
          />
          <span>I am in active pain or distress <em>right now</em>.</span>
        </label>
      </div>

      <div className="ctl">
        <button className="bo-glass-btn" onClick={onSkip} data-testid="btn-sieve-skip">Skip the Sieve</button>
        <button className="bo-glass-btn primary" onClick={submit} data-testid="btn-sieve-submit">Filter & Compute</button>
      </div>
    </div>
  );
};

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    <div className="row">{children}</div>
  </div>
);

export default BanterSieve;
