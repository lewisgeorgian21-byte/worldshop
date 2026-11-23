import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  nameKa: z.string().trim().min(2).max(100),
  nameEn: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  parentId: z.string().min(1).nullable().optional()
});

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const categories = await prisma.category.findMany({
    include: { _count: { select: { listings: true, children: true } } },
    orderBy: { nameKa: "asc" }
  });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "კატეგორიის მონაცემები არასწორია." }, { status: 400 });
    const input = schema.parse(body);
    const category = await prisma.category.create({ data: input });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "კატეგორიის მონაცემები არასწორია." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "ამ ბმულით კატეგორია უკვე არსებობს." }, { status: 409 });
    }
    console.error("Category creation failed", error);
    return NextResponse.json({ error: "კატეგორიის შექმნა ვერ მოხერხდა." }, { status: 500 });
  }
}
