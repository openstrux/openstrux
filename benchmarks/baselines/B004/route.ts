// B004 TypeScript baseline — submit-application Next.js route handler

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GrantApplicationSchema } from "@/lib/schemas";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();

  const parsed = GrantApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 422 });
  }

  const record = await prisma.grantApplication.create({ data: parsed.data });

  return NextResponse.json(record, { status: 201 });
}
