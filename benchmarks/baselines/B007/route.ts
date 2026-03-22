// B007 TypeScript baseline — list-applications using shared helpers

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { withRetry }      from "./context";

export async function GET(): Promise<NextResponse> {
  const applications = await withRetry(() =>
    prisma.grantApplication.findMany()
  );
  return NextResponse.json(applications, { status: 200 });
}
