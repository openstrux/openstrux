// B005 TypeScript baseline — approve-application with RBAC

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasRole = session.user.roles.some(
    (r: string) => r === "reviewer" || r === "admin"
  );
  if (!hasRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.grantApplication.update({
    where: { id: params.id },
    data:  { status: "approved" },
  });

  return NextResponse.json(updated, { status: 200 });
}
