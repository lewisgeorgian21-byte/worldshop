import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const country = process.env.STRIPE_CONNECT_COUNTRY;
  const origin = getAppUrl();
  if (!country || !/^[A-Z]{2}$/.test(country) || !origin) {
    return NextResponse.json({ error: "Seller payments are not configured for this marketplace" }, { status: 503 });
  }
  try {
    const stripe = getStripe();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user!.id } });
    let accountId = user.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country,
        email: user.email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { userId: user.id }
      });
      accountId = account.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/?payments=refresh`,
      return_url: `${origin}/?payments=return`,
      type: "account_onboarding"
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Seller payment onboarding failed", error);
    return NextResponse.json({ error: "Could not open secure seller onboarding" }, { status: 503 });
  }
}
