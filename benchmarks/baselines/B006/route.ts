// B006 TypeScript baseline — list-pending-applications with filter

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const applications = await prisma.grantApplication.findMany({
    where: {
      status: "submitted",
      amount: {
        gte: 10000,
        lte: 500000,
      },
    },
  });

  return NextResponse.json(applications, { status: 200 });
}
