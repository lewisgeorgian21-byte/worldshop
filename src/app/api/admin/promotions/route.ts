import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { promotionSchema } from "@/lib/promotion-validation";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const promotions = await prisma.promotion.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return NextResponse.json({ promotions });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    const input = promotionSchema.parse(body);
    const promotion = await prisma.promotion.create({ data: input });
    return NextResponse.json({ promotion }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Promotion details are invalid." }, { status: 400 });
    console.error("Promotion creation failed", error);
    return NextResponse.json({ error: "Could not create promotion." }, { status: 500 });
  }
}
