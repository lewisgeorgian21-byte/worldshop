import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { expireListings } from "@/lib/listing-expiration";
import { expireVipListings } from "@/lib/listing-vip";
import { createVipRejectionMessageBody } from "@/lib/message-notifications";
import { prisma } from "@/lib/prisma";
import { VIP_DURATION_HOURS } from "@/lib/vip";

type RouteContext = { params: Promise<{ id: string }> };
const reviewSchema = z.object({ decision: z.enum(["APPROVE", "REJECT"]) }).strict();

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VIP მოთხოვნის გადაწყვეტილება არასწორია." }, { status: 400 });
  }

  const { id } = await params;
  await expireListings();
  await expireVipListings();

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const purchase = await transaction.vipPurchase.findUnique({ where: { id } });
      if (!purchase) return { kind: "missing" as const };
      if (purchase.status !== "PENDING") return { kind: "not-pending" as const };

      const listing = await transaction.listing.findUnique({
        where: { id: purchase.listingId },
        select: { id: true, title: true, sellerId: true, status: true }
      });
      if (parsed.data.decision === "APPROVE") {
        if (!listing) return { kind: "listing-missing" as const };
        if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
          return { kind: "listing-unavailable" as const };
        }
      }

      const now = new Date();
      const updated = await transaction.vipPurchase.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewedAt: now,
          reviewedById: auth.user!.id,
          confirmedAt: parsed.data.decision === "APPROVE" ? now : null
        }
      });
      if (updated.count !== 1) return { kind: "not-pending" as const };

      const updatedListing = parsed.data.decision === "APPROVE"
        ? await transaction.listing.update({
          where: { id: purchase.listingId },
          data: {
            isVip: true,
            vipAssignedAt: now,
            vipExpiresAt: new Date(now.getTime() + VIP_DURATION_HOURS * 60 * 60 * 1000)
          }
        })
        : null;
      if (parsed.data.decision === "REJECT" && listing) {
        await transaction.message.create({
          data: {
            senderId: auth.user!.id,
            recipientId: listing.sellerId,
            listingId: listing.id,
            body: createVipRejectionMessageBody({
              type: "VIP_REQUEST_REJECTED",
              listingId: listing.id,
              listingTitle: listing.title
            }),
            isRead: false
          }
        });
      }
      const updatedPurchase = await transaction.vipPurchase.findUniqueOrThrow({ where: { id } });
      return { kind: "success" as const, purchase: updatedPurchase, listing: updatedListing };
    });

    if (result.kind === "missing") return NextResponse.json({ error: "VIP მოთხოვნა ვერ მოიძებნა." }, { status: 404 });
    if (result.kind === "not-pending") return NextResponse.json({ error: "VIP მოთხოვნა უკვე განხილულია." }, { status: 409 });
    if (result.kind === "listing-missing" || result.kind === "listing-unavailable") {
      return NextResponse.json({ error: "VIP მოთხოვნა ეკუთვნის მიუწვდომელ განცხადებას და ვერ დამტკიცდება." }, { status: 409 });
    }
    return NextResponse.json({ purchase: result.purchase, listing: result.listing });
  } catch (error) {
    console.error("VIP purchase review failed", error);
    return NextResponse.json({ error: "VIP მოთხოვნის დამუშავება ვერ მოხერხდა." }, { status: 500 });
  }
}
