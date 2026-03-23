#!/usr/bin/env node --experimental-strip-types
/**
 * generate-api.ts — Benchmark generation via Anthropic Messages API.
 *
 * Assembles prompts + specs, calls the API with a clean context, parses fenced
 * code blocks, writes files at their natural in-tree paths, then runs unit tests.
 * If tests fail, sends a follow-up turn with the failure details and tries again,
 * up to maxRetries times (configured in benchmark.config.json or --max-retries).
 *
 * Usage:
 *   node --experimental-strip-types generate-api.ts \
 *     --path <direct|openstrux> \
 *     --model <model-id> \
 *     --worktree <abs-path> \
 *     --result-dir <abs-path> \
 *     [--max-retries <n>]
 *
 * Requires: ANTHROPIC_API_KEY env var, Node >= 24
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const pathArg = arg("--path") as "direct" | "openstrux" | undefined;
const modelArg  = arg("--model")    ?? "claude-sonnet-4-6";
const worktree  = resolve(arg("--worktree") ?? process.cwd());
const resultDir = arg("--result-dir") ? resolve(arg("--result-dir")!) : undefined;

if (!pathArg || !["direct", "openstrux"].includes(pathArg)) {
  console.error(
    "Usage: generate-api.ts --path <direct|openstrux> [--model <id>] [--worktree <dir>] [--result-dir <dir>] [--max-retries <n>]",
  );
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Error: ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// benchmark.config.json
// ---------------------------------------------------------------------------

interface BenchmarkConfig {
  paths: string[];
  specs: string[];
  tasks: string;
  testUnit: string;
  testIntegration: string;
  maxRetries?: number;
}

const configPath = join(worktree, "benchmark.config.json");
if (!existsSync(configPath)) {
  console.error(`Error: benchmark.config.json not found in ${worktree}`);
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, "utf-8")) as BenchmarkConfig;

// --max-retries CLI flag overrides benchmark.config.json, which overrides default (5)
const maxRetries = arg("--max-retries") !== undefined
  ? parseInt(arg("--max-retries")!, 10)
  : (config.maxRetries ?? 5);

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function read(relPath: string): string {
  const abs = join(worktree, relPath);
  if (!existsSync(abs)) throw new Error(`Missing file: ${relPath}`);
  return readFileSync(abs, "utf-8");
}

function section(heading: string, content: string): string {
  return `# ${heading}\n\n${content}`;
}

const parts: string[] = [
  section("System",                   read("prompts/shared/system.md")),
  section("Constraints",              read("prompts/shared/constraints.md")),
  ...config.specs.map((p) =>          section(p.split("/").pop()!.replace(/\.md$/, ""), read(p))),
  section("Tasks",                    read(config.tasks)),
  section("Generation Instructions",  read("prompts/shared/generate.md")),
  section("Path Instructions",        read(`prompts/${pathArg}/generate.md`)),
  section("Output Format",            read("prompts/shared/task-format.md")),
];

// Inject openstrux syntax reference for openstrux path if available
if (pathArg === "openstrux") {
  const syntaxRef = join(worktree, "../openstrux-spec/specs/core/syntax-reference.md");
  if (existsSync(syntaxRef)) {
    parts.splice(parts.length - 2, 0,
      section("Openstrux Language Reference", readFileSync(syntaxRef, "utf-8")));
    console.log("[generate-api] Included openstrux-spec/syntax-reference.md");
  } else {
    console.warn("[generate-api] Warning: openstrux-spec/syntax-reference.md not found — skipping");
  }
}

const initialPrompt = parts.join("\n\n---\n\n");
console.log(`[generate-api] path=${pathArg} model=${modelArg} maxRetries=${maxRetries}`);
console.log(`[generate-api] prompt: ${initialPrompt.length} chars / ~${Math.round(initialPrompt.length / 4)} tokens`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface APIResult {
  response: string;
  inputTokens: number;
  outputTokens: number;
  timeSeconds: number;
  files: Array<{ path: string; content: string }>;
  gaps: string[];
}

interface TestFailure {
  file: string;
  testName: string;
  error: string;
}

interface TestRunResult {
  total: number;
  passed: number;
  failed: number;
  failures: TestFailure[];
}

// ---------------------------------------------------------------------------
// API call (streaming SSE via native fetch)
// ---------------------------------------------------------------------------

async function callAPI(messages: Message[]): Promise<APIResult> {
  let response = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const startMs = Date.now();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      modelArg,
      max_tokens: 32000,
      stream:     true,
      messages,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const decoder = new TextDecoder();
  let buf = "";

  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const evt = JSON.parse(data) as {
          type: string;
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          usage?:   { input_tokens?: number; output_tokens?: number };
          delta?:   { type: string; text?: string };
        };
        if (evt.type === "message_start" && evt.message?.usage) {
          inputTokens = evt.message.usage.input_tokens ?? 0;
        }
        if (evt.type === "message_delta" && evt.usage) {
          outputTokens = evt.usage.output_tokens ?? 0;
        }
        if (evt.type === "content_block_delta" && evt.delta?.text) {
          process.stdout.write(evt.delta.text);
          response += evt.delta.text;
        }
      } catch { /* non-JSON SSE event lines — skip */ }
    }
  }

  const timeSeconds = (Date.now() - startMs) / 1000;

  return {
    response,
    inputTokens,
    outputTokens,
    timeSeconds,
    files: parseFencedBlocks(response),
    gaps:  parseGaps(response),
  };
}

