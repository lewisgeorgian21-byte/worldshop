import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

async function releaseOrder(orderId: string) {
  await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "CANCELLED" }
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(Buffer.from(await request.arrayBuffer()), signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const checkout = event.data.object as Stripe.Checkout.Session;
    const orderId = checkout.metadata?.orderId;
    if (checkout.payment_status === "paid" && orderId) {
      const needsRefund = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order || order.status !== "PENDING_PAYMENT") return null;
        if (
          order.stripeCheckoutSession !== checkout.id ||
          checkout.amount_total !== order.amount ||
          checkout.currency !== order.currency
        ) {
          console.error("Stripe checkout amount or currency did not match the order", { orderId });
          return null;
        }
        const updated = await tx.listing.updateMany({
          where: { id: order.listingId, status: { in: ["ACTIVE", "RESERVED"] } },
          data: { status: "SOLD" }
        });
        if (updated.count !== 1) return order.id;
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
        return null;
      });
      if (needsRefund) {
        const paymentIntentId = typeof checkout.payment_intent === "string" ? checkout.payment_intent : null;
        if (!paymentIntentId) {
          console.error("Paid checkout did not include a payment intent for duplicate-order refund", { orderId });
          return NextResponse.json({ error: "Payment refund could not be prepared" }, { status: 500 });
        }
        try {
          await getStripe().refunds.create({
            payment_intent: paymentIntentId,
            reverse_transfer: true,
            refund_application_fee: true,
            reason: "duplicate"
          }, { idempotencyKey: `duplicate-order-refund-${needsRefund}` });
          await prisma.order.updateMany({
            where: { id: needsRefund, status: "PENDING_PAYMENT" },
            data: { status: "REFUNDED" }
          });
        } catch (error) {
          console.error("Could not refund checkout for an unavailable listing", error);
          return NextResponse.json({ error: "Payment refund could not be completed" }, { status: 500 });
        }
      }
    }
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const checkout = event.data.object as Stripe.Checkout.Session;
    if (checkout.metadata?.orderId) await releaseOrder(checkout.metadata.orderId);
  } else if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    await prisma.user.updateMany({
      where: { stripeAccountId: account.id },
      data: {
        stripeChargesEnabled: account.charges_enabled,
        stripePayoutsEnabled: account.payouts_enabled
      }
    });
  }
  return NextResponse.json({ received: true });
}
