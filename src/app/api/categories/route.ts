import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    include: { children: { orderBy: { nameKa: "asc" } } },
    orderBy: { nameKa: "asc" }
  });
  return NextResponse.json({ categories });
}
