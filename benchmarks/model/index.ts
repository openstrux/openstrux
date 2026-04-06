/**
 * Benchmark result schema — shared by runner (save-result) and viewer.
 * Matches the benchmark.json written by benchmarks/runner/save-result.sh.
 */

import { z } from "zod";

export const TestSuiteResultSchema = z.object({
  total:  z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const BenchmarkResultSchema = z.object({
  timestamp:          z.string().datetime(),
  path:               z.enum(["direct", "openstrux"]),
  promptVersion:      z.string(),
  llm:                z.string(),
  generatedFileCount: z.number().int().nonnegative(),
  totalLines:         z.number().int().nonnegative(),
  inputTokens:        z.number().int().nonnegative(),
  outputTokens:       z.number().int().nonnegative(),
  timeSeconds:        z.number().nonnegative(),
  retries:            z.number().int().nonnegative().default(0),
  testSuites: z.object({
    unit:         TestSuiteResultSchema,
    integration:  TestSuiteResultSchema.optional(),
  }),
  testResults:  z.string(),
  note:         z.string().optional(),
  gaps:         z.array(z.string()).default([]),
});

export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;
