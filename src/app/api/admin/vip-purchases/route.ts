import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const purchases = await prisma.vipPurchase.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" }
    });
    const listings = await prisma.listing.findMany({
      where: { id: { in: purchases.map((purchase) => purchase.listingId) } },
      select: { id: true, title: true, status: true }
    });
    const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
    return NextResponse.json({
      purchases: purchases.map((purchase) => ({
        ...purchase,
        listing: listingsById.get(purchase.listingId) ?? null
      }))
    });
  } catch (error) {
    console.error("Pending VIP purchases could not be loaded", error);
    return NextResponse.json({ error: "VIP მოთხოვნების ჩატვირთვა ვერ მოხერხდა." }, { status: 500 });
  }
}
