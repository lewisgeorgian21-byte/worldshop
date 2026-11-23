import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { expireListings } from "@/lib/listing-expiration";
import { expireVipListings } from "@/lib/listing-vip";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  await expireListings();
  await expireVipListings();
  const listings = await prisma.listing.findMany({
    include: {
      seller: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, nameKa: true, nameEn: true, slug: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ listings });
}
