import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promotionPatchSchema } from "@/lib/promotion-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const body = await request.json().catch(() => null);
    const input = promotionPatchSchema.parse(body);
    if (Object.keys(input).length === 0) return NextResponse.json({ error: "Promotion details are invalid." }, { status: 400 });
    const promotion = await prisma.promotion.update({ where: { id }, data: input });
    return NextResponse.json({ promotion });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Promotion details are invalid." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Promotion not found." }, { status: 404 });
    }
    console.error("Promotion update failed", error);
    return NextResponse.json({ error: "Could not update promotion." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    await prisma.promotion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Promotion not found." }, { status: 404 });
    }
    console.error("Promotion deletion failed", error);
    return NextResponse.json({ error: "Could not delete promotion." }, { status: 500 });
  }
}
