#!/usr/bin/env node --experimental-strip-types
/**
 * generate-api.ts — Benchmark generation via Anthropic Messages API.
 *
 * Assembles prompts + specs (order and paths read from benchmark.config.json
 * in the worktree root), calls the API with a clean context, parses fenced
 * code blocks, and writes files at their natural in-tree paths.
 *
 * Usage:
 *   node --experimental-strip-types generate-api.ts \
 *     --path <direct|openstrux> \
 *     --model <model-id> \
 *     --worktree <abs-path> \
 *     --result-dir <abs-path>
 *
 * Requires: ANTHROPIC_API_KEY env var, Node >= 24
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
    "Usage: generate-api.ts --path <direct|openstrux> [--model <id>] [--worktree <dir>] [--result-dir <dir>]",
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
}

const configPath = join(worktree, "benchmark.config.json");
if (!existsSync(configPath)) {
  console.error(`Error: benchmark.config.json not found in ${worktree}`);
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, "utf-8")) as BenchmarkConfig;

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

const prompt = parts.join("\n\n---\n\n");
console.log(`[generate-api] path=${pathArg} model=${modelArg}`);
console.log(`[generate-api] prompt: ${prompt.length} chars / ~${Math.round(prompt.length / 4)} tokens`);

// ---------------------------------------------------------------------------
// API call (streaming SSE via native fetch)
// ---------------------------------------------------------------------------

async function generate(): Promise<void> {
  let response = "";
  let inputTokens = 0;
  let outputTokens = 0;

  console.log("[generate-api] Calling Anthropic API (streaming)...\n");

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
      messages:   [{ role: "user", content: prompt }],
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
        // message_start carries input_tokens
        if (evt.type === "message_start" && evt.message?.usage) {
          inputTokens = evt.message.usage.input_tokens ?? 0;
        }
        // message_delta carries the final output_tokens count
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

  console.log("\n\n[generate-api] Generation complete.");
  console.log(`[generate-api] tokens — input: ${inputTokens}  output: ${outputTokens}  time: ${timeSeconds.toFixed(1)}s`);

  if (resultDir) {
    mkdirSync(resultDir, { recursive: true });
    writeFileSync(join(resultDir, "response.txt"), response, "utf-8");
  }

  // Parse and write files
  const files = parseFencedBlocks(response);
  console.log(`[generate-api] Parsed ${files.length} file(s).`);

  if (files.length === 0) {
    console.error("[generate-api] No files parsed — check result-dir/response.txt");
    process.exit(1);
  }

  for (const { path, content } of files) {
    const abs = join(worktree, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
    console.log(`[generate-api]   wrote: ${path}`);
  }

  // Gaps
  const gaps = parseGaps(response);
  if (gaps.length > 0 && resultDir) {
    writeFileSync(join(resultDir, "gaps.json"), JSON.stringify(gaps, null, 2), "utf-8");
    console.log(`[generate-api] ${gaps.length} gap(s) → gaps.json`);
  }

  // Write generation metadata for save-result.sh
  if (resultDir) {
    writeFileSync(
      join(resultDir, "generation-meta.json"),
      JSON.stringify({ fileCount: files.length, model: modelArg, inputTokens, outputTokens, timeSeconds }, null, 2),
      "utf-8",
    );
  }
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
    // Safety: relative in-tree paths only
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
// Run
// ---------------------------------------------------------------------------

generate().catch((err: unknown) => {
  console.error("[generate-api] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
