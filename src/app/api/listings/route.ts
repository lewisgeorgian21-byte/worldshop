import { ListingStatus, Prisma, ProductCondition } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { expireListings } from "@/lib/listing-expiration";
import { getListingExpiration } from "@/lib/listing-expiration";
import { expireVipListings } from "@/lib/listing-vip";
import { prisma } from "@/lib/prisma";
import { compareListings, type ListingDisplaySort } from "@/lib/listing-sort";
import { getListingValidationMessage, listingSchema } from "@/lib/validation";

export async function GET(request: Request) {
  await expireListings();
  await expireVipListings();
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim().slice(0, 100);
  const categoryId = params.get("category") || undefined;
  const requestedCondition = params.get("condition");
  const condition = Object.values(ProductCondition).find((value) => value === requestedCondition);
  const minPriceParam = params.get("minPrice");
  const maxPriceParam = params.get("maxPrice");
  const minPrice = minPriceParam !== null && /^\d+$/.test(minPriceParam) ? Number(minPriceParam) : undefined;
  const maxPrice = maxPriceParam !== null && /^\d+$/.test(maxPriceParam) ? Number(maxPriceParam) : undefined;
  const requestedSort = params.get("sort");
  const sort: ListingDisplaySort = requestedSort === "price-asc" || requestedSort === "price-desc" ? requestedSort : "newest";
  const price: Prisma.IntFilter = {
    ...(minPrice !== undefined ? { gte: minPrice } : {}),
    ...(maxPrice !== undefined ? { lte: maxPrice } : {})
  };
  const where: Prisma.ListingWhereInput = {
    status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED, ListingStatus.SOLD] },
    ...(categoryId ? { categoryId } : {}),
    ...(condition ? { condition } : {}),
    ...(Object.keys(price).length ? { price } : {}),
    ...(search ? { OR: [{ title: { contains: search } }, { description: { contains: search } }] } : {})
  };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: { seller: { select: { id: true, name: true } }, category: { select: { id: true, nameKa: true, nameEn: true } } }
    }),
    prisma.listing.count({ where })
  ]);
  items.sort((left, right) => compareListings(left, right, sort));
  return NextResponse.json({ items, page: 1, limit: total, total, pages: 1 });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return NextResponse.json({ error: "განცხადების განსათავსებლად სისტემაში შესვლა აუცილებელია." }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "გთხოვ, გადაამოწმე განცხადების მონაცემები." }, { status: 400 });
    const input = listingSchema.parse(body);
    const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "არჩეული კატეგორია ვერ მოიძებნა." }, { status: 400 });
    const listing = await prisma.listing.create({
      data: {
        ...input,
        sellerId: auth.user!.id,
        isVip: false,
        vipAssignedAt: null,
        vipExpiresAt: null,
        expiresAt: getListingExpiration()
      },
      include: {
        seller: { select: { id: true, name: true } },
        category: { select: { id: true, nameKa: true, nameEn: true } }
      }
    });
    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const field = error.issues[0]?.path[0];
      console.warn("Listing creation validation failed", error.issues.map((issue) => ({ path: issue.path, code: issue.code })));
      return NextResponse.json({
        error: getListingValidationMessage(error),
        field: typeof field === "string" ? field : null
      }, { status: 400 });
    }
    console.error("Listing creation failed", error);
    return NextResponse.json({ error: "განცხადების გამოქვეყნება ვერ მოხერხდა." }, { status: 500 });
  }
}
