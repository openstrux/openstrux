#!/usr/bin/env node --experimental-strip-types
/**
 * score-certification.ts — Score a step 2 Art. 30 certification result.
 *
 * Usage:
 *   node --experimental-strip-types score-certification.ts \
 *     --result <path-to-art30-output.json> \
 *     --reference <path-to-art30-reference.json> \
 *     --response <path-to-step-2-response.txt> \   # for queryability heuristic
 *     --out <path-to-scoring.json>                 # default: stdout
 *
 * Outputs scoring.json with three-dimensional scores and weighted total:
 *   completeness  (40%): proportion of required Art. 30 fields populated per activity
 *   accuracy      (40%): correctness compared to reference record (with synonym matching)
 *   queryability  (20%): heuristic — did the LLM use structural metadata or scan code
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const resultFile    = arg("--result");
const referenceFile = arg("--reference");
const responseFile  = arg("--response");
const outFile       = arg("--out");

if (!resultFile || !referenceFile) {
  console.error(
    "Usage: score-certification.ts --result <art30.json> --reference <reference.json> " +
    "[--response <response.txt>] [--out <scoring.json>]",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessingActivity {
  controller?:             string;
  dpo?:                    string | null;
  purpose?:                string;
  lawfulBasis?:            string;
  dataSubjectCategories?:  string[];
  personalDataCategories?: string[];
  recipients?:             string[];
  retention?:              string;
  technicalMeasures?:      string[];
  dpiaRef?:                string | null;
}

interface Art30Record {
  processingActivities: ProcessingActivity[];
}

interface ScoringResult {
  completeness:      number;  // 0–100
  accuracy:          number;  // 0–100
  queryability:      number;  // 0–100
  weightedTotal:     number;  // 0–100 (40/40/20 weights)
  details: {
    completenessPerActivity: number[];
    accuracyPerActivity:     number[];
    queryabilitySignals:     string[];
    missingFields:           string[][];
    synonymMatchedFields:    string[][];
  };
}

// ---------------------------------------------------------------------------
// Synonym matching — case-insensitive, normalised whitespace
// ---------------------------------------------------------------------------

const SYNONYMS: [string, string[]][] = [
  ["grant application processing", ["processing grant applications", "processing of grant applications", "application processing"]],
  ["grant eligibility assessment", ["eligibility evaluation", "evaluating eligibility", "eligibility check", "assessment of eligibility"]],
  ["contract",           ["contractual obligation", "performance of a contract"]],
  ["legitimate interest", ["legitimate interests"]],
  ["grant applicants",   ["applicants", "proposal submitters"]],
  ["pseudonymization",   ["pseudonymisation", "anonymization", "anonymisation"]],
  ["role-based access control", ["rbac", "role based access", "access control"]],
  ["audit logging",      ["audit log", "audit trail", "event logging"]],
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function synonymMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  for (const [canonical, alts] of SYNONYMS) {
    const allForms = [normalize(canonical), ...alts.map(normalize)];
    if (allForms.some((f) => na.includes(f) || f.includes(na)) &&
        allForms.some((f) => nb.includes(f) || f.includes(nb))) {
      return true;
    }
  }
  return false;
}

function arrayMatch(generated: string[] | undefined, reference: string[] | undefined): number {
  if (!reference || reference.length === 0) return 1;
  if (!generated  || generated.length  === 0) return 0;
  let hits = 0;
  for (const refItem of reference) {
    if (generated.some((g) => synonymMatch(g, refItem))) hits++;
  }
  return hits / reference.length;
}

// ---------------------------------------------------------------------------
// Completeness scorer
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof ProcessingActivity)[] = [
  "controller",
  "purpose",
  "lawfulBasis",
  "dataSubjectCategories",
  "personalDataCategories",
  "recipients",
  "retention",
  "technicalMeasures",
];

function scoreCompleteness(activity: ProcessingActivity): { score: number; missing: string[] } {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const v = activity[field];
    const empty = v === undefined || v === null || v === "" ||
                  (Array.isArray(v) && v.length === 0);
    if (empty) missing.push(field);
  }
  return {
    score:   Math.round((1 - missing.length / REQUIRED_FIELDS.length) * 100),
    missing,
  };
}

// ---------------------------------------------------------------------------
// Accuracy scorer (field-by-field comparison with synonym matching)
// ---------------------------------------------------------------------------

function scoreAccuracy(
  generated: ProcessingActivity,
  reference: ProcessingActivity,
): { score: number; synonymMatched: string[] } {
  const synonymMatched: string[] = [];
  const fieldScores: number[] = [];

  // String fields: synonym match
  for (const field of ["controller", "dpo", "purpose", "lawfulBasis", "retention"] as const) {
    const g = generated[field];
    const r = reference[field];
    if (!r) continue;
    if (!g) { fieldScores.push(0); continue; }
    const matched = synonymMatch(g, r);
    fieldScores.push(matched ? 1 : 0);
    if (matched && normalize(g) !== normalize(r)) synonymMatched.push(field);
  }

  // Array fields: proportion of reference items matched
  for (const field of [
    "dataSubjectCategories",
    "personalDataCategories",
    "technicalMeasures",
    "recipients",
  ] as const) {
    fieldScores.push(arrayMatch(generated[field], reference[field]));
  }

  const avg = fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length;
  return { score: Math.round(avg * 100), synonymMatched };
}

// ---------------------------------------------------------------------------
// Queryability scorer (heuristic based on response text)
// ---------------------------------------------------------------------------

const STRUCTURAL_SIGNALS = [
  ".strux",
  "@dp",
  "@access",
  "@type",
  "privacyRecords",
  "manifest.json",
  "strux.context",
  "FieldClassification",
];

const CODE_SIGNALS = [
  "prisma/schema.prisma",
  "submissionService.ts",
  "eligibilityService.ts",
  "src/policies",
  "grep",
  "searched the code",
  "looking at the TypeScript",
  "reading the source",
];

function scoreQueryability(responseText: string | undefined): { score: number; signals: string[] } {
  if (!responseText) return { score: 50, signals: ["no response text — defaulting to 50"] };

  const lc = responseText.toLowerCase();
  const signals: string[] = [];
  let structuralHits = 0;
  let codeHits       = 0;

  for (const s of STRUCTURAL_SIGNALS) {
    if (lc.includes(s.toLowerCase())) {
      signals.push(`structural: ${s}`);
      structuralHits++;
    }
  }
  for (const s of CODE_SIGNALS) {
    if (lc.includes(s.toLowerCase())) {
      signals.push(`code-scan: ${s}`);
      codeHits++;
    }
  }

  if (structuralHits === 0 && codeHits === 0) return { score: 50, signals: ["no signals found"] };

  const total  = structuralHits + codeHits;
  const ratio  = structuralHits / total;

  // 0 structural → 20–35; all structural → 90–100
  const score = Math.round(20 + ratio * 75);
  return { score: Math.min(100, score), signals };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const generated: Art30Record = JSON.parse(readFileSync(resultFile,    "utf-8"));
const reference: Art30Record = JSON.parse(readFileSync(referenceFile, "utf-8"));
const responseText = responseFile && existsSync(responseFile)
  ? readFileSync(responseFile, "utf-8")
  : undefined;

const completenessPerActivity: number[] = [];
const accuracyPerActivity:     number[] = [];
const missingFields:           string[][] = [];
const synonymMatchedFields:    string[][] = [];

for (let i = 0; i < generated.processingActivities.length; i++) {
  const gen = generated.processingActivities[i];
  const ref = reference.processingActivities[i] ?? reference.processingActivities[0];

  const comp = scoreCompleteness(gen);
  completenessPerActivity.push(comp.score);
  missingFields.push(comp.missing);

  const acc = scoreAccuracy(gen, ref);
  accuracyPerActivity.push(acc.score);
  synonymMatchedFields.push(acc.synonymMatched);
}

const completeness = Math.round(
  completenessPerActivity.reduce((a, b) => a + b, 0) / Math.max(1, completenessPerActivity.length),
);
const accuracy = Math.round(
  accuracyPerActivity.reduce((a, b) => a + b, 0) / Math.max(1, accuracyPerActivity.length),
);

const { score: queryability, signals: queryabilitySignals } = scoreQueryability(responseText);

const weightedTotal = Math.round(completeness * 0.4 + accuracy * 0.4 + queryability * 0.2);

const result: ScoringResult = {
  completeness,
  accuracy,
  queryability,
  weightedTotal,
  details: {
    completenessPerActivity,
    accuracyPerActivity,
    queryabilitySignals,
    missingFields,
    synonymMatchedFields,
  },
};

const json = JSON.stringify(result, null, 2) + "\n";
if (outFile) {
  writeFileSync(outFile, json, "utf-8");
  console.log(`[score-certification] Wrote ${outFile}`);
  console.log(`  completeness:  ${completeness}`);
  console.log(`  accuracy:      ${accuracy}`);
  console.log(`  queryability:  ${queryability}`);
  console.log(`  weightedTotal: ${weightedTotal}`);
} else {
  process.stdout.write(json);
}
