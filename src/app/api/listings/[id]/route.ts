import { ListingStatus, type Listing as ListingRecord } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { requireUser } from "@/lib/auth";
import { getListingImageUrls, removeUnusedUploadedImages } from "@/lib/listing-images";
import { prisma } from "@/lib/prisma";
import { getListingValidationMessage, listingSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };
const statusSchema = z.object({ status: z.enum(["ACTIVE", "PAUSED", "RESERVED", "SOLD"]) }).strict();
const vipSchema = z.object({ isVip: z.boolean() }).strict();

async function imageCleanupWarning(imageUrls: string[]) {
  try {
    const failedDeletions = await removeUnusedUploadedImages(imageUrls);
    if (failedDeletions.length) return "განცხადება განახლდა, თუმცა გამოუყენებელი სურათების წაშლა ვერ მოხერხდა.";
  } catch (error) {
    console.error("Listing image cleanup failed", error);
    return "განცხადება განახლდა, თუმცა გამოუყენებელი სურათების წაშლა ვერ მოხერხდა.";
  }
  return undefined;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireUser();
  if (auth.response) return auth.response;

  let listing: ListingRecord | null;
  try {
    listing = await prisma.listing.findUnique({ where: { id } });
  } catch (error) {
    console.error("Listing update lookup failed", error);
    return NextResponse.json({ error: "განცხადების განახლება ვერ მოხერხდა." }, { status: 500 });
  }
  if (!listing) return NextResponse.json({ error: "განცხადება ვერ მოიძებნა." }, { status: 404 });
  if (listing.sellerId !== auth.user!.id) return NextResponse.json({ error: "ამ განცხადების შეცვლის უფლება არ გაქვს." }, { status: 403 });
  if (!["ACTIVE", "PAUSED", "RESERVED", "SOLD"].includes(listing.status)) {
    return NextResponse.json({ error: "ამ վիճակում գտնվող განცხადების შეცვლა შეუძლებელია." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "გთხოვ, გადაამოწმე განცხადების მონაცემები." }, { status: 400 });
  }

  const statusInput = statusSchema.safeParse(body);
  if (statusInput.success) {
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { status: statusInput.data.status as ListingStatus }
    });
    return NextResponse.json({ listing: updated });
  }
  const vipInput = vipSchema.safeParse(body);
  if (vipInput.success) {
    if (vipInput.data.isVip) {
      return NextResponse.json({ error: "VIP სტატუსის ჩასართავად საჭიროა მისი შეძენა." }, { status: 409 });
    }
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: { isVip: false, vipAssignedAt: null, vipExpiresAt: null }
    });
    return NextResponse.json({ listing: updated });
  }

  try {
    const input = listingSchema.parse(body);
    const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ error: "არჩეული კატეგორია ვერ მოიძებნა." }, { status: 400 });
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: input,
      include: {
        seller: { select: { id: true, name: true } },
        category: { select: { id: true, nameKa: true, nameEn: true } }
      }
    });
    const warning = await imageCleanupWarning(getListingImageUrls(listing.imageUrls));
    return NextResponse.json({ listing: updated, warning });
  } catch (error) {
    if (error instanceof ZodError) {
      const field = error.issues[0]?.path[0];
      console.warn("Listing update validation failed", error.issues.map((issue) => ({ path: issue.path, code: issue.code })));
      return NextResponse.json({
        error: getListingValidationMessage(error),
        field: typeof field === "string" ? field : null
      }, { status: 400 });
    }
    console.error("Listing update failed", error);
    return NextResponse.json({ error: "განცხადების განახლება ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return NextResponse.json({ error: "განცხადება ვერ მოიძებნა." }, { status: 404 });
  if (listing.sellerId !== auth.user!.id) return NextResponse.json({ error: "ამ განცხადების წაშლის უფლება არ გაქვს." }, { status: 403 });
  if (listing.status === "SOLD") {
    return NextResponse.json({ error: "გაყიდული განცხადების წაშლა შეუძლებელია." }, { status: 409 });
  }
  const orderCount = await prisma.order.count({ where: { listingId: id } });
  if (orderCount > 0) {
    return NextResponse.json({ error: "შეკვეთასთან დაკავშირებული განცხადების წაშლა შეუძლებელია." }, { status: 409 });
  }

  try {
    await prisma.listing.delete({ where: { id } });
    const warning = await imageCleanupWarning(getListingImageUrls(listing.imageUrls));
    return NextResponse.json({ success: true, warning });
  } catch (error) {
    console.error("Listing deletion failed", error);
    return NextResponse.json({ error: "განცხადების წაშლა ვერ მოხერხდა." }, { status: 500 });
  }
}
