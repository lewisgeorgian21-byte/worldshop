import { prisma } from "@/lib/prisma";

export async function expireVipListings(now = new Date()) {
  try {
    await prisma.listing.updateMany({
      where: { isVip: true, vipExpiresAt: { lte: now } },
      data: { isVip: false, vipAssignedAt: null, vipExpiresAt: null }
    });
  } catch (error) {
    console.error("Expired VIP listings could not be cleared", error);
  }
}
