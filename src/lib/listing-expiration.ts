import { prisma } from "@/lib/prisma";

export const LISTING_LIFETIME_DAYS = 30;
const listingLifetimeMs = LISTING_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

export function getListingExpiration(createdAt = new Date()) {
  return new Date(createdAt.getTime() + listingLifetimeMs);
}

export async function expireListings(now = new Date()) {
  try {
    const listingsToBackfill = await prisma.listing.findMany({
      where: { expiresAt: null },
      select: { id: true, createdAt: true }
    });

    for (let offset = 0; offset < listingsToBackfill.length; offset += 100) {
      const batch = listingsToBackfill.slice(offset, offset + 100);
      await prisma.$transaction(batch.map((listing) => prisma.listing.updateMany({
        where: { id: listing.id, expiresAt: null },
        data: { expiresAt: getListingExpiration(listing.createdAt) }
      })));
    }

    await prisma.listing.updateMany({
      where: { status: { not: "REMOVED" }, expiresAt: { lte: now } },
      data: { status: "REMOVED", isVip: false, vipAssignedAt: null, vipExpiresAt: null }
    });
  } catch (error) {
    console.error("Expired listings could not be archived", error);
  }
}
