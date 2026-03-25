#!/usr/bin/env node --experimental-strip-types
/**
 * generate.ts — Unified benchmark generation script.
 *
 * Supports three operating modes via --mode:
 *
 *   agent  (default) — Stateful agentic loop. Provider:
 *     • anthropic       Uses @anthropic-ai/claude-agent-sdk (default for claude-* models).
 *                       Full Claude Code session with Read/Write/Edit/Bash/Glob/Grep tools.
 *     • openai          Custom tool-calling loop for any OpenAI-compatible API (e.g. z.ai).
 *     • google-gemini   Same tool-calling loop via Google's OpenAI-compatible endpoint
 *                       (default for gemini-* models). Uses GOOGLE_API_KEY.
 *
 *   prompt — Assemble the full benchmark prompt from the worktree, write
 *            prompt-<path>.txt and worktree.txt to the result-dir, then exit
 *            without calling any LLM. No API key required.
 *
 *   apply  — Recover the worktree from worktree.txt in result-dir, parse
 *            fenced code blocks from --response <file>, write files to the
 *            worktree, run unit tests, print a retry prompt on failure, or
 *            archive results and clean up on success. No API key required.
 *
 * Usage:
 *   node --experimental-strip-types generate.ts \
 *     --path <direct|openstrux> \
 *     --mode <agent|prompt|apply>            # default: agent
 *     --model <model-id>                     # default: claude-sonnet-4-6 or gemini-2.5-pro
 *     --worktree <abs-path>                  # default: cwd (ignored in apply — read from worktree.txt)
 *     --result-dir <abs-path>                # required for prompt and apply modes
 *     --response <abs-path>                  # required for apply mode
 *     [--provider <anthropic|openai|google-gemini>]  # auto-detected from model name
 *     [--base-url <url>]                     # override API endpoint
 *     [--max-turns <n>]                      # agent mode only, default: 80
 *
 * Env vars (agent mode only):
 *   ANTHROPIC_API_KEY  — provider=anthropic
 *   ZAI_API_KEY        — provider=openai (fallback: OPENAI_API_KEY)
 *   GOOGLE_API_KEY     — provider=google-gemini
 *
 * ---------------------------------------------------------------------------
 * Common workflows
 * ---------------------------------------------------------------------------
 *
 * ## A. Direct path — prompt mode → Claude Code (manual apply, keep env)
 *
 *   Step 1 — Generate prompt and record worktree:
 *     node --experimental-strip-types generate.ts \
 *       --path direct \
 *       --mode prompt \
 *       --worktree <abs-path-to-worktree> \
 *       --result-dir benchmarks/results/$(date +%Y%m%d-%H%M%S)-direct
 *
 *   Step 2 — Paste prompt-direct.txt into a Claude Code (or claude.ai) session.
 *            Save the full response to benchmarks/results/<run>/response.txt.
 *
 *   Step 3 — Apply response (keep worktree intact for manual inspection):
 *     node --experimental-strip-types generate.ts \
 *       --path direct \
 *       --mode apply \
 *       --result-dir benchmarks/results/<run> \
 *       --response benchmarks/results/<run>/response.txt
 *
 *   NOTE: on test failure the worktree is left untouched — inspect freely.
 *         On success, save-result.sh runs automatically and may remove the
 *         worktree. To prevent that, interrupt (Ctrl-C) after "All tests
 *         passed!" and before save-result.sh exits, or examine the worktree
 *         immediately after the apply step while the process is still running.
 *
 * ## B. Direct path — fully automated agent mode (Claude Sonnet, no human paste)
 *
 *   node --experimental-strip-types generate.ts \
 *     --path direct \
 *     --mode agent \
 *     --worktree <abs-path-to-worktree> \
 *     --result-dir benchmarks/results/$(date +%Y%m%d-%H%M%S)-direct-agent
 *
 * ## C. Openstrux path — automated agent mode
 *
 *   node --experimental-strip-types generate.ts \
 *     --path openstrux \
 *     --mode agent \
 *     --worktree <abs-path-to-worktree> \
 *     --result-dir benchmarks/results/$(date +%Y%m%d-%H%M%S)-openstrux-agent
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const pathArg        = arg("--path") as "direct" | "openstrux" | undefined;
const modeArg        = arg("--mode") ?? "agent";
const responseFile   = arg("--response");
const worktreeArg    = arg("--worktree");
const resultDirArg   = arg("--result-dir");
const branchArg      = arg("--branch");
const maxTurns       = parseInt(arg("--max-turns") ?? "80", 10);
const maxWallMs      = 25 * 60 * 1000;
// Optional explicit token/time overrides for apply mode (web-session runs)
const inputTokensArg  = arg("--input-tokens");
const outputTokensArg = arg("--output-tokens");
const timeSecondsArg  = arg("--time-seconds");
const retriesArg      = arg("--retries");

// Validate mode
if (!["agent", "prompt", "apply"].includes(modeArg)) {
  console.error(`Error: --mode must be one of: agent, prompt, apply (got: ${modeArg})`);
  process.exit(1);
}
const mode = modeArg as "agent" | "prompt" | "apply";

// In apply mode the worktree comes from worktree.txt — resolved later.
let worktree  = resolve(worktreeArg ?? process.cwd());
const resultDir = resultDirArg ? resolve(resultDirArg) : undefined;

// ---------------------------------------------------------------------------
// Provider / model resolution
// ---------------------------------------------------------------------------

type Provider = "anthropic" | "openai" | "google-gemini";

const providerArg = arg("--provider") as Provider | undefined;
const baseUrlArg  = arg("--base-url");

function detectProvider(model: string): Provider {
  if (model.startsWith("claude-"))  return "anthropic";
  if (model.startsWith("gemini-"))  return "google-gemini";
  return "openai";
}

// Default model: gemini-2.5-pro when provider is google-gemini, otherwise claude-sonnet-4-6
const modelDefault = (providerArg === "google-gemini") ? "gemini-2.5-pro" : "claude-sonnet-4-6";
const modelArg     = arg("--model") ?? modelDefault;

const provider: Provider = providerArg ?? detectProvider(modelArg);

const DEFAULT_BASE_URLS: Record<Provider, string> = {
  anthropic:       "https://api.anthropic.com",
  openai:          "https://api.z.ai/api/paas/v4",
  "google-gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
};
const baseUrl = baseUrlArg ?? DEFAULT_BASE_URLS[provider];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

if (!pathArg || !["direct", "openstrux"].includes(pathArg)) {
  console.error(
    "Usage: generate.ts --path <direct|openstrux> [--mode agent|prompt|apply] " +
    "[--model <id>] [--provider <anthropic|openai|google-gemini>] " +
    "[--worktree <dir>] [--result-dir <dir>] [--response <file>] " +
    "[--base-url <url>] [--max-turns <n>]",
  );
  process.exit(1);
}

if (mode === "apply") {
  if (!responseFile && !branchArg && !resultDirArg) {
    console.error("Error: --response <file>, --branch <name>, or --result-dir <path> required for --mode apply");
    process.exit(1);
  }
  if (!resultDir) {
    console.error("Error: --result-dir is required for --mode apply");
    process.exit(1);
  }
}

if (mode === "prompt" && !resultDir) {
  console.error("Error: --result-dir is required for --mode prompt");
  process.exit(1);
}

// API key — only validated for agent mode
let apiKey: string | undefined;
if (mode === "agent") {
  if (provider === "anthropic") {
    apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { console.error("Error: ANTHROPIC_API_KEY is not set"); process.exit(1); }
  } else if (provider === "google-gemini") {
    apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) { console.error("Error: GOOGLE_API_KEY is not set"); process.exit(1); }
  } else {
    apiKey = process.env.ZAI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) { console.error("Error: ZAI_API_KEY or OPENAI_API_KEY is not set"); process.exit(1); }
  }
}

if (resultDir) mkdirSync(resultDir, { recursive: true });

// ---------------------------------------------------------------------------
// Logging (agent mode appends to a file; other modes stdout only)
// ---------------------------------------------------------------------------

const logFile = (mode === "agent" && resultDir)
  ? join(resultDir, "response-agent.txt")
  : undefined;

function log(msg: string): void {
  console.log(msg);
  if (logFile) appendFileSync(logFile, msg + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Task prompts (agent mode)
// ---------------------------------------------------------------------------

const DIRECT_PROMPT = `\
You are implementing the backend of a privacy-first grant review workflow system.

## Your task

Implement all contract stubs so that the unit tests pass. The stubs already define
the exact API surfaces — field names, function signatures, and return types. Your job
is to replace the \`throw new Error("Not implemented")\` bodies with real code.

## Steps

1. **Read the stubs first** — they define the exact contract (field names must match):
   - packages/domain/src/schemas/index.ts
   - packages/policies/src/index.ts
   - app/web/src/lib/dal.ts
   - app/web/src/server/services/submissionService.ts
   - app/web/src/server/services/eligibilityService.ts
   - app/web/src/app/api/intake/route.ts
   - app/web/src/app/api/eligibility/route.ts

2. **Read the unit tests** — they are your acceptance criteria:
   - tests/unit/ (all *.test.ts files)
   - tests/fixtures/ (JSON fixture files)

3. **Read the domain specs** for business logic:
   - openspec/specs/domain-model.md
   - openspec/specs/workflow-states.md
   - openspec/specs/access-policies.md
   - openspec/specs/mvp-profile.md

4. **Implement** all stubs. Also implement prisma/schema.prisma.

5. **Run unit tests**: \`pnpm test:unit\`

6. **Read failures carefully**. Fix them. Repeat until all tests pass.

## Hard constraints
- Do NOT rename or change schema field names — the stubs define the exact contract.
- Do NOT modify any file under tests/.
- Do NOT modify package.json, pnpm-lock.yaml, or pnpm-workspace.yaml.
- All TypeScript must compile (strict mode).
`;

const OPENSTRUX_PROMPT = `\
You are implementing the backend of a privacy-first grant review workflow system
using the Openstrux language as an intermediate representation.

## Your task

Generate .strux source files that describe the data flows, then run \`npx strux build\`
to compile them to TypeScript. Gap-fill any remaining stubs so all unit tests pass.

The contract stubs define the exact API surfaces — field names must be preserved exactly.

## Steps

1. **Read the stubs first** — they define the exact contract:
   - packages/domain/src/schemas/index.ts
   - packages/policies/src/index.ts
   - app/web/src/lib/dal.ts
   - app/web/src/server/services/submissionService.ts
   - app/web/src/server/services/eligibilityService.ts
   - app/web/src/app/api/intake/route.ts
   - app/web/src/app/api/eligibility/route.ts

2. **Read the unit tests** — acceptance criteria:
   - tests/unit/ (all *.test.ts files)
   - tests/fixtures/ (JSON fixtures)

3. **Read the domain specs** for business logic:
   - openspec/specs/domain-model.md, openspec/specs/workflow-states.md
   - openspec/specs/access-policies.md, openspec/specs/mvp-profile.md

4. **Read the Openstrux language reference** if present:
   - ../openstrux-spec/specs/core/syntax-reference.md

5. **Write .strux source files** under pipelines/ as appropriate.

6. **Run strux build**: \`npx strux build --explain\`

7. **Gap-fill** any TypeScript stubs that strux build did not generate.

8. **Run unit tests**: \`pnpm test:unit\`

9. **Read failures carefully**. Fix them. Repeat until all tests pass.

## Hard constraints
- Do NOT rename or change schema field names — the stubs define the exact contract.
- Do NOT modify any file under tests/.
- Do NOT modify package.json, pnpm-lock.yaml, or pnpm-workspace.yaml.
- All TypeScript must compile (strict mode).
`;

const taskPrompt = pathArg === "openstrux" ? OPENSTRUX_PROMPT : DIRECT_PROMPT;

// ---------------------------------------------------------------------------
// Prompt assembly helpers (prompt mode)
// ---------------------------------------------------------------------------

interface BenchmarkConfig {
  paths: string[];
  specs: string[];
  tasks: string;
  testUnit: string;
  testIntegration: string;
  maxRetries?: number;
}

function readFromWorktree(wt: string, relPath: string): string {
  const abs = join(wt, relPath);
  if (!existsSync(abs)) throw new Error(`Missing file: ${relPath} (in ${wt})`);
  return readFileSync(abs, "utf-8");
}

function section(heading: string, content: string): string {
  return `# ${heading}\n\n${content}`;
}

function loadConfig(wt: string): BenchmarkConfig {
  const configPath = join(wt, "benchmark.config.json");
  if (!existsSync(configPath)) {
    throw new Error(`benchmark.config.json not found in ${wt}`);
  }
  return JSON.parse(readFileSync(configPath, "utf-8")) as BenchmarkConfig;
}

function assemblePrompt(
  wt: string,
  config: BenchmarkConfig,
  opts: { skipOutputFormat?: boolean } = {},
): string {
  const parts: string[] = [
    section("System",                  readFromWorktree(wt, "benchmarks/prompts/shared/system.md")),
    section("Constraints",             readFromWorktree(wt, "benchmarks/prompts/shared/constraints.md")),
    ...config.specs.map((p) =>         section(basename(p).replace(/\.md$/, ""), readFromWorktree(wt, p))),
    section("Tasks",                   readFromWorktree(wt, config.tasks)),
    section("Generation Instructions", readFromWorktree(wt, "benchmarks/prompts/shared/generate.md")),
    section("Path Instructions",       readFromWorktree(wt, `benchmarks/prompts/${pathArg}/generate.md`)),
  ];
  if (!opts.skipOutputFormat) {
    parts.push(section("Output Format", readFromWorktree(wt, "benchmarks/prompts/shared/task-format.md")));
  }

  if (pathArg === "openstrux") {
    const syntaxRef = join(wt, "../openstrux-spec/specs/core/syntax-reference.md");
    if (existsSync(syntaxRef)) {
      parts.splice(parts.length - 2, 0,
        section("Openstrux Language Reference", readFileSync(syntaxRef, "utf-8")));
      console.log("[generate] Included openstrux-spec/syntax-reference.md");
    } else {
      console.warn("[generate] Warning: openstrux-spec/syntax-reference.md not found — skipping");
    }
  }

  return parts.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// OAI tool definitions + executor (agent + apply modes)
// ---------------------------------------------------------------------------

type OAIMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: OAIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface OAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

const OAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file from the project worktree. Returns file contents as text.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to the project root" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write (create or overwrite) a file in the project worktree.",
      parameters: {
        type: "object",
        properties: {
          path:    { type: "string", description: "Path relative to the project root" },
          content: { type: "string", description: "Full file content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in a directory of the project worktree.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory relative to the project root (default: .)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run a shell command in the project worktree. Use for running tests (pnpm test:unit), checking TypeScript errors (pnpm type-check), or exploring the file tree.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
        },
        required: ["command"],
      },
    },
  },
];

function execTool(name: string, args: Record<string, string>): string {
  try {
    switch (name) {
      case "read_file": {
        const abs = join(worktree, args.path);
        if (!existsSync(abs)) return `Error: file not found: ${args.path}`;
        return readFileSync(abs, "utf-8");
      }
      case "write_file": {
        const abs = join(worktree, args.path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, args.content, "utf-8");
        return `Written: ${args.path}`;
      }
      case "list_files": {
        const abs = join(worktree, args.path ?? ".");
        if (!existsSync(abs)) return `Error: directory not found: ${args.path ?? "."}`;
        return readdirSync(abs).join("\n");
      }
      case "bash": {
        const out = execSync(args.command, {
          cwd:      worktree,
          timeout:  120_000,
          encoding: "utf-8",
        });
        return (out || "(no output)").slice(0, 8000);
      }
      default:
        return `Error: unknown tool: ${name}`;
    }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = (err.stdout ?? "") + (err.stderr ?? "");
    return `Error:\n${output || (err.message ?? String(e))}`.slice(0, 4000);
  }
}

// ---------------------------------------------------------------------------
// Fenced block parser + file writer (apply mode)
// ---------------------------------------------------------------------------

function parseFencedBlocks(text: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const re = /^```[^\n]*\n([\s\S]*?)^```/gm;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const block  = m[1];
    const nlIdx  = block.indexOf("\n");
    if (nlIdx === -1) continue;

    const firstLine = block.slice(0, nlIdx).trim();
    const content   = block.slice(nlIdx + 1);

    const pathMatch = firstLine.match(/^(?:\/\/|#)\s*(.+)$/);
    if (!pathMatch) continue;

    const filePath = pathMatch[1].trim();
    if (!filePath || filePath.startsWith("/") || filePath.includes("..") || !filePath.includes("/")) continue;

    files.push({ path: filePath, content });
  }

  // Fallback: parse unfenced sections where each file starts with a `// path/to/file.ext` header line.
  // Used when the LLM outputs code without fenced blocks (e.g. retry responses from web sessions).
  if (files.length === 0) {
    const fileHeaderRe = /^\/\/\s+([\w./-]+\/[\w./-]+\.[a-z]+)\s*$/;
    const lines = text.split("\n");
    let currentPath: string | null = null;
    let currentLines: string[] = [];

    const flush = () => {
      if (currentPath) {
        // Trim trailing blank lines
        while (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() === "") {
          currentLines.pop();
        }
        if (currentLines.length > 0) {
          files.push({ path: currentPath, content: currentLines.join("\n") + "\n" });
        }
      }
    };

    for (const line of lines) {
      const hm = fileHeaderRe.exec(line);
      if (hm) {
        flush();
        currentPath = hm[1].trim();
        currentLines = [];
      } else if (currentPath !== null) {
        currentLines.push(line);
      }
    }
    flush();
  }

  return files;
}

function writeFiles(files: Array<{ path: string; content: string }>, wt: string): void {
  for (const { path: filePath, content } of files) {
    const abs = join(wt, filePath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
    console.log(`[generate]   wrote: ${filePath}`);
  }
}

// ---------------------------------------------------------------------------
// Test runner + retry prompt (apply mode)
// ---------------------------------------------------------------------------

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

function runTests(wt: string, config: BenchmarkConfig, attempt: number, rd: string): TestRunResult {
  const testJsonPath = join(rd, `test-attempt-${attempt}.json`);
  const testCmd = `${config.testUnit} --reporter=json --outputFile=${testJsonPath}`;

  try {
    execSync(testCmd, { cwd: wt, stdio: "pipe" });
  } catch {
    // Non-zero exit when tests fail — expected; we'll read the JSON
  }

  if (!existsSync(testJsonPath)) {
    console.warn(`[generate] No test JSON at ${testJsonPath} — treating as 0/0`);
    return { total: 0, passed: 0, failed: 0, failures: [] };
  }

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
    const rawPath   = suite.name ?? suite.testFilePath ?? "";
    const shortPath = rawPath.replace(wt + "/", "");
    const tests     = suite.assertionResults ?? suite.testResults ?? [];
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

function buildRetryPrompt(wt: string, config: BenchmarkConfig, result: TestRunResult, attempt: number): string {
  const maxRetries = config.maxRetries ?? 5;

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

  const template = readFromWorktree(wt, "benchmarks/prompts/shared/retry.md");
  return template
    .replace("{{passed}}", String(result.passed))
    .replace("{{total}}", String(result.total))
    .replace("{{attempt}}", String(attempt))
    .replace("{{maxRetries}}", String(maxRetries))
    .replace("{{failures}}", failureLines.join("\n"));
}

// ---------------------------------------------------------------------------
// Shared metadata writer
// ---------------------------------------------------------------------------

function writeMeta(meta: {
  inputTokens: number;
  outputTokens: number;
  turns: number;
  exitSubtype: string;
  timeSeconds: number;
}): void {
  log(`[generate] Wall time: ${meta.timeSeconds.toFixed(1)}s`);

  if (resultDir) {
    writeFileSync(
      join(resultDir, "generation-meta.json"),
      JSON.stringify({ model: modelArg, provider, ...meta, retries: meta.turns }, null, 2),
      "utf-8",
    );
    log(`[generate] Wrote generation-meta.json`);
  }
}

// ---------------------------------------------------------------------------
// Anthropic path — Claude Agent SDK
// ---------------------------------------------------------------------------

async function runAnthropicAgent(): Promise<void> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const startMs    = Date.now();
  let inputTokens  = 0;
  let outputTokens = 0;
  let turns        = 0;
  let exitSubtype  = "unknown";

  const seenMessageIds  = new Set<string>();
  const abortController = new AbortController();
  const wallTimeout     = setTimeout(() => {
    log(`[generate] Wall-clock limit reached — aborting.`);
    abortController.abort();
  }, maxWallMs);

  try {
    for await (const message of query({
      prompt: taskPrompt,
      options: {
        cwd:            worktree,
        model:          modelArg,
        permissionMode: "bypassPermissions",
        allowedTools:   ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        abortController,
      } as Parameters<typeof query>[0]["options"],
    })) {
      if (message.type === "assistant") {
        turns++;

        type Usage = {
          input_tokens?: number;
          output_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        };
        type AssistantMsg = {
          message: {
            id: string;
            usage: Usage;
            content: Array<{ type: string; name?: string; input?: unknown }>;
          };
        };
        const msg = message as AssistantMsg;

        if (!seenMessageIds.has(msg.message.id)) {
          seenMessageIds.add(msg.message.id);
          const u = msg.message.usage;
          const inThisTurn  = (u.input_tokens ?? 0)
                            + (u.cache_creation_input_tokens ?? 0)
                            + (u.cache_read_input_tokens ?? 0);
          const outThisTurn = u.output_tokens ?? 0;
          inputTokens  += inThisTurn;
          outputTokens += outThisTurn;
          log(`[turn ${turns}] tokens — in: ${inThisTurn}  out: ${outThisTurn}`);
        }

        for (const block of msg.message.content ?? []) {
          if (block.type === "tool_use") {
            const input = block.input as Record<string, unknown> | undefined;
            const preview = input?.command ?? input?.path ?? input?.pattern ?? "";
            log(`  → ${block.name}(${preview})`);
          }
        }
      }

      if (message.type === "result") {
        type ResultMsg = {
          subtype: string;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
          num_turns: number;
          result: string;
        };
        const result = message as ResultMsg;
        exitSubtype  = result.subtype;
        turns        = result.num_turns;

        if (result.usage) {
          const u = result.usage;
          inputTokens  = (u.input_tokens ?? 0)
                       + (u.cache_creation_input_tokens ?? 0)
                       + (u.cache_read_input_tokens ?? 0);
          outputTokens = u.output_tokens ?? inputTokens;
        }

        log(`[generate] Done — subtype=${exitSubtype}  turns=${turns}`);
        log(`[generate] tokens — input: ${inputTokens}  output: ${outputTokens}`);
        if (result.result) log(`[generate] summary: ${result.result.slice(0, 300)}`);
        break;
      }
    }
  } finally {
    clearTimeout(wallTimeout);
  }

  writeMeta({ inputTokens, outputTokens, turns, exitSubtype,
    timeSeconds: (Date.now() - startMs) / 1000 });
}

// ---------------------------------------------------------------------------
// OpenAI-compatible path — tool-calling agent loop
// Used for provider=openai (e.g. z.ai) AND provider=google-gemini
// (Google's OpenAI-compatible endpoint at generativelanguage.googleapis.com/v1beta/openai)
// ---------------------------------------------------------------------------

async function runOAIAgent(): Promise<void> {
  const chatUrl    = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const startMs    = Date.now();
  let inputTokens  = 0;
  let outputTokens = 0;
  let turns        = 0;

  const messages: OAIMessage[] = [
    { role: "user", content: taskPrompt },
  ];

  const wallDeadline = Date.now() + maxWallMs;

  while (turns < maxTurns && Date.now() < wallDeadline) {
    turns++;
    log(`\n[turn ${turns}] calling ${modelArg} ...`);

    const res = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       modelArg,
        messages,
        tools:       OAI_TOOLS,
        tool_choice: "auto",
        max_tokens:  8192,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      log(`[generate] API error ${res.status}: ${text}`);
      break;
    }

    const data = await res.json() as {
      choices: Array<{
        message: {
          role: "assistant";
          content: string | null;
          tool_calls?: OAIToolCall[];
        };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    if (data.usage) {
      inputTokens  += data.usage.prompt_tokens    ?? 0;
      outputTokens += data.usage.completion_tokens ?? 0;
    }

    const choice  = data.choices[0];
    const message = choice.message;
    messages.push(message as OAIMessage);

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      log(`[generate] Agent finished (finish_reason=${choice.finish_reason})`);
      if (message.content) log(`[generate] Summary: ${message.content.slice(0, 400)}`);
      break;
    }

    for (const tc of toolCalls) {
      let toolArgs: Record<string, string> = {};
      try { toolArgs = JSON.parse(tc.function.arguments) as Record<string, string>; } catch { /* ignore */ }
      const preview = toolArgs.command ?? toolArgs.path ?? tc.function.name;
      log(`  → ${tc.function.name}(${preview})`);

      const result = execTool(tc.function.name, toolArgs);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  if (turns >= maxTurns)      log(`[generate] Warning: maxTurns (${maxTurns}) reached.`);
  if (Date.now() >= wallDeadline) log(`[generate] Warning: wall-clock limit reached.`);

  log(`[generate] Done — turns=${turns}  input=${inputTokens}  output=${outputTokens}`);
  writeMeta({ inputTokens, outputTokens, turns, exitSubtype: "success",
    timeSeconds: (Date.now() - startMs) / 1000 });
}

