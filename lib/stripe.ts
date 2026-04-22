import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

export const WELCOME_DISCOUNT_PERCENT = Number(
  process.env.WELCOME_DISCOUNT_PERCENT ?? "10"
);
