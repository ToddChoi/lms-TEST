import Stripe from 'stripe'

// Lazy getter to avoid instantiating at module load when env is missing (build time).
let _stripe: Stripe | null = null

export function getStripeServer(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    })
  }
  return _stripe
}
