// B007 TypeScript baseline — config inheritance equivalent (DP config + retry helper)

// lib/dp-config.ts
export const DP_CONFIG = {
  controller:    "NLnet Foundation",
  controllerId:  "NL-2024",
  dpo:           "dpo@nlnet.nl",
  record:        true,
  basis:         "legitimate_interest" as const,
};

// lib/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  timeoutMs = 30_000
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    return result as T;
  }
  throw new Error("Max retries exceeded");
}
