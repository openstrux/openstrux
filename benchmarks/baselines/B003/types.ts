// B003 TypeScript baseline — ReviewDecision discriminated union

export type ReviewDecision =
  | { kind: "approved"; approvedAmount: number }
  | { kind: "rejected"; reason: string }
  | { kind: "deferred"; reviewDate: Date };

// Prisma storage helpers (JSON column mapping)
export function decisionToJson(d: ReviewDecision): Record<string, unknown> {
  return { kind: d.kind, ...d };
}

export function decisionFromJson(raw: Record<string, unknown>): ReviewDecision {
  if (raw.kind === "approved") return { kind: "approved", approvedAmount: raw.approvedAmount as number };
  if (raw.kind === "rejected") return { kind: "rejected", reason: raw.reason as string };
  return { kind: "deferred", reviewDate: new Date(raw.reviewDate as string) };
}
