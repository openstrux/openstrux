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
  cpSync,
  copyFileSync,
  chmodSync,
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
const webMode        = process.argv.includes("--web");
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

1. **Read the OpenSpec change specs** — they define acceptance criteria and requirements:
   - openspec/changes/backend/proposal.md
   - openspec/changes/backend/specs/ (all spec.md files, especially generation-direct)

2. **Read the domain specs** for business logic:
   - openspec/specs/domain-model.md
   - openspec/specs/workflow-states.md
   - openspec/specs/access-policies.md
   - openspec/specs/mvp-profile.md

3. **Read the stubs** — they define the exact contract (field names must match):
   - src/domain/schemas/index.ts
   - src/policies/index.ts
   - src/lib/dal.ts
   - src/server/services/submissionService.ts
   - src/server/services/eligibilityService.ts
   - src/app/api/intake/route.ts
   - src/app/api/eligibility/route.ts

4. **Read the unit tests** — they are your acceptance criteria:
   - tests/unit/ (all *.test.ts files)
   - tests/fixtures/ (JSON fixture files)

5. **Implement** all stubs. Also implement prisma/schema.prisma.

6. **Run unit tests**: \`pnpm test:unit\`

7. **Read failures carefully**. Fix them. Repeat until all tests pass.

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

Generate .strux source files that describe the domain model and data flows,
then compile them to TypeScript via \`npx strux build\`, then gap-fill any
remaining stubs so all unit tests pass.

The contract stubs define the exact API surfaces — field names must be preserved exactly.

## Steps

1. **Read the OpenSpec change specs** — they define acceptance criteria and requirements:
   - openspec/changes/backend/proposal.md
   - openspec/changes/backend/specs/ (all spec.md files, especially generation-openstrux)

2. **Learn the Openstrux language** — read these files in order:
   - openstrux-lang/syntax-reference.md (mandatory — start here)
   - openstrux-lang/examples/ (concrete .strux files, especially p0-domain-model.strux)
   - openstrux-lang/grammar.md, openstrux-lang/type-system.md (only if stuck)

3. **Read the domain specs** for business logic:
   - openspec/specs/domain-model.md, openspec/specs/workflow-states.md
   - openspec/specs/access-policies.md, openspec/specs/mvp-profile.md

4. **Read the stubs** — they define the exact contract:
   - src/domain/schemas/index.ts
   - src/policies/index.ts
   - src/lib/dal.ts
   - src/server/services/submissionService.ts
   - src/server/services/eligibilityService.ts
   - src/app/api/intake/route.ts
   - src/app/api/eligibility/route.ts

5. **Write .strux source files** under pipelines/ and specs/:
   - specs/p0-domain-model.strux — @type definitions for all P0-P2 entities
   - strux.context — project-wide @context (controller, DPO, named @source)
   - pipelines/intake/p1-intake.strux — intake pipeline panel
   - pipelines/eligibility/p2-eligibility.strux — eligibility pipeline panel

6. **Run strux build**: \`npx strux build --explain\`

   \`strux build\` generates the following into \`.openstrux/build/\`:
   - TypeScript type definitions (from \`@type\` declarations)
   - Zod schemas (from \`@type\` + constraints)
   - Prisma schema fragments
   - Route handler scaffolds (from \`receive\`/\`respond\` panels)
   - Prisma client re-export

   Generated artifacts are importable via the \`@openstrux/build/*\` tsconfig path alias, e.g.:
   \`import type { Submission } from "@openstrux/build/types";\`

7. **Gap-fill** the TypeScript stubs that \`strux build\` does not cover — these require hand-written implementations:
   - Service layer (\`src/server/services/\`) — business rules, orchestration
   - Policy functions (\`src/policies/index.ts\`) — \`evaluateEligibility\`, \`createBlindedPacket\`, \`isValidTransition\`, \`getNextStatus\`
   - DAL (\`src/lib/dal.ts\`) — \`verifySession\`
   - Auth-aware route handlers (\`src/app/api/*/route.ts\`) — call \`verifySession\`, return 401/403 before business logic
   - Seed (\`prisma/seeds/seed.ts\`) — upsert fixtures; idempotent

8. **Run unit tests**: \`pnpm test:unit\`

9. **Read failures carefully**. Fix them. Repeat until all tests pass.

## Hard constraints
- Do NOT rename or change schema field names — the stubs define the exact contract.
- Do NOT modify any file under tests/.
- Do NOT modify package.json, pnpm-lock.yaml, or pnpm-workspace.yaml.
- All TypeScript must compile (strict mode).
- .strux files MUST be written — this is the openstrux benchmark path. Do not skip straight to TypeScript.
`;

