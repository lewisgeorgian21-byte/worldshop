import { ListingStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getListingImageUrls, removeUnusedUploadedImages } from "@/lib/listing-images";
import { prisma } from "@/lib/prisma";
import { listingSchema } from "@/lib/validation";
import { VIP_DURATION_HOURS } from "@/lib/vip";

type RouteContext = { params: Promise<{ id: string }> };
const statusSchema = z.object({ status: z.enum(["ACTIVE", "RESERVED", "PAUSED", "SOLD", "REMOVED"]) }).strict();
const vipSchema = z.object({ isVip: z.boolean() }).strict();
const vipDurationSchema = z.discriminatedUnion("vipAction", [
  z.object({
    vipAction: z.enum(["ADD_DAYS", "SUBTRACT_DAYS", "SET_DAYS"]),
    days: z.number().int().min(1).max(3650)
  }).strict(),
  z.object({ vipAction: z.literal("REVOKE") }).strict()
]);
const editSchema = listingSchema.extend({
  status: z.enum(["ACTIVE", "RESERVED", "PAUSED", "SOLD", "REMOVED"]).optional(),
  isVip: z.boolean().optional()
});

async function cleanupWarning(imageUrls: string[]) {
  try {
    const failedDeletions = await removeUnusedUploadedImages(imageUrls);
    if (failedDeletions.length) return "განცხადება განახლდა, თუმცა გამოუყენებელი სურათების წაშლა ვერ მოხერხდა.";
  } catch (error) {
    console.error("Admin listing image cleanup failed", error);
    return "განცხადება განახლდა, თუმცა გამოუყენებელი სურათების წაშლა ვერ მოხერხდა.";
  }
  return undefined;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "განცხადება ვერ მოიძებნა." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "გთხოვ, გადაამოწმე განცხადების მონაცემები." }, { status: 400 });
  }

  const statusInput = statusSchema.safeParse(body);
  if (statusInput.success) {
    const updated = await prisma.listing.update({
      where: { id },
      data: { status: statusInput.data.status as ListingStatus }
    });
    return NextResponse.json({ listing: updated });
  }
  if ("vipAction" in body) {
    const vipDurationInput = vipDurationSchema.safeParse(body);
    if (!vipDurationInput.success) {
      return NextResponse.json({ error: "VIP-ის ხანგრძლივობა უნდა იყოს 1-დან 3650 დღემდე." }, { status: 400 });
    }

    try {
      const now = new Date();
      const action = vipDurationInput.data.vipAction;
      const days = action === "REVOKE" ? 0 : vipDurationInput.data.days;
      const currentExpiry = listing.vipExpiresAt && listing.vipExpiresAt > now ? listing.vipExpiresAt : now;
      const expiresAt = action === "REVOKE"
        ? null
        : action === "SET_DAYS"
          ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
          : new Date(currentExpiry.getTime() + (action === "ADD_DAYS" ? days : -days) * 24 * 60 * 60 * 1000);
      const isVip = expiresAt !== null && expiresAt > now;
      const updated = await prisma.listing.update({
        where: { id },
        data: {
          isVip,
          vipExpiresAt: isVip ? expiresAt : null,
          vipAssignedAt: isVip ? now : null
        }
      });
      return NextResponse.json({ listing: updated });
    } catch (error) {
      console.error("Admin listing VIP duration update failed", error);
      return NextResponse.json({ error: "VIP ხანგრძლივობის შეცვლა ვერ მოხერხდა." }, { status: 500 });
    }
  }
  const vipInput = vipSchema.safeParse(body);
  if (vipInput.success) {
    const now = new Date();
    const updated = await prisma.listing.update({
      where: { id },
      data: {
        isVip: vipInput.data.isVip,
        vipAssignedAt: vipInput.data.isVip ? now : null,
        vipExpiresAt: vipInput.data.isVip
          ? new Date(now.getTime() + VIP_DURATION_HOURS * 60 * 60 * 1000)
          : null
      }
    });
    return NextResponse.json({ listing: updated });
  }

  try {
    const input = editSchema.parse(body);
    const { isVip, ...listingInput } = input;
    const now = new Date();
    const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "არჩეული კატეგორია ვერ მოიძებნა." }, { status: 400 });
    const updated = await prisma.listing.update({
      where: { id },
      data: {
        ...listingInput,
        ...(isVip === undefined ? {} : {
          isVip,
          vipAssignedAt: isVip ? now : null,
          vipExpiresAt: isVip ? new Date(now.getTime() + VIP_DURATION_HOURS * 60 * 60 * 1000) : null
        })
      },
      include: {
        seller: { select: { id: true, name: true, email: true } },
        category: { select: { id: true, nameKa: true, nameEn: true, slug: true } }
      }
    });
    const warning = await cleanupWarning(getListingImageUrls(listing.imageUrls));
    return NextResponse.json({ listing: updated, warning });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "გთხოვ, გადაამოწმე განცხადების მონაცემები." }, { status: 400 });
    console.error("Admin listing update failed", error);
    return NextResponse.json({ error: "განცხადების განახლება ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "განცხადება ვერ მოიძებნა." }, { status: 404 });

  const orderCount = await prisma.order.count({ where: { listingId: id } });
  if (orderCount > 0) {
    return NextResponse.json({ error: "შეკვეთასთან დაკავშირებული განცხადების წაშლა შეუძლებელია." }, { status: 409 });
  }
  try {
    await prisma.listing.delete({ where: { id } });
    const warning = await cleanupWarning(getListingImageUrls(listing.imageUrls));
    return NextResponse.json({ success: true, warning });
  } catch (error) {
    console.error("Admin listing deletion failed", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "შეკვეთასთან დაკავშირებული განცხადების წაშლა შეუძლებელია." }, { status: 409 });
    }
    return NextResponse.json({ error: "განცხადების წაშლა ვერ მოხერხდა." }, { status: 500 });
  }
}
