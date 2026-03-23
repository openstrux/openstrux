#!/usr/bin/env node --experimental-strip-types
/**
 * generate-agent.ts — Benchmark generation via agentic loop.
 *
 * Supports two providers:
 *   - anthropic (default for claude-* models): uses @anthropic-ai/claude-agent-sdk.
 *     The agent reads stubs and tests, implements the backend, runs unit tests, iterates.
 *   - openai (any OpenAI-compatible API, e.g. z.ai GLM-5): custom tool-calling loop
 *     exposing bash, read_file, write_file, and list_files to the model.
 *
 * Usage:
 *   node --experimental-strip-types generate-agent.ts \
 *     --path <direct|openstrux> \
 *     --model <model-id> \
 *     --worktree <abs-path> \
 *     --result-dir <abs-path> \
 *     [--provider <anthropic|openai>]   # auto-detected from model name if omitted
 *     [--base-url <url>]                # default: https://api.z.ai/api/paas/v4 for openai
 *     [--max-turns <n>]
 *
 * Env vars:
 *   ANTHROPIC_API_KEY  — required for provider=anthropic
 *   ZAI_API_KEY        — required for provider=openai (fallback: OPENAI_API_KEY)
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const pathArg   = arg("--path") as "direct" | "openstrux" | undefined;
const modelArg  = arg("--model")      ?? "claude-sonnet-4-6";
const worktree  = resolve(arg("--worktree") ?? process.cwd());
const resultDir = arg("--result-dir") ? resolve(arg("--result-dir")!) : undefined;
const maxTurns  = parseInt(arg("--max-turns") ?? "80", 10);
const maxWallMs = 25 * 60 * 1000;

const providerArg = arg("--provider") as "anthropic" | "openai" | undefined;
const baseUrlArg  = arg("--base-url");

const provider: "anthropic" | "openai" = providerArg
  ?? (modelArg.startsWith("claude-") ? "anthropic" : "openai");

const DEFAULT_BASE_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai:    "https://api.z.ai/api/paas/v4",
};
const baseUrl = baseUrlArg ?? DEFAULT_BASE_URLS[provider];

if (!pathArg || !["direct", "openstrux"].includes(pathArg)) {
  console.error(
    "Usage: generate-agent.ts --path <direct|openstrux> --model <id> --worktree <dir> --result-dir <dir> [--provider <anthropic|openai>] [--base-url <url>] [--max-turns <n>]",
  );
  process.exit(1);
}

const apiKey = provider === "anthropic"
  ? process.env.ANTHROPIC_API_KEY
  : (process.env.ZAI_API_KEY ?? process.env.OPENAI_API_KEY);

if (!apiKey) {
  const keyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "ZAI_API_KEY or OPENAI_API_KEY";
  console.error(`Error: ${keyName} is not set`);
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
// Task prompts
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
  log(`[generate-agent] provider=${provider} model=${modelArg} path=${pathArg} maxTurns=${maxTurns}`);
  log(`[generate-agent] worktree=${worktree}`);
  log(`[generate-agent] base-url=${baseUrl}`);
  log("");

  if (provider === "anthropic") {
    await runAnthropicAgent();
  } else {
    await runOpenAIAgent();
  }
}

// ---------------------------------------------------------------------------
// Anthropic path — Claude Agent SDK
// ---------------------------------------------------------------------------

async function runAnthropicAgent(): Promise<void> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const startMs = Date.now();
  let inputTokens  = 0;
  let outputTokens = 0;
  let turns        = 0;
  let exitSubtype  = "unknown";

  const seenMessageIds = new Set<string>();
  const abortController = new AbortController();
  const wallTimeout = setTimeout(() => {
    log(`[generate-agent] Wall-clock limit reached — aborting.`);
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
        exitSubtype = result.subtype;
        turns       = result.num_turns;

        if (result.usage) {
          const u = result.usage;
          inputTokens  = (u.input_tokens ?? 0)
                       + (u.cache_creation_input_tokens ?? 0)
                       + (u.cache_read_input_tokens ?? 0);
          outputTokens = u.output_tokens ?? inputTokens;
        }

        log(`[generate-agent] Done — subtype=${exitSubtype}  turns=${turns}`);
        log(`[generate-agent] tokens — input: ${inputTokens}  output: ${outputTokens}`);
        if (result.result) log(`[generate-agent] summary: ${result.result.slice(0, 300)}`);
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
          path: { type: "string", description: "Directory path relative to the project root (default: .)" },
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

async function runOpenAIAgent(): Promise<void> {
  const chatUrl = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const startMs = Date.now();
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
        model:        modelArg,
        messages,
        tools:        OAI_TOOLS,
        tool_choice:  "auto",
        max_tokens:   8192,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      log(`[generate-agent] API error ${res.status}: ${text}`);
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
      // No tool calls — agent is done
      log(`[generate-agent] Agent finished (finish_reason=${choice.finish_reason})`);
      if (message.content) log(`[generate-agent] Summary: ${message.content.slice(0, 400)}`);
      break;
    }

    // Execute each tool call and append results
    for (const tc of toolCalls) {
      let toolArgs: Record<string, string> = {};
      try { toolArgs = JSON.parse(tc.function.arguments) as Record<string, string>; } catch { /* ignore */ }
      const preview = toolArgs.command ?? toolArgs.path ?? tc.function.name;
      log(`  → ${tc.function.name}(${preview})`);

      const result = execTool(tc.function.name, toolArgs);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  if (turns >= maxTurns) log(`[generate-agent] Warning: maxTurns (${maxTurns}) reached.`);
  if (Date.now() >= wallDeadline) log(`[generate-agent] Warning: wall-clock limit reached.`);

  log(`[generate-agent] Done — turns=${turns}  input=${inputTokens}  output=${outputTokens}`);
  writeMeta({ inputTokens, outputTokens, turns, exitSubtype: "success",
    timeSeconds: (Date.now() - startMs) / 1000 });
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
  log(`[generate-agent] Wall time: ${meta.timeSeconds.toFixed(1)}s`);

  if (resultDir) {
    writeFileSync(
      join(resultDir, "generation-meta.json"),
      JSON.stringify({ model: modelArg, provider, ...meta, retries: meta.turns }, null, 2),
      "utf-8",
    );
    log(`[generate-agent] Wrote generation-meta.json`);
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

run().catch((err: unknown) => {
  console.error("[generate-agent] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