// ---------------------------------------------------------------------------
// Agent mode dispatcher
// ---------------------------------------------------------------------------

async function agentMode(): Promise<void> {
  log(`[generate] mode=agent provider=${provider} model=${modelArg} path=${pathArg} maxTurns=${maxTurns}`);
  log(`[generate] worktree=${worktree}`);
  log(`[generate] api-endpoint=${baseUrl}`);
  log("");

  if (provider === "anthropic") {
    await runAnthropicAgent();
  } else {
    // openai and google-gemini both use the OAI tool-calling loop
    await runOAIAgent();
  }
}

// ---------------------------------------------------------------------------
// Prompt mode
// ---------------------------------------------------------------------------

async function promptMode(): Promise<void> {
  console.log(`[generate] mode=prompt path=${pathArg}`);
  console.log(`[generate] worktree=${worktree}`);

  const config = loadConfig(worktree);
  // Branch mode: LLM pushes to git directly — fenced-block output format is not needed.
  let prompt = assemblePrompt(worktree, config, { skipOutputFormat: !!branchArg });

  // If a bench branch is provided, append a delivery section instructing Claude
  // to push directly to that branch instead of pasting code blocks.
  if (branchArg) {
    prompt += `\n\n---\n\n` + section(
      "Delivery",
      `**You must work inside the pre-created worktree directory** — do NOT work in the repo root.\n\n` +
      `Worktree path: \`${worktree}\`\n\n` +
      `That directory is already checked out on branch \`${branchArg}\`. ` +
      `Verify before touching any file:\n\n` +
      `\`\`\`bash\n` +
      `cd "${worktree}"\n` +
      `git branch --show-current   # must print: ${branchArg}\n` +
      `\`\`\`\n\n` +
      `If it does not print \`${branchArg}\`, stop — something is wrong with the setup.\n\n` +
      `When your implementation is complete:\n\n` +
      `\`\`\`bash\n` +
      `git add -A\n` +
      `git commit -m "feat(generation): implement backend (${pathArg} path)"\n` +
      `git push origin ${branchArg}\n` +
      `\`\`\`\n\n` +
      `A brief summary of what you implemented is sufficient as your response — ` +
      `no need to paste file contents.`,
    );
  }

  // Append a token-reporting footer so apply mode can recover output token count
  // without manual copy-paste.  Claude can reliably self-report output tokens;
  // input tokens are unknown to the model and must come from --input-tokens flag.
  prompt +=
    "\n\n---\n\n" +
    "After your final code block, output this exact line " +
    "(replace N with your output token count for this whole response):\n" +
    "<!-- benchmark-meta: {\"outputTokens\": N} -->";

  mkdirSync(resultDir!, { recursive: true });

  const promptFile   = join(resultDir!, `prompt-${pathArg}.txt`);
  const worktreeFile = join(resultDir!, "worktree.txt");

  writeFileSync(promptFile,   prompt,   "utf-8");
  writeFileSync(worktreeFile, worktree, "utf-8");

  // Write a Stop hook into the worktree's .claude/settings.json so that when a
  // Claude Code session runs there, it automatically captures token usage and
  // wall time into generation-meta.json at session end.  save-result.sh reads
  // that file; without it all metrics default to zero.
  const runnerDir  = dirname(new URL(import.meta.url).pathname);
  const hookScript = join(runnerDir, "cc-stop-hook.py");
  const clauDir    = join(worktree, ".claude");
  mkdirSync(clauDir, { recursive: true });
  const settingsPath = join(clauDir, "settings.json");
  // Merge with any existing settings rather than overwriting.
  let existing: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try { existing = JSON.parse(readFileSync(settingsPath, "utf-8")); } catch { /* ignore */ }
  }
  const hooks = (existing.hooks ?? {}) as Record<string, unknown[]>;
  hooks["Stop"] = [
    {
      matcher: ".*",
      hooks: [{ type: "command", command: `python3 "${hookScript}" "${resultDir}"` }],
    },
  ];
  existing.hooks = hooks;
  writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
  console.log(`[generate] Wrote Stop hook → ${settingsPath}`);

  console.log(`[generate] Wrote prompt:        ${promptFile}`);
  console.log(`[generate] Wrote worktree path: ${worktreeFile}`);
  console.log(`[generate] Prompt length: ${prompt.length} chars / ~${Math.round(prompt.length / 4)} tokens`);
  console.log("");
  console.log("=== Next steps ===");
  console.log(`1. Open ${promptFile}`);
  if (branchArg) {
    console.log(`2. Start a Claude Code session pointed at the WORKTREE (not the repo root):`);
    console.log(`     claude "${worktree}"`);
    console.log(`   CC will work in ${worktree} on branch ${branchArg}.`);
    console.log(`   Paste the prompt; CC should commit and push to that branch.`);
    console.log(`   Token usage will be captured automatically when the session ends.`);
    console.log(`3. Once Claude has pushed, apply (no response file needed):`);
    console.log(`   run-benchmark.sh --mode apply --path ${pathArg} \\`);
    console.log(`     --uc <uc-repo> --result-dir ${resultDir}`);
  } else {
    console.log(`2. Paste its contents into a Claude Code session pointed at the WORKTREE:`);
    console.log(`     claude "${worktree}"`);
    console.log(`   Token usage will be captured automatically when the session ends.`);
    console.log(`   (If using claude.ai web instead, tokens cannot be captured automatically.)`);
    console.log(`3. Copy the full response and save it to a file, e.g.:`);
    console.log(`   ${resultDir}/response.txt`);
    console.log(`4. Apply the response:`);
    console.log(`   node --experimental-strip-types generate.ts \\`);
    console.log(`     --mode apply --path ${pathArg} \\`);
    console.log(`     --result-dir ${resultDir} \\`);
    console.log(`     --response ${resultDir}/response.txt`);
  }
  console.log("");
  process.stderr.write(`[generate] To clean up if you abandon Phase 2:\n  git worktree remove --force "${worktree}"\n`);
}

