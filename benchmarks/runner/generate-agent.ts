#!/usr/bin/env node --experimental-strip-types
/**
 * generate-agent.ts — Benchmark generation via Claude Agent SDK.
 *
 * Runs an agentic session in the worktree: the agent reads stubs and tests,
 * implements the backend, runs unit tests, and iterates until all pass.
 *
 * Replaces generate-api.ts — same CLI interface, same generation-meta.json output
 * so save-result.sh works unchanged.
 *
 * Usage:
 *   node --experimental-strip-types generate-agent.ts \
 *     --path <direct|openstrux> \
 *     --model <model-id> \
 *     --worktree <abs-path> \
 *     --result-dir <abs-path> \
 *     [--max-turns <n>]
 *
 * Requires: ANTHROPIC_API_KEY, Node >= 24, @anthropic-ai/claude-agent-sdk
 */

import { writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const pathArg   = arg("--path") as "direct" | "openstrux" | undefined;
const modelArg  = arg("--model")     ?? "claude-sonnet-4-6";
const worktree  = resolve(arg("--worktree") ?? process.cwd());
const resultDir = arg("--result-dir") ? resolve(arg("--result-dir")!) : undefined;
const maxTurns  = parseInt(arg("--max-turns") ?? "120", 10);  // safety log only — exit is driven by result message
const maxWallMs = 20 * 60 * 1000;  // 20-minute hard wall-clock limit

if (!pathArg || !["direct", "openstrux"].includes(pathArg)) {
  console.error(
    "Usage: generate-agent.ts --path <direct|openstrux> [--model <id>] [--worktree <dir>] [--result-dir <dir>] [--max-turns <n>]",
  );
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

if (resultDir) mkdirSync(resultDir, { recursive: true });

const logFile = resultDir ? join(resultDir, "response-agent.txt") : undefined;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.log(msg);
  if (logFile) appendFileSync(logFile, msg + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Task prompt
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
   - specs/domain-model.md
   - specs/workflow-states.md
   - specs/access-policies.md
   - specs/mvp-profile.md

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
   - specs/domain-model.md, specs/workflow-states.md
   - specs/access-policies.md, specs/mvp-profile.md

4. **Read the Openstrux language reference** if present:
   - ../openstrux-spec/specs/core/syntax-reference.md

5. **Write .strux source files** under pipelines/ and specs/ as appropriate.
   Update strux.config.yaml if needed.

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
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const startMs = Date.now();

  log(`[generate-agent] path=${pathArg} model=${modelArg} maxTurns=${maxTurns}`);
  log(`[generate-agent] worktree=${worktree}`);
  log("");

  // Token accumulators (per-turn fallback — overridden by result message totals)
  // input_tokens from per-turn usage is just NEW tokens; add cache buckets for real cost.
  let inputTokens  = 0;
  let outputTokens = 0;
  let turns        = 0;
  let exitSubtype  = "unknown";

  // Deduplicate: parallel tool-use calls share the same message id
  const seenMessageIds = new Set<string>();

  const abortController = new AbortController();
  const wallTimeout = setTimeout(() => {
    log(`[generate-agent] Wall-clock limit (${maxWallMs / 60000}min) reached — aborting.`);
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
        type AssistantMsg = { message: { id: string; usage: Usage; content: Array<{ type: string; name?: string; input?: unknown }> } };
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
          log(`[turn ${turns}] tokens — in: ${inThisTurn} (new:${u.input_tokens ?? 0} cc:${u.cache_creation_input_tokens ?? 0} cr:${u.cache_read_input_tokens ?? 0})  out: ${outThisTurn}`);
        }

        // Log tool calls
        for (const block of msg.message.content ?? []) {
          if (block.type === "tool_use") {
            const input = block.input as Record<string, unknown> | undefined;
            const preview = input?.command ?? input?.path ?? input?.pattern ?? "";
            log(`  → ${block.name}(${preview})`);
          }
        }

        if (turns === maxTurns) log(`[generate-agent] Warning: ${maxTurns} turns reached — agent still running.`);
      }

      if (message.type === "result") {
        type ResultUsage = {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
        type ResultMsg = {
          subtype: string;
          usage?: ResultUsage;
          num_turns: number;
          result: string;
        };
        const result = message as ResultMsg;

        exitSubtype = result.subtype;
        turns       = result.num_turns;

        // Authoritative totals from result message.
        // input_tokens alone is just new tokens in the final turn — add cache buckets
        // to get the full input cost across the session.
        if (result.usage) {
          const u = result.usage;
          inputTokens  = (u.input_tokens ?? 0)
                       + (u.cache_creation_input_tokens ?? 0)
                       + (u.cache_read_input_tokens ?? 0);
          outputTokens = u.output_tokens ?? outputTokens;
        }

        log("");
        log(`[generate-agent] Done — subtype=${exitSubtype}  turns=${turns}`);
        log(`[generate-agent] tokens — input: ${inputTokens}  output: ${outputTokens}`);
        log(`[generate-agent] result usage (raw): ${JSON.stringify(result.usage)}`);
        if (result.result) log(`[generate-agent] summary: ${result.result.slice(0, 300)}`);
        break;
      }
    }
  } finally {
    clearTimeout(wallTimeout);
  }

  const timeSeconds = (Date.now() - startMs) / 1000;

  log(`[generate-agent] Wall time: ${timeSeconds.toFixed(1)}s`);

  // ---------------------------------------------------------------------------
  // Write generation-meta.json (read by save-result.sh)
  // ---------------------------------------------------------------------------

  if (resultDir) {
    const meta = {
      model:        modelArg,
      inputTokens,
      outputTokens,
      timeSeconds,
      turns,
      retries:      turns,  // "retries" field expected by save-result.sh — use turns
      exitSubtype,
    };
    writeFileSync(join(resultDir, "generation-meta.json"), JSON.stringify(meta, null, 2), "utf-8");
    log(`[generate-agent] Wrote generation-meta.json`);
  }
}

run().catch((err: unknown) => {
  console.error("[generate-agent] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
