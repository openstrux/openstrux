// B009 TypeScript baseline — search-applications 5-step pipeline

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { z }                         from "zod";

const SearchParamsSchema = z.object({
  title:  z.string().optional(),
  status: z.string().optional(),
  minAmt: z.coerce.number().optional(),
  maxAmt: z.coerce.number().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());

  const parsed = SearchParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 422 });
  }

  const { title, status, minAmt, maxAmt } = parsed.data;

  const applications = await prisma.grantApplication.findMany({
    where: {
      ...(title  ? { title:  { contains: title  } } : {}),
      ...(status ? { status: { equals:   status } } : {}),
      ...(minAmt !== undefined || maxAmt !== undefined
        ? { amount: { gte: minAmt, lte: maxAmt } }
        : {}),
    },
    select: { id: true, title: true, status: true, amount: true },
  });

  return NextResponse.json(applications, { status: 200 });
}