// ---------------------------------------------------------------------------
// Apply mode
// ---------------------------------------------------------------------------

async function applyMode(): Promise<void> {
  console.log(`[generate] mode=apply path=${pathArg}`);

  // Recover worktree from worktree.txt
  const worktreeFile = join(resultDir!, "worktree.txt");
  if (!existsSync(worktreeFile)) {
    console.error(
      `Error: ${worktreeFile} not found.\n` +
      `Run --mode prompt first to create the worktree and record its path.`,
    );
    process.exit(1);
  }
  worktree = readFileSync(worktreeFile, "utf-8").trim();
  console.log(`[generate] Recovered worktree: ${worktree}`);

  if (!existsSync(worktree)) {
    console.error(`Error: worktree directory does not exist: ${worktree}`);
    process.exit(1);
  }

  // Determine attempt number
  const existingAttempts = readdirSync(resultDir!)
    .filter((f) => /^response-attempt-\d+\.txt$/.test(f)).length;
  const attempt = existingAttempts + 1;
  console.log(`[generate] Attempt ${attempt}`);

  if (responseFile) {
    // Response-file mode: extract fenced blocks and write to worktree
    const responseAbs = resolve(responseFile);
    if (!existsSync(responseAbs)) {
      console.error(`Error: response file not found: ${responseAbs}`);
      process.exit(1);
    }
    const responseText = readFileSync(responseAbs, "utf-8");
    writeFileSync(join(resultDir!, `response-attempt-${attempt}.txt`), responseText, "utf-8");
    const files = parseFencedBlocks(responseText);
    console.log(`[generate] Extracted ${files.length} file(s) from response`);
    if (files.length === 0) {
      // No code blocks found — the LLM may have pushed directly to the branch (agent/CC flow).
      // Fall back to branch mode if a branch is derivable.
      const fallbackBranch = branchArg ?? (() => {
        const slug = resultDirArg ? basename(resultDirArg) : "";
        return slug ? `bench-${slug}` : undefined;
      })();
      if (fallbackBranch) {
        console.log(`[generate] No files extracted — falling back to branch mode: origin/${fallbackBranch}`);
        execSync(`git fetch origin "${fallbackBranch}"`, { cwd: worktree, stdio: "inherit" });
        execSync(`git reset --hard "origin/${fallbackBranch}"`, { cwd: worktree, stdio: "inherit" });
        console.log(`[generate] Worktree updated from origin/${fallbackBranch}`);
      } else {
        console.warn("[generate] Warning: no files extracted and no branch available — check response format");
      }
    } else {
      writeFiles(files, worktree);
    }
  } else {
    // Branch mode: pull code from remote branch into worktree
    const branch = branchArg ?? (() => {
      // Derive from worktree.txt location (result-dir basename)
      const slug = resultDirArg ? basename(resultDirArg) : "";
      return slug ? `bench-${slug}` : undefined;
    })();
    if (!branch) {
      console.error("Error: --response <file> or --branch <name> required for apply mode");
      process.exit(1);
    }
    console.log(`[generate] Branch mode: pulling origin/${branch} into worktree`);
    execSync(`git fetch origin "${branch}"`, { cwd: worktree, stdio: "inherit" });
    execSync(`git reset --hard "origin/${branch}"`, { cwd: worktree, stdio: "inherit" });
    console.log(`[generate] Worktree updated from origin/${branch}`);
  }

  // Load config for testUnit + maxRetries
  const config = loadConfig(worktree);

  // Run unit tests
  console.log(`\n[generate] Running unit tests...`);
  const testResult = runTests(worktree, config, attempt, resultDir!);
  console.log(`[generate] Tests: ${testResult.passed}/${testResult.total} passed, ${testResult.failed} failed`);

  // ---------------------------------------------------------------------------
  // Token meta: parse footer from response (Option 1) and/or explicit flags
  // (Option 2).  Flags take precedence over footer; footer fills what flags
  // omit.  Written now so save-result.sh finds generation-meta.json on disk.
  // If neither source is available the CC Stop hook may have already written
  // the file — leave it untouched in that case.
  // ---------------------------------------------------------------------------
  {
    // Parse <!-- benchmark-meta: {"outputTokens": N} --> from response text
    let footerOut: number | undefined;
    if (responseFile) {
      const responseAbs = resolve(responseFile);
      if (existsSync(responseAbs)) {
        const responseText = readFileSync(responseAbs, "utf-8");
        const m = responseText.match(/<!--\s*benchmark-meta:\s*(\{[^}]*\})\s*-->/);
        if (m) {
          try { footerOut = (JSON.parse(m[1]) as { outputTokens?: number }).outputTokens; } catch { /* ignore */ }
        }
      }
    }

    const explicitIn  = inputTokensArg  ? parseInt(inputTokensArg,  10) : undefined;
    const explicitOut = outputTokensArg ? parseInt(outputTokensArg, 10) : undefined;
    const explicitT   = timeSecondsArg  ? parseFloat(timeSecondsArg)    : undefined;
    const explicitR   = retriesArg      ? parseInt(retriesArg,       10) : undefined;

    const hasData = explicitIn !== undefined || explicitOut !== undefined || footerOut !== undefined;
    if (hasData) {
      const metaPath = join(resultDir!, "generation-meta.json");
      // Merge over any existing file (e.g. from CC Stop hook)
      let base: Record<string, unknown> = {};
      if (existsSync(metaPath)) {
        try { base = JSON.parse(readFileSync(metaPath, "utf-8")); } catch { /* ignore */ }
      }
      const outTokens = explicitOut ?? footerOut ?? (base.outputTokens as number | undefined) ?? 0;
      const inTokens  = explicitIn  ?? (base.inputTokens  as number | undefined) ?? 0;
      const timeSecs  = explicitT   ?? (base.timeSeconds  as number | undefined) ?? 0;
      const retries   = explicitR   ?? (base.retries      as number | undefined) ?? 0;
      const meta = {
        model:       base.model    ?? modelArg,
        provider:    base.provider ?? provider,
        inputTokens:  inTokens,
        outputTokens: outTokens,
        turns:        retries,
        retries,
        exitSubtype: "success",
        timeSeconds:  timeSecs,
      };
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf-8");
      log(`[generate] Wrote generation-meta.json — in=${inTokens} out=${outTokens} time=${timeSecs}s` +
          (footerOut !== undefined && explicitOut === undefined ? " (output from footer)" : "") +
          (explicitOut !== undefined ? " (output from --output-tokens flag)" : ""));
    }
  }

  if (testResult.failed === 0 && testResult.total > 0) {
    // Success — archive and clean up
    console.log("\n[generate] All tests passed! Archiving results...");

    // save-result.sh expects test-unit.json
    const testJsonPath = join(resultDir!, `test-attempt-${attempt}.json`);
    if (existsSync(testJsonPath)) {
      writeFileSync(join(resultDir!, "test-unit.json"), readFileSync(testJsonPath));
    }

    const runnerDir  = dirname(new URL(import.meta.url).pathname);
    const saveScript = join(runnerDir, "save-result.sh");
    execSync(
      `bash "${saveScript}" ` +
      `--path "${pathArg}" ` +
      `--llm "${modelArg}" ` +
      `--worktree "${worktree}" ` +
      `--result-dir "${resultDir}" ` +
      `--test-results-json "${join(resultDir!, "test-unit.json")}"`,
      { stdio: "inherit" },
    );

    // In apply mode, the shell script manages worktree cleanup after integration tests.
    // Only remove worktree here when running standalone (no shell wrapper).
    process.exit(0);
  } else {
    // Failure — print retry prompt
    const retryPrompt = buildRetryPrompt(worktree, config, testResult, attempt);

    console.log("\n" + "=".repeat(60));
    console.log("RETRY PROMPT — copy and paste into your web session:");
    console.log("=".repeat(60) + "\n");
    console.log(retryPrompt);
    console.log("=".repeat(60));
    console.log(`\nSave the response, then re-run:`);
    console.log(`  node --experimental-strip-types generate.ts \\`);
    console.log(`    --mode apply --path ${pathArg} \\`);
    console.log(`    --result-dir ${resultDir} \\`);
    console.log(`    --response <new-response-file>`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (mode === "prompt") {
    await promptMode();
  } else if (mode === "apply") {
    await applyMode();
  } else {
    await agentMode();
  }
}

main().catch((err: unknown) => {
  console.error("[generate] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
