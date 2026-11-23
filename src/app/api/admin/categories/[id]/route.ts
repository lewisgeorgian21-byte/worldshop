import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  nameKa: z.string().trim().min(2).max(100).optional(),
  nameEn: z.string().trim().min(2).max(100).optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),
  parentId: z.string().min(1).nullable().optional()
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "კატეგორიის მონაცემები არასწორია." }, { status: 400 });
    const input = schema.parse(body);
    if (input.parentId === id) return NextResponse.json({ error: "კატეგორია საკუთარ თავზე მშობლად ვერ მიეთითება." }, { status: 400 });
    const category = await prisma.category.update({ where: { id }, data: input });
    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "კატეგორიის მონაცემები არასწორია." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "კატეგორია ვერ მოიძებნა." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "ამ ბმულით კატეგორია უკვე არსებობს." }, { status: 409 });
    }
    console.error("Category update failed", error);
    return NextResponse.json({ error: "კატეგორიის განახლება ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const category = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!category) return NextResponse.json({ error: "კატეგორია ვერ მოიძებნა." }, { status: 404 });
  const listingCount = await prisma.listing.count({ where: { categoryId: id } });
  if (listingCount > 0) return NextResponse.json({ error: "კატეგორიის წაშლამდე მასთან დაკავშირებული განცხადებები გადაიტანე." }, { status: 409 });
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
