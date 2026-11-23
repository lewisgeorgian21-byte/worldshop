import { ListingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const [totalListings, totalUsers, activeListings] = await Promise.all([
    prisma.listing.count(),
    prisma.user.count(),
    prisma.listing.count({ where: { status: ListingStatus.ACTIVE } })
  ]);
  return NextResponse.json({ totalListings, totalUsers, activeListings });
}