// ---------------------------------------------------------------------------
// File writing
// ---------------------------------------------------------------------------

function writeFiles(files: Array<{ path: string; content: string }>): void {
  for (const { path, content } of files) {
    const abs = join(worktree, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
    console.log(`[generate-api]   wrote: ${path}`);
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

function runTests(attempt: number): TestRunResult {
  const testJsonPath = resultDir
    ? join(resultDir, `test-attempt-${attempt}.json`)
    : join(worktree, `.bench-test-${attempt}.json`);

  const testCmd = `${config.testUnit} --reporter=json --outputFile=${testJsonPath}`;

  try {
    execSync(testCmd, { cwd: worktree, stdio: "pipe" });
  } catch {
    // Non-zero exit when tests fail — expected, we'll read the JSON
  }

  if (!existsSync(testJsonPath)) {
    console.warn(`[generate-api] No test JSON at ${testJsonPath} — treating as 0/0`);
    return { total: 0, passed: 0, failed: 0, failures: [] };
  }

  // Vitest JSON reporter uses "assertionResults" and "name" (not Jest's "testResults"/"testFilePath")
  const data = JSON.parse(readFileSync(testJsonPath, "utf-8")) as {
    numTotalTests?: number;
    numPassedTests?: number;
    numFailedTests?: number;
    testResults?: Array<{
      name?: string;
      testFilePath?: string;
      assertionResults?: Array<{
        title?: string;
        ancestorTitles?: string[];
        status?: string;
        failureMessages?: string[];
      }>;
      testResults?: Array<{
        title?: string;
        ancestorTitles?: string[];
        status?: string;
        failureMessages?: string[];
      }>;
    }>;
  };

  const failures: TestFailure[] = [];

  for (const suite of data.testResults ?? []) {
    const rawPath = suite.name ?? suite.testFilePath ?? "";
    const shortPath = rawPath.replace(worktree + "/", "");
    const tests = suite.assertionResults ?? suite.testResults ?? [];
    for (const test of tests) {
      if (test.status === "failed") {
        const ancestors = test.ancestorTitles?.join(" > ") ?? "";
        const testName  = ancestors ? `${ancestors} > ${test.title ?? ""}` : (test.title ?? "");
        const firstLine = test.failureMessages?.[0]?.split("\n").find((l) => l.trim()) ?? "unknown error";
        failures.push({ file: shortPath, testName, error: firstLine.trim() });
      }
    }
  }

  return {
    total:   data.numTotalTests  ?? 0,
    passed:  data.numPassedTests ?? 0,
    failed:  data.numFailedTests ?? 0,
    failures,
  };
}

// ---------------------------------------------------------------------------
// Retry prompt builder
// ---------------------------------------------------------------------------

function buildRetryPrompt(result: TestRunResult, attempt: number): string {
  const byFile = new Map<string, TestFailure[]>();
  for (const f of result.failures) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file)!.push(f);
  }

  const failureLines: string[] = [];
  for (const [file, fileFailures] of byFile) {
    failureLines.push(`### ${file} (${fileFailures.length} failed)`);
    for (const f of fileFailures) {
      failureLines.push(`- **${f.testName}**`);
      failureLines.push(`  \`${f.error}\``);
    }
    failureLines.push("");
  }

  const template = read("prompts/shared/retry.md");
  return template
    .replace("{{passed}}", String(result.passed))
    .replace("{{total}}", String(result.total))
    .replace("{{attempt}}", String(attempt))
    .replace("{{maxRetries}}", String(maxRetries))
    .replace("{{failures}}", failureLines.join("\n"));
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseFencedBlocks(text: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const re = /^```[^\n]*\n([\s\S]*?)^```/gm;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const nlIdx = block.indexOf("\n");
    if (nlIdx === -1) continue;

    const firstLine = block.slice(0, nlIdx).trim();
    const content   = block.slice(nlIdx + 1);

    const pathMatch = firstLine.match(/^(?:\/\/|#)\s*(.+)$/);
    if (!pathMatch) continue;

    const filePath = pathMatch[1].trim();
    if (!filePath || filePath.startsWith("/") || filePath.includes("..") || !filePath.includes("/")) continue;

    files.push({ path: filePath, content });
  }

  return files;
}

function parseGaps(text: string): string[] {
  const m = text.match(/^## Gaps\n([\s\S]*?)(?:^##|$)/m);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => /^(GAP|DOC)-\d+/.test(l));
}

// ---------------------------------------------------------------------------
// Main: generate + retry loop
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  if (resultDir) mkdirSync(resultDir, { recursive: true });

  const messages: Message[] = [];
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;
  let totalTimeSeconds  = 0;
  let retries           = 0;
  let allFiles: Array<{ path: string; content: string }> = [];
  let lastGaps: string[] = [];

  // ── Initial generation ────────────────────────────────────────────────────

  console.log("\n[generate-api] === Attempt 0: initial generation ===\n");
  messages.push({ role: "user", content: initialPrompt });

  const initial = await callAPI(messages);
  console.log(`\n\n[generate-api] Generation complete.`);
  console.log(`[generate-api] tokens — input: ${initial.inputTokens}  output: ${initial.outputTokens}  time: ${initial.timeSeconds.toFixed(1)}s`);

  messages.push({ role: "assistant", content: initial.response });

  if (resultDir) writeFileSync(join(resultDir, "response-attempt-0.txt"), initial.response, "utf-8");

  if (initial.files.length === 0) {
    console.error("[generate-api] No files parsed from initial response — check response-attempt-0.txt");
    process.exit(1);
  }

  console.log(`[generate-api] Parsed ${initial.files.length} file(s).`);
  writeFiles(initial.files);

  totalInputTokens  += initial.inputTokens;
  totalOutputTokens += initial.outputTokens;
  totalTimeSeconds  += initial.timeSeconds;
  allFiles           = initial.files;
  lastGaps           = initial.gaps;

  // ── Retry loop ────────────────────────────────────────────────────────────

  let finalTestResult: TestRunResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n[generate-api] === Running unit tests (after attempt ${attempt - 1}) ===`);
    const testResult = runTests(attempt - 1);
    console.log(`[generate-api] Tests: ${testResult.passed}/${testResult.total} passing, ${testResult.failed} failing`);
    finalTestResult = testResult;

    if (testResult.failures.length === 0) {
      console.log("[generate-api] All tests pass — stopping retries.");
      break;
    }

    retries++;
    console.log(`\n[generate-api] === Retry ${attempt}/${maxRetries} ===\n`);

    const retryPrompt = buildRetryPrompt(testResult, attempt);
    messages.push({ role: "user", content: retryPrompt });

    const retry = await callAPI(messages);
    console.log(`\n\n[generate-api] Retry ${attempt} complete.`);
    console.log(`[generate-api] tokens — input: ${retry.inputTokens}  output: ${retry.outputTokens}  time: ${retry.timeSeconds.toFixed(1)}s`);

    messages.push({ role: "assistant", content: retry.response });

    if (resultDir) writeFileSync(join(resultDir, `response-attempt-${attempt}.txt`), retry.response, "utf-8");

    if (retry.files.length > 0) {
      console.log(`[generate-api] Parsed ${retry.files.length} file(s) in retry.`);
      writeFiles(retry.files);
      // Merge: retry may only return changed files
      for (const f of retry.files) {
        const idx = allFiles.findIndex((e) => e.path === f.path);
        if (idx !== -1) allFiles[idx] = f; else allFiles.push(f);
      }
      if (retry.gaps.length > 0) lastGaps = retry.gaps;
    } else {
      console.warn(`[generate-api] No files parsed in retry ${attempt} — keeping previous output.`);
    }

    totalInputTokens  += retry.inputTokens;
    totalOutputTokens += retry.outputTokens;
    totalTimeSeconds  += retry.timeSeconds;
  }

  // Run tests one final time if we exhausted retries without a clean pass
  if (finalTestResult === null || finalTestResult.failures.length > 0) {
    console.log(`\n[generate-api] === Final test run ===`);
    finalTestResult = runTests(maxRetries);
    console.log(`[generate-api] Final: ${finalTestResult.passed}/${finalTestResult.total} passing`);
  }

  // ── Save metadata and gaps ────────────────────────────────────────────────

  if (lastGaps.length > 0 && resultDir) {
    writeFileSync(join(resultDir, "gaps.json"), JSON.stringify(lastGaps, null, 2), "utf-8");
    console.log(`[generate-api] ${lastGaps.length} gap(s) → gaps.json`);
  }

  if (resultDir) {
    writeFileSync(
      join(resultDir, "generation-meta.json"),
      JSON.stringify({
        fileCount:    allFiles.length,
        model:        modelArg,
        inputTokens:  totalInputTokens,
        outputTokens: totalOutputTokens,
        timeSeconds:  totalTimeSeconds,
        retries,
        finalPassed:  finalTestResult?.passed  ?? 0,
        finalTotal:   finalTestResult?.total   ?? 0,
      }, null, 2),
      "utf-8",
    );
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

run().catch((err: unknown) => {
  console.error("[generate-api] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
