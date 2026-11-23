import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { expireListings } from "@/lib/listing-expiration";
import { expireVipListings } from "@/lib/listing-vip";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) {
    return NextResponse.json({ error: "ჩემი განცხადებების სანახავად სისტემაში შესვლა აუცილებელია." }, { status: 401 });
  }

  await expireListings();
  await expireVipListings();
  const [listings, pendingPurchases] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: auth.user!.id, status: { not: "REMOVED" } },
      include: {
        seller: { select: { id: true, name: true } },
        category: { select: { id: true, nameKa: true, nameEn: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.vipPurchase.findMany({
      where: { userId: auth.user!.id, status: "PENDING" },
      select: { listingId: true }
    })
  ]);
  const pendingListingIds = new Set(pendingPurchases.map((purchase) => purchase.listingId));
  return NextResponse.json({
    listings: listings.map((listing) => ({ ...listing, vipPurchasePending: pendingListingIds.has(listing.id) }))
  });
}
