import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const cashOrderSchema = z.object({
  listingId: z.string().min(1),
  buyerName: z.string().trim().min(1).max(100),
  buyerPhone: z.string().trim().min(5).max(40),
  deliveryMethod: z.enum(["MEETUP", "DELIVERY"]),
  deliveryAddress: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional()
}).strict().refine((data) => data.deliveryMethod !== "DELIVERY" || !!data.deliveryAddress, {
  message: "A delivery address is required",
  path: ["deliveryAddress"]
}).refine((data) => data.deliveryMethod !== "MEETUP" || !data.deliveryAddress, {
  message: "A delivery address is not needed for a meetup",
  path: ["deliveryAddress"]
});

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const [purchases, sales] = await Promise.all([
      prisma.order.findMany({
        where: { buyerId: auth.user!.id, hiddenFromBuyer: false },
        include: { listing: { select: { id: true, title: true, imageUrls: true } }, seller: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.order.findMany({
        where: { sellerId: auth.user!.id, hiddenFromSeller: false },
        include: { listing: { select: { id: true, title: true, imageUrls: true } }, buyer: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);
    return NextResponse.json({
      purchases,
      sales: sales.map((order) => ({ ...order, isNew: !order.sellerRead }))
    });
  } catch (error) {
    console.error("Account orders could not be loaded", error);
    return NextResponse.json({ error: "შეკვეთების ჩატვირთვა ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function PATCH() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    await prisma.order.updateMany({
      where: { sellerId: auth.user!.id, sellerRead: false, hiddenFromSeller: false },
      data: { sellerRead: true }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Incoming orders could not be marked as read", error);
    return NextResponse.json({ error: "შეკვეთების წაკითხულად მონიშვნა ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = cashOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Order details are invalid", code: "INVALID_ORDER_DETAILS" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing || (listing.status !== "ACTIVE" && listing.status !== "RESERVED")) {
    return NextResponse.json({ error: "This listing is no longer available", code: "LISTING_UNAVAILABLE" }, { status: 404 });
  }
  if (listing.sellerId === auth.user!.id) {
    return NextResponse.json({ error: "You cannot purchase your own listing" }, { status: 400 });
  }

  try {
    const order = await prisma.order.create({
      data: {
        buyerId: auth.user!.id,
        sellerId: listing.sellerId,
        listingId: listing.id,
        amount: listing.price * 100,
        commissionAmount: 0,
        buyerName: parsed.data.buyerName,
        buyerPhone: parsed.data.buyerPhone,
        deliveryMethod: parsed.data.deliveryMethod,
        deliveryAddress: parsed.data.deliveryAddress,
        paymentMethod: "CASH",
        note: parsed.data.note,
        sellerRead: false
      },
      select: { id: true, status: true }
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Cash order creation failed", error);
    return NextResponse.json({ error: "შეკვეთის შენახვა დროებით ვერ მოხერხდა.", code: "ORDER_CREATE_FAILED" }, { status: 500 });
  }
}