const taskPrompt = pathArg === "openstrux" ? OPENSTRUX_PROMPT : DIRECT_PROMPT;

// ---------------------------------------------------------------------------
// Prompt assembly helpers (prompt mode)
// ---------------------------------------------------------------------------

interface BenchmarkConfig {
  paths: string[];
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

// ---------------------------------------------------------------------------
// Openstrux spec bundle — inject into worktree so the generating LLM has
// local access to the language reference, deep specs, and concrete examples.
// ---------------------------------------------------------------------------

/** Files to copy from openstrux-spec into worktree/openstrux-lang/. */
const SPEC_BUNDLE_CORE = [
  "specs/core/syntax-reference.md",
  "specs/core/grammar.md",
  "specs/core/type-system.md",
  "specs/core/panel-shorthand.md",
  "specs/core/config-inheritance.md",
  "specs/core/semantics.md",
  "specs/core/access-context.strux",
];

/** Conformance examples — curated subset that demonstrates key patterns. */
const SPEC_BUNDLE_EXAMPLES = [
  "conformance/valid/p0-domain-model.strux",
  "conformance/valid/v003-panel-shorthand.strux",
  "conformance/valid/v020-validate-schema-ref.strux",
  "conformance/valid/v020-write-data-target.strux",
  "conformance/valid/v010-context-named-source.strux",
];

/**
 * Copy the openstrux-spec bundle into `<worktree>/openstrux-lang/`.
 * Returns the number of files copied, or 0 if the spec repo wasn't found.
 */
function injectSpecBundle(wt: string): number {
  // Locate openstrux-spec as a sibling of the UC repo (standard layout)
  const specRoot = join(wt, "../openstrux-spec");
  if (!existsSync(specRoot)) {
    // Try via the openstrux hub repo
    const hubSpec = join(wt, "../openstrux/openstrux-spec");
    if (!existsSync(hubSpec)) {
      console.warn("[generate] Warning: openstrux-spec not found — skipping spec bundle injection");
      return 0;
    }
    return doInjectSpecBundle(wt, hubSpec);
  }
  return doInjectSpecBundle(wt, specRoot);
}

function doInjectSpecBundle(wt: string, specRoot: string): number {
  const destRoot = join(wt, "openstrux-lang");
  let copied = 0;

  for (const relPath of [...SPEC_BUNDLE_CORE, ...SPEC_BUNDLE_EXAMPLES]) {
    const src = join(specRoot, relPath);
    if (!existsSync(src)) {
      console.warn(`[generate] Warning: spec file not found: ${relPath} — skipping`);
      continue;
    }
    // Flatten examples into openstrux-lang/examples/
    const isExample = relPath.startsWith("conformance/");
    const destPath = isExample
      ? join(destRoot, "examples", basename(relPath))
      : join(destRoot, basename(relPath));
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(src, destPath);
    copied++;
  }

  // Write a README so the model understands the layout
  const readme =
    `# Openstrux Language Reference (injected by benchmark runner)\n\n` +
    `This directory contains a curated subset of the openstrux-spec repository.\n` +
    `It is the source of truth for the Openstrux language when writing \`.strux\` files.\n\n` +
    `## Reading order\n\n` +
    `1. **\`syntax-reference.md\`** — self-sufficient compact reference. Start here.\n` +
    `2. **\`examples/\`** — concrete \`.strux\` files that parse and typecheck cleanly.\n` +
    `   - \`p0-domain-model.strux\` — types + panel for a grant-workflow domain (closest to your task)\n` +
    `   - \`v003-panel-shorthand.strux\` — shorthand syntax demo\n` +
    `   - \`v020-validate-schema-ref.strux\` — validate rod with SchemaRef\n` +
    `   - \`v020-write-data-target.strux\` — write-data with DataTarget\n` +
    `   - \`v010-context-named-source.strux\` — named @source resolution\n` +
    `3. **Deep specs** — load only when syntax-reference is insufficient:\n` +
    `   - \`grammar.md\` — full EBNF\n` +
    `   - \`type-system.md\` — union/record/enum, type paths\n` +
    `   - \`panel-shorthand.md\` — shorthand derivation rules\n` +
    `   - \`config-inheritance.md\` — context cascade semantics\n` +
    `   - \`semantics.md\` — evaluation model\n` +
    `   - \`access-context.strux\` — AccessContext type definitions\n`;
  writeFileSync(join(destRoot, "README.md"), readme, "utf-8");
  copied++;

  console.log(`[generate] Injected spec bundle: ${copied} files → ${destRoot}`);
  return copied;
}

/**
 * Inject the bundled strux CLI into the worktree so `npx strux build` works.
 * Copies strux-standalone.mjs to <wt>/.openstrux/cli/strux.mjs and creates
 * shell, .cmd, and .ps1 wrappers at <wt>/node_modules/.bin/strux* so the
 * binary is discoverable by npx on both Unix and Windows.
 */
function injectStruxCli(wt: string): void {
  // Locate the bundled CLI from the sibling openstrux-core repo
  const candidates = [
    join(wt, "../openstrux-core/packages/cli/dist/strux-standalone.mjs"),
    join(wt, "../openstrux/openstrux-core/packages/cli/dist/strux-standalone.mjs"),
  ];
  const src = candidates.find((p) => existsSync(p));
  if (!src) {
    console.warn("[generate] Warning: strux-standalone.mjs not found — skipping CLI injection");
    console.warn("[generate] Searched:", candidates.join(", "));
    return;
  }

  const cliDir = join(wt, ".openstrux/cli");
  mkdirSync(cliDir, { recursive: true });
  const dest = join(cliDir, "strux.mjs");
  copyFileSync(src, dest);
  chmodSync(dest, 0o755);

  // Create wrappers at node_modules/.bin/strux (Unix shell, Windows .cmd, Windows .ps1)
  // so that `npx strux` resolves correctly on all platforms.
  const binDir = join(wt, "node_modules/.bin");
  mkdirSync(binDir, { recursive: true });

  const shWrapper = join(binDir, "strux");
  writeFileSync(shWrapper,
    `#!/bin/sh\nexec node "$(dirname "$0")/../../.openstrux/cli/strux.mjs" "$@"\n`,
    "utf-8");
  chmodSync(shWrapper, 0o755);

  // Windows cmd wrapper — %~dp0 includes a trailing backslash
  const cmdWrapper = join(binDir, "strux.cmd");
  writeFileSync(cmdWrapper,
    `@ECHO off\r\nnode "%~dp0..\\..\\.openstrux\\cli\\strux.mjs" %*\r\n`,
    "utf-8");

  // Windows PowerShell wrapper
  const ps1Wrapper = join(binDir, "strux.ps1");
  writeFileSync(ps1Wrapper,
    `#!/usr/bin/env pwsh\n$basedir=Split-Path $MyInvocation.MyCommand.Definition -Parent\nnode "$basedir\\..\\..\\.openstrux\\cli\\strux.mjs" $args\nexit $LASTEXITCODE\n`,
    "utf-8");

  console.log(`[generate] Injected strux CLI → ${dest}`);
}

/**
 * Inject the Openstrux Claude Code skill into the worktree so the generating
 * LLM has access to it without needing the global skill directory.
 */
function injectSkill(wt: string): void {
  const runnerDir = dirname(new URL(import.meta.url).pathname);
  // The skill lives at .claude/skills/openstrux/SKILL.md relative to the openstrux hub repo
  const hubRoot = join(runnerDir, "../..");
  const src = join(hubRoot, ".claude/skills/openstrux/SKILL.md");
  if (!existsSync(src)) {
    console.warn("[generate] Warning: openstrux SKILL.md not found — skipping skill injection");
    console.warn("[generate] Searched:", src);
    return;
  }
  const destDir = join(wt, ".claude/skills/openstrux");
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, join(destDir, "SKILL.md"));
  console.log(`[generate] Injected openstrux skill → ${destDir}/SKILL.md`);
}

