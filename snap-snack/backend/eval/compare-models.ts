// Snap Snack photo-model test: runs every photo in meals.csv through Claude Opus 5.5, Sonnet 5.5 and Haiku 5.5
// with the exact prompt the app uses, then compares each answer with the weighed truth.
//
//   cd snap-snack/backend/eval && npm install && npx tsx compare-models.ts
//
// Needs ANTHROPIC_API_KEY in the environment (or an `ant auth login` profile). Writes results.csv and prints a summary.
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { analyzePhoto, costUsd, MODELS, type Model } from "../supabase/functions/_shared/nutrition.ts";

type Truth = { photo: string; cal: number; protein: number; carbs: number; fat: number; notes: string };

function readMeals(file: string): Truth[] {
  const [head, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",").map((c) => c.trim());
  return lines.filter((l) => l.trim()).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
    return { photo: row.photo, cal: +row.cal, protein: +row.protein, carbs: +row.carbs, fat: +row.fat, notes: row.notes ?? "" };
  });
}

const mediaType = (f: string) => (/\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg") as "image/jpeg";
const pct = (est: number, truth: number) => (truth > 0 ? Math.abs(est - truth) / truth * 100 : NaN);
const mean = (xs: number[]) => { const v = xs.filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
const median = (xs: number[]) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };

const meals = readMeals("meals.csv");
const client = new Anthropic();
const rows: string[] = ["photo,model,true_cal,est_cal,cal_err_pct,true_protein,est_protein,true_carbs,est_carbs,true_fat,est_fat,items,cost_usd,seconds,error"];
const summary: Record<string, { calErr: number[]; macroErr: number[]; cost: number[]; secs: number[]; fails: number }> = {};

for (const model of MODELS as readonly Model[]) {
  summary[model] = { calErr: [], macroErr: [], cost: [], secs: [], fails: 0 };
  for (const m of meals) {
    const file = path.join("photos", m.photo);
    try {
      const r = await analyzePhoto(client, model, fs.readFileSync(file).toString("base64"), mediaType(file));
      const t = r.result.items.reduce((a, i) => ({ cal: a.cal + i.cal, protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat }), { cal: 0, protein: 0, carbs: 0, fat: 0 });
      const cost = costUsd(model, r.inputTokens, r.outputTokens);
      const s = summary[model];
      s.calErr.push(pct(t.cal, m.cal));
      s.macroErr.push(mean([pct(t.protein, m.protein), pct(t.carbs, m.carbs), pct(t.fat, m.fat)]));
      s.cost.push(cost); s.secs.push(r.ms / 1000);
      rows.push([m.photo, model, m.cal, t.cal.toFixed(0), pct(t.cal, m.cal).toFixed(1), m.protein, t.protein.toFixed(1), m.carbs, t.carbs.toFixed(1), m.fat, t.fat.toFixed(1), r.result.items.length, cost.toFixed(5), (r.ms / 1000).toFixed(1), ""].join(","));
      console.log(`${model}  ${m.photo}: ${t.cal.toFixed(0)} kcal vs ${m.cal} true (${pct(t.cal, m.cal).toFixed(0)}% off), $${cost.toFixed(4)}`);
    } catch (err) {
      summary[model].fails++;
      const msg = err instanceof Anthropic.APIError ? `API ${err.status}` : err instanceof Error ? err.message : String(err);
      rows.push([m.photo, model, m.cal, "", "", "", "", "", "", "", "", "", "", "", JSON.stringify(msg)].join(","));
      console.log(`${model}  ${m.photo}: FAILED (${msg})`);
    }
  }
}

fs.writeFileSync("results.csv", rows.join("\n") + "\n");
console.log(`\n${meals.length} meals. Calorie error = how far the estimate is from the weighed value.\n`);
console.log("model              avg cal error  median cal error  avg macro error  cost/photo  seconds  failures");
for (const [model, s] of Object.entries(summary)) {
  console.log(`${model.padEnd(18)} ${mean(s.calErr).toFixed(1).padStart(12)}%  ${median(s.calErr).toFixed(1).padStart(15)}%  ${mean(s.macroErr).toFixed(1).padStart(14)}%  $${mean(s.cost).toFixed(4).padStart(9)}  ${mean(s.secs).toFixed(1).padStart(7)}  ${s.fails}`);
}
console.log("\nFull per-photo results: results.csv");
