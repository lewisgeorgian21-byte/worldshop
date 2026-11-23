import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe payments are not configured. Set STRIPE_SECRET_KEY.");
  return new Stripe(key);
}