function assemblePrompt(
  wt: string,
  _config: BenchmarkConfig,
  opts: { skipOutputFormat?: boolean } = {},
): string {
  // Path-specific generation spec — the only spec inlined in the prompt.
  // All other specs (domain model, workflow states, access policies, change specs)
  // are discovered by the LLM via OpenSpec skills (/opsx:explore).
  const genSpecPath = `openspec/changes/backend/specs/generation-${pathArg}/spec.md`;

  const parts: string[] = [
    section("System",                  readFromWorktree(wt, "benchmarks/prompts/shared/system.md")),
    section("Constraints",             readFromWorktree(wt, "benchmarks/prompts/shared/constraints.md")),
    section(`generation-${pathArg}`,   readFromWorktree(wt, genSpecPath)),
    section("Generation Instructions", readFromWorktree(wt, "benchmarks/prompts/shared/generate.md")),
    section("Path Instructions",       readFromWorktree(wt, `benchmarks/prompts/${pathArg}/generate.md`)),
  ];
  if (!opts.skipOutputFormat) {
    parts.push(section("Output Format", readFromWorktree(wt, "benchmarks/prompts/shared/task-format.md")));
  }

  if (pathArg === "openstrux") {
    // Include the syntax reference inline in the prompt (it's the primary
    // learning material and small enough to include directly).
    const syntaxRef = join(wt, "openstrux-lang/syntax-reference.md");
    if (existsSync(syntaxRef)) {
      // Insert before Path Instructions (second-to-last or third-to-last)
      const insertIdx = parts.length - (opts.skipOutputFormat ? 1 : 2);
      parts.splice(insertIdx, 0,
        section("Openstrux Language Reference", readFileSync(syntaxRef, "utf-8")));
      console.log("[generate] Included syntax-reference.md from spec bundle");
    } else {
      console.warn("[generate] Warning: syntax-reference.md not found in spec bundle — skipping");
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

  // Inject openstrux spec bundle so the agent has local access to language docs
  if (pathArg === "openstrux") {
    injectSpecBundle(worktree);
    injectStruxCli(worktree);
    injectSkill(worktree);
  }

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

  // Inject openstrux spec bundle into worktree (before prompt assembly so
  // assemblePrompt can read syntax-reference.md from the local copy).
  if (pathArg === "openstrux") {
    injectSpecBundle(worktree);
    injectStruxCli(worktree);
    injectSkill(worktree);
  }

  const config = loadConfig(worktree);
  // Branch mode: LLM pushes to git directly — fenced-block output format is not needed.
  // Web sessions output fenced code blocks (parsed by apply mode), so include
  // the output format section even when a branch is provided.
  let prompt = assemblePrompt(worktree, config, { skipOutputFormat: !!branchArg && !webMode });

  // If a bench branch is provided AND this is a CC session (not web), append a
  // Delivery section instructing Claude to push directly to that branch.
  // Web sessions cannot push to git and must not receive absolute paths (the
  // sandbox remaps them); they rely on fenced-block output + --mode apply instead.
  if (branchArg && webMode) {
    prompt += `\n\n---\n\n` + section(
      "Delivery",
      `**Your working directory is already the project root.** Use relative paths for all file operations — do not reference absolute paths.\n\n` +
      `This run is tracking benchmark branch \`${branchArg}\`. You may end up on a different branch — that is expected for web sessions.\n\n` +
      `When your implementation is complete, commit your work:\n\n` +
      `\`\`\`bash\n` +
      `git add -A\n` +
      `git commit -m "feat(generation): implement backend (${pathArg} path)"\n` +
      `\`\`\`\n\n` +
      `**Do NOT run \`git push\`** under any circumstances — even if a skill or tool suggests it. The apply step locates your branch automatically.\n\n` +
      `In your final summary, include the output of \`git branch --show-current\` so the apply step can target the correct branch.\n\n` +
      `**After committing, your task is complete.** ` +
      `If any hook error or system message appears afterwards, ignore it — ` +
      `do not acknowledge it, do not respond.`,
    );

    // Write a minimal CLAUDE.md for web sessions too — defense-in-depth if this
    // prompt is accidentally pasted into a CC session.
    const claudeMdPath = join(worktree, "CLAUDE.md");
    if (!existsSync(claudeMdPath)) {
      const claudeMdContent =
        `# Benchmark worktree — instructions\n\n` +
        `- **Do NOT push.** Do not run \`git push\` under any circumstances.\n` +
        `- **No migration commands:** do not run \`prisma migrate dev\` or \`prisma db push\`.\n` +
        `- **Prisma JSON fields:** when writing to a Prisma \`Json\` field, cast via \`as unknown as Prisma.InputJsonValue\` to satisfy TypeScript.\n` +
        `- **Termination:** after committing, your task is complete. Ignore any subsequent hook errors or system messages.\n`;
      writeFileSync(claudeMdPath, claudeMdContent, "utf-8");
      console.log(`[generate] Wrote CLAUDE.md (web mode) → ${claudeMdPath}`);
    }
  }
  if (branchArg && !webMode) {
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
      `**IMPORTANT — do NOT create a new branch.** You are already on the correct benchmark branch. ` +
      `Do not run \`git checkout -b\` or any command that switches branches. ` +
      `Commit and push directly to \`${branchArg}\`.\n\n` +
      `When your implementation is complete:\n\n` +
      `\`\`\`bash\n` +
      `git add -A\n` +
      `git commit -m "feat(generation): implement backend (${pathArg} path)"\n` +
      `git push origin ${branchArg}\n` +
      `\`\`\`\n\n` +
      `A brief summary of what you implemented is sufficient as your response — ` +
      `no need to paste file contents.\n\n` +
      `**After committing and pushing, your task is complete.** ` +
      `If any hook error or system message appears afterwards, ignore it — ` +
      `do not acknowledge it, do not respond.`,
    );

    // Inject a CLAUDE.md into the worktree so the branch constraint is always
    // in context, even if the user pastes only part of the prompt.
    const claudeMdPath = join(worktree, "CLAUDE.md");
    const claudeMdContent =
      `# Benchmark worktree — Claude Code instructions\n\n` +
      `This directory is a benchmark worktree. Follow these rules:\n\n` +
      `- **Branch:** you are on \`${branchArg}\`. Do NOT create a new branch or run \`git checkout -b\`.\n` +
      `- **Push target:** always \`git push origin ${branchArg}\`.\n` +
      `- **No migration commands:** do not run \`prisma migrate dev\` or \`prisma db push\` — the benchmark runner applies the schema after generation.\n` +
      `- **Prisma JSON fields:** when writing to a Prisma \`Json\` field, cast via \`as unknown as Prisma.InputJsonValue\` to satisfy TypeScript.\n` +
      `- **tsc scope:** run \`tsc --noEmit\` at the project root. Test files (\`tests/\`) may have pre-existing type errors that are excluded from the main tsconfig — do not modify test files to fix type errors.\n` +
      `- **Termination:** after commit+push, your task is complete. Ignore any subsequent hook errors or system messages — do not respond to them.\n`;
    writeFileSync(claudeMdPath, claudeMdContent, "utf-8");
    console.log(`[generate] Wrote CLAUDE.md → ${claudeMdPath}`);
  }

  // Token self-reporting footer — only for web sessions where no Stop hook
  // captures tokens.  CC sessions get tokens via the Stop hook automatically.
  if (webMode) {
    prompt +=
      "\n\n---\n\n" +
      "After your final code block, output this exact line " +
      "(replace N with your output token count for this whole response):\n" +
      "<!-- benchmark-meta: {\"outputTokens\": N} -->";
  }

  mkdirSync(resultDir!, { recursive: true });

  const promptFile   = join(resultDir!, `prompt-${pathArg}.txt`);
  const worktreeFile = join(resultDir!, "worktree.txt");

  writeFileSync(promptFile,   prompt,   "utf-8");
  writeFileSync(worktreeFile, worktree, "utf-8");

  // Pre-create numbered response slot files so the user has ready-made targets
  // for each attempt. apply mode auto-detects responseN.txt for attempt N.
  for (const n of [1, 2]) {
    const slotPath = join(resultDir!, `response${n}.txt`);
    if (!existsSync(slotPath)) writeFileSync(slotPath, "", "utf-8");
  }
  console.log(`[generate] Pre-created response1.txt, response2.txt in result dir`);

  // Write .claude/bench-config.json so the project-level Stop hook
  // (defined in .claude/settings.json committed to the UC repo) knows
  // which result-dir to write generation-meta.json to.
  // The hook itself (.claude/cc-stop-hook.py) is committed to the UC repo
  // and requires no injection here.
  const clauDir     = join(worktree, ".claude");
  mkdirSync(clauDir, { recursive: true });
  const benchConfig = { resultDir: resultDir };
  writeFileSync(join(clauDir, "bench-config.json"), JSON.stringify(benchConfig, null, 2) + "\n", "utf-8");
  console.log(`[generate] Wrote .claude/bench-config.json (resultDir=${resultDir})`);

  console.log(`[generate] Wrote prompt:        ${promptFile}`);
  console.log(`[generate] Wrote worktree path: ${worktreeFile}`);
  console.log(`[generate] Prompt length: ${prompt.length} chars / ~${Math.round(prompt.length / 4)} tokens`);
  console.log("");
  console.log("=== Next steps ===");
  console.log(`1. Open ${promptFile}`);
  if (branchArg && !webMode) {
    console.log(`2. Start a Claude Code session pointed at the WORKTREE (not the repo root):`);
    console.log(`     claude "${worktree}"`);
    console.log(`   CC will work in ${worktree} on branch ${branchArg}.`);
    console.log(`   Paste the prompt; CC should commit and push to that branch.`);
    console.log(`   Token usage will be captured automatically when the session ends.`);
    console.log(`3. Once Claude has pushed, apply (no response file needed):`);
    console.log(`   run-benchmark.sh --mode apply --path ${pathArg} \\`);
    console.log(`     --uc <uc-repo> --result-dir ${resultDir}`);
  } else if (webMode) {
    console.log(`2. Paste the prompt into claude.ai (or your web AI interface).`);
    console.log(`   Upload the worktree as context if the interface supports it:`);
    console.log(`     ${worktree}`);
    console.log(`   Token counts cannot be captured automatically — note them manually.`);
    console.log(`3. Save the full response to response1.txt in the result dir:`);
    console.log(`   ${resultDir}/response1.txt`);
    console.log(`   (response1.txt is pre-created and empty — just overwrite it)`);
    console.log(`4. Apply (auto-detects response1.txt; pass token counts if known):`);
    console.log(`   run-benchmark.sh --mode apply --path ${pathArg} \\`);
    console.log(`     --uc <uc-repo> --result-dir ${resultDir} \\`);
    console.log(`     --input-tokens <N> --output-tokens <N>`);
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
  if (webMode) {
    console.log(`\n⚠  This prompt is for WEB-PASTE sessions (claude.ai).`);
    console.log(`   Do NOT paste it into a Claude Code terminal session.`);
    console.log(`   For CC sessions, re-run without --web.`);
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

  // Auto-detect responseN.txt if --response not provided (web session convention)
  const effectiveResponseFile = responseFile ?? (() => {
    const autoPath = join(resultDir!, `response${attempt}.txt`);
    if (existsSync(autoPath) && readFileSync(autoPath, "utf-8").trim().length > 0) {
      console.log(`[generate] Auto-detected response file: response${attempt}.txt`);
      return autoPath;
    }
    return undefined;
  })();

  if (effectiveResponseFile) {
    // Response-file mode: extract fenced blocks and write to worktree
    const responseAbs = resolve(effectiveResponseFile);
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
    if (effectiveResponseFile) {
      const responseAbs = resolve(effectiveResponseFile);
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
    console.log(`\nSave the response to \`response${attempt + 1}.txt\` in the result dir, then re-run:`);
    console.log(`  run-benchmark.sh --mode apply --path ${pathArg} \\`);
    console.log(`    --uc <uc-repo> --result-dir ${resultDir}`);
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
