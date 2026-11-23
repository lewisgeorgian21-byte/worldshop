import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { z } from "zod";

const checkoutSchema = z.object({
  listingId: z.string().min(1),
  buyerName: z.string().trim().min(1).max(100).optional(),
  buyerPhone: z.string().trim().min(5).max(40).optional(),
  deliveryMethod: z.enum(["MEETUP", "DELIVERY"]).optional(),
  deliveryAddress: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional()
}).strict();

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Order details are invalid" }, { status: 400 });
  if (parsed.data.deliveryMethod === "DELIVERY" && !parsed.data.deliveryAddress?.trim()) {
    return NextResponse.json({ error: "A delivery address is required" }, { status: 400 });
  }
  if (parsed.data.deliveryMethod === "MEETUP" && parsed.data.deliveryAddress) {
    return NextResponse.json({ error: "A delivery address is not needed for a meetup" }, { status: 400 });
  }
  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: { seller: { select: { id: true, stripeAccountId: true, stripeChargesEnabled: true } } }
  });
  if (!listing || (listing.status !== "ACTIVE" && listing.status !== "RESERVED")) {
    return NextResponse.json({ error: "This listing is no longer available", code: "LISTING_UNAVAILABLE" }, { status: 404 });
  }
  if (listing.sellerId === auth.user!.id) return NextResponse.json({ error: "You cannot purchase your own listing" }, { status: 400 });
  if (!listing.seller.stripeAccountId || !listing.seller.stripeChargesEnabled) {
    return NextResponse.json({ error: "This seller has not enabled secure online payments yet", code: "SELLER_PAYMENTS_UNAVAILABLE" }, { status: 409 });
  }
  const commissionPercent = Number(process.env.PLATFORM_COMMISSION_PERCENT || 8);
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 30) {
    return NextResponse.json({ error: "Payment commission is not configured correctly" }, { status: 500 });
  }
  let orderId: string | undefined;
  let stripeSessionId: string | undefined;
  const amountMinor = listing.price * 100;
  try {
    const stripe = getStripe();
    const order = await prisma.order.create({
      data: {
        buyerId: auth.user!.id,
        sellerId: listing.sellerId,
        listingId: listing.id,
        amount: amountMinor,
        commissionAmount: Math.round(amountMinor * commissionPercent / 100),
        buyerName: parsed.data.buyerName,
        buyerPhone: parsed.data.buyerPhone,
        deliveryMethod: parsed.data.deliveryMethod,
        deliveryAddress: parsed.data.deliveryAddress,
        paymentMethod: "CARD",
        note: parsed.data.note,
        sellerRead: false
      }
    });
    orderId = order.id;
    const origin = process.env.APP_URL;
    if (!origin) throw new Error("APP_URL is required for checkout redirects");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: listing.currency.toLowerCase(),
          unit_amount: order.amount,
          product_data: { name: listing.title, description: listing.description.slice(0, 500) }
        }
      }],
      payment_intent_data: {
        application_fee_amount: order.commissionAmount,
        transfer_data: { destination: listing.seller.stripeAccountId }
      },
      metadata: { orderId: order.id },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`
    });
    stripeSessionId = session.id;
    if (!session.url) throw new Error("Stripe did not return a hosted checkout URL");
    await prisma.order.update({ where: { id: order.id }, data: { stripeCheckoutSession: session.id } });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (stripeSessionId) {
      try {
        await getStripe().checkout.sessions.expire(stripeSessionId);
      } catch (expireError) {
        console.error("Could not expire incomplete Stripe checkout", expireError);
      }
    }
    if (orderId) await prisma.order.updateMany({ where: { id: orderId, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
    console.error("Stripe checkout creation failed", error);
    return NextResponse.json({ error: "Could not start secure checkout. Please try again later." }, { status: 503 });
  }
}
