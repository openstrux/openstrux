// B010 TypeScript baseline — export-for-audit with pseudonymize + encrypt

import * as crypto from "node:crypto";
import { prisma }  from "@/lib/prisma";

export function pseudonymizeSha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function encryptField(
  value: string | number,
  keyRef: string
): Promise<string> {
  const key = await fetchKeyFromVault(keyRef);
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

async function fetchKeyFromVault(_ref: string): Promise<Buffer> {
  throw new Error("fetchKeyFromVault: not implemented");
}

interface AuditRecord {
  id:              string;
  applicantIdHash: string;
  titleEncrypted:  string;
  amountEncrypted: string;
  status:          string;
  submittedAt:     Date;
}

export async function exportForAudit(): Promise<AuditRecord[]> {
  const applications = await prisma.grantApplication.findMany();

  return Promise.all(
    applications.map(async (app) => ({
      id:              app.id,
      applicantIdHash: pseudonymizeSha256(app.applicantId),
      titleEncrypted:  await encryptField(app.title,  "audit-key"),
      amountEncrypted: await encryptField(app.amount, "audit-key"),
      status:          app.status,
      submittedAt:     app.submittedAt,
    }))
  );
}
