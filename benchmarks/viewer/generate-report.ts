#!/usr/bin/env node --experimental-strip-types
/**
 * generate-report.ts — Generate a self-contained static HTML benchmark report.
 *
 * Reads benchmarks/viewer.config.json, loads results from each configured
 * use-case repo, and writes benchmarks/viewer/report.html with all data
 * embedded. No server needed — open report.html in any browser.
 *
 * Usage (from openstrux root or benchmarks/):
 *   node --experimental-strip-types benchmarks/viewer/generate-report.ts
 *
 * Requires: Node >= 24
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname      = dirname(fileURLToPath(import.meta.url));
const OPENSTRUX_ROOT = resolve(__dirname, "../..");   // benchmarks/viewer/ → openstrux/
const BENCHMARKS_DIR = resolve(__dirname, "..");       // benchmarks/viewer/ → benchmarks/
const VIEWER_CONFIG  = join(BENCHMARKS_DIR, "viewer.config.json");
const OUTPUT_HTML    = join(__dirname, "report.html");

// ---------------------------------------------------------------------------
// Types (inline — no zod needed for report generation)
// ---------------------------------------------------------------------------

interface ViewerEntry {
  name: string;
  resultsPath: string;
}

interface TestSuite {
  total: number;
  passed: number;
  failed: number;
}

interface BenchmarkResult {
  timestamp: string;
  path: "direct" | "openstrux";
  promptVersion: string;
  llm: string;
  generatedFileCount: number;
  totalLines: number;
  inputTokens?: number;
  outputTokens?: number;
  timeSeconds?: number;
  testSuites: { unit: TestSuite; integration?: TestSuite };
  testResults: string;
  note?: string;
  gaps?: string[];
  // legacy fields — tolerate old results
  manualTestResults?: string;
  resultNote?: string;
}

interface Row extends BenchmarkResult {
  useCase: string;
  runId: string;
}

// ---------------------------------------------------------------------------
// Load results
// ---------------------------------------------------------------------------

if (!existsSync(VIEWER_CONFIG)) {
  console.error(`Error: ${VIEWER_CONFIG} not found`);
  process.exit(1);
}

const config = JSON.parse(readFileSync(VIEWER_CONFIG, "utf-8")) as ViewerEntry[];
const rows: Row[] = [];
const errors: string[] = [];

for (const entry of config) {
  const resultsPath = resolve(OPENSTRUX_ROOT, entry.resultsPath);
  if (!existsSync(resultsPath)) {
    errors.push(`[${entry.name}] results path not found: ${resultsPath}`);
    continue;
  }

  for (const slug of readdirSync(resultsPath)) {
    const jsonPath = join(resultsPath, slug, "benchmark.json");
    if (!existsSync(jsonPath)) continue;
    try {
      const raw = JSON.parse(readFileSync(jsonPath, "utf-8")) as BenchmarkResult;
      rows.push({ ...raw, useCase: entry.name, runId: slug });
    } catch (e) {
      errors.push(`[${entry.name}/${slug}] parse error: ${e}`);
    }
  }
}

rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

if (errors.length) {
  console.warn("Warnings:");
  errors.forEach((e) => console.warn(" ", e));
}

console.log(`Loaded ${rows.length} result(s) from ${config.length} use-case(s).`);

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " "); }
  catch { return iso; }
}

function fmtTests(r: Row): string {
  if (r.testSuites?.unit) {
    const u = r.testSuites.unit;
    let s = `unit: ${u.passed}/${u.total}`;
    if (r.testSuites.integration) {
      const i = r.testSuites.integration;
      s += ` · integ: ${i.passed}/${i.total}`;
    }
    return s;
  }
  return r.testResults ?? r.manualTestResults ?? "—";
}

function fmtTokens(r: Row): string {
  if (r.inputTokens == null && r.outputTokens == null) return "—";
  const inTok  = r.inputTokens  != null ? `in:${(r.inputTokens  / 1000).toFixed(1)}k`  : "";
  const outTok = r.outputTokens != null ? `out:${(r.outputTokens / 1000).toFixed(1)}k` : "";
  return [inTok, outTok].filter(Boolean).join(" ");
}

function fmtTime(r: Row): string {
  if (r.timeSeconds == null) return "—";
  return r.timeSeconds >= 60
    ? `${(r.timeSeconds / 60).toFixed(1)}m`
    : `${r.timeSeconds.toFixed(1)}s`;
}

function fmtGaps(r: Row): string {
  if (!r.gaps?.length) return "—";
  return r.gaps.map((g) => `<li>${esc(g)}</li>`).join("");
}

const tableRows = rows.map((r, i) => `
  <tr class="${r.path === "openstrux" ? "path-openstrux" : "path-direct"}">
    <td>${esc(fmtDate(r.timestamp))}</td>
    <td>${esc(r.useCase)}</td>
    <td><span class="badge ${r.path === "openstrux" ? "badge-os" : "badge-direct"}">${esc(r.path)}</span></td>
    <td class="mono">${esc(r.llm)}</td>
    <td>${esc(r.generatedFileCount ?? "—")}</td>
    <td>${esc(r.totalLines ?? "—")}</td>
    <td class="mono small">${esc(fmtTokens(r))}</td>
    <td class="mono small">${esc(fmtTime(r))}</td>
    <td>${esc(fmtTests(r))}</td>
    <td class="mono small">${esc(r.promptVersion)}</td>
    <td>${esc(r.note ?? r.resultNote ?? "")}</td>
    <td>${r.gaps?.length ? `<ul class="gaps">${fmtGaps(r)}</ul>` : "—"}</td>
  </tr>`).join("\n");

const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Openstrux Benchmark Results</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a2e;
      background: #f8f9fc;
      margin: 0;
      padding: 2rem;
    }
    h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
    .subtitle { color: #666; margin: 0 0 1.5rem; font-size: 0.875rem; }
    .toolbar { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
    .toolbar label { font-size: 0.8rem; color: #555; }
    .toolbar select, .toolbar input {
      font-size: 0.8rem; padding: 0.3rem 0.5rem;
      border: 1px solid #ccc; border-radius: 4px; background: #fff;
    }
    .count { margin-left: auto; font-size: 0.8rem; color: #888; }
    table { width: 100%; border-collapse: collapse; background: #fff;
            border-radius: 8px; overflow: hidden;
            box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    thead th {
      background: #1a1a2e; color: #fff;
      padding: 0.6rem 0.75rem; text-align: left;
      font-size: 0.78rem; font-weight: 600; letter-spacing: 0.02em;
      white-space: nowrap; cursor: pointer; user-select: none;
    }
    thead th:hover { background: #2d2d4e; }
    thead th::after { content: " ↕"; opacity: 0.4; font-size: 0.7rem; }
    thead th.asc::after  { content: " ↑"; opacity: 1; }
    thead th.desc::after { content: " ↓"; opacity: 1; }
    tbody tr { border-bottom: 1px solid #eef0f4; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: #f0f4ff; }
    td { padding: 0.55rem 0.75rem; vertical-align: top; }
    .mono  { font-family: "SF Mono", Menlo, monospace; font-size: 0.8rem; }
    .small { font-size: 0.78rem; }
    .badge {
      display: inline-block; padding: 0.15rem 0.5rem;
      border-radius: 12px; font-size: 0.72rem; font-weight: 600;
    }
    .badge-os     { background: #e0f2e9; color: #276749; }
    .badge-direct { background: #e8f0fe; color: #1a56db; }
    .gaps { margin: 0; padding-left: 1rem; font-size: 0.78rem; color: #666; }
    .empty { text-align: center; padding: 3rem; color: #999; }
    footer { margin-top: 1.5rem; font-size: 0.75rem; color: #aaa; text-align: right; }
    @media (prefers-color-scheme: dark) {
      body { background: #12121e; color: #e0e0ef; }
      table { background: #1e1e30; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
      tbody tr { border-bottom-color: #2a2a40; }
      tbody tr:hover { background: #252540; }
      thead th { background: #0d0d1a; }
      .toolbar select, .toolbar input { background: #1e1e30; color: #e0e0ef; border-color: #3a3a55; }
    }
  </style>
</head>
<body>
  <h1>Openstrux Benchmark Results</h1>
  <p class="subtitle">Side-by-side comparison of generation paths across use cases. Generated ${generatedAt}.</p>

  <div class="toolbar">
    <label>Use case
      <select id="filterUC">
        <option value="">All</option>
        ${[...new Set(rows.map((r) => r.useCase))].map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("\n        ")}
      </select>
    </label>
    <label>Path
      <select id="filterPath">
        <option value="">All</option>
        <option value="direct">direct</option>
        <option value="openstrux">openstrux</option>
      </select>
    </label>
    <label>Search
      <input type="text" id="search" placeholder="model, note…" style="width:160px">
    </label>
    <span class="count" id="rowCount">${rows.length} run(s)</span>
  </div>

  ${rows.length === 0
    ? '<p class="empty">No benchmark runs recorded yet.</p>'
    : `<table id="resultsTable">
    <thead>
      <tr>
        <th data-col="0">Date</th>
        <th data-col="1">Use case</th>
        <th data-col="2">Path</th>
        <th data-col="3">Model</th>
        <th data-col="4">Files</th>
        <th data-col="5">Lines</th>
        <th data-col="6">Tokens</th>
        <th data-col="7">Time</th>
        <th data-col="8">Tests</th>
        <th data-col="9">Prompt rev</th>
        <th data-col="10">Note</th>
        <th data-col="11">Gaps</th>
      </tr>
    </thead>
    <tbody id="tbody">
      ${tableRows}
    </tbody>
  </table>`}

  <footer>Generated by <code>openstrux/benchmarks/viewer/generate-report.ts</code> · ${generatedAt}</footer>

  <script>
    // --------------- filter + search ---------------
    const tbody    = document.getElementById("tbody");
    const allRows  = tbody ? Array.from(tbody.querySelectorAll("tr")) : [];
    const countEl  = document.getElementById("rowCount");

    function applyFilters() {
      const uc     = document.getElementById("filterUC").value.toLowerCase();
      const path   = document.getElementById("filterPath").value.toLowerCase();
      const search = document.getElementById("search").value.toLowerCase();
      let visible  = 0;
      for (const row of allRows) {
        const cells = Array.from(row.querySelectorAll("td")).map(c => c.textContent.toLowerCase());
        const ucMatch   = !uc     || cells[1].includes(uc);
        const pathMatch = !path   || cells[2].includes(path);
        const srchMatch = !search || cells.some(c => c.includes(search));
        const show = ucMatch && pathMatch && srchMatch;
        row.style.display = show ? "" : "none";
        if (show) visible++;
      }
      if (countEl) countEl.textContent = visible + " run(s)";
    }

    document.getElementById("filterUC")  ?.addEventListener("change", applyFilters);
    document.getElementById("filterPath") ?.addEventListener("change", applyFilters);
    document.getElementById("search")    ?.addEventListener("input",  applyFilters);

    // --------------- column sort ---------------
    let sortCol = -1, sortAsc = true;
    document.querySelectorAll("thead th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        const col = parseInt(th.dataset.col);
        if (sortCol === col) sortAsc = !sortAsc; else { sortCol = col; sortAsc = true; }
        document.querySelectorAll("thead th").forEach(t => t.classList.remove("asc","desc"));
        th.classList.add(sortAsc ? "asc" : "desc");
        const rows = Array.from(tbody.querySelectorAll("tr"));
        rows.sort((a, b) => {
          const av = a.querySelectorAll("td")[col]?.textContent ?? "";
          const bv = b.querySelectorAll("td")[col]?.textContent ?? "";
          return sortAsc ? av.localeCompare(bv, undefined, {numeric:true})
                         : bv.localeCompare(av, undefined, {numeric:true});
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  </script>
</body>
</html>`;

writeFileSync(OUTPUT_HTML, html, "utf-8");
console.log(`Report written to: ${OUTPUT_HTML}`);
console.log(`Open in browser:   file://${OUTPUT_HTML}`);
