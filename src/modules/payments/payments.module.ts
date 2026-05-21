/**
 * PaymentsModule - Payment provider integration.
 *
 * Selects the adapter based on PAYMENT_PROVIDER env var:
 *   - 'stripe': real Stripe SDK (requires STRIPE_SECRET_KEY)
 *   - 'fake' (default): simulated payments for dev/testing
 *
 * To add a new provider:
 *   1. Create adapters/new-provider.adapter.ts extending PaymentProviderBase
 *   2. Implement the 4 abstract methods
 *   3. Add a case to the switch below
 *   4. Add env vars for the provider's API keys
 *
 * The adapter is injected via the PAYMENT_PROVIDER token.
 * Services use: @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProviderBase
 */
import { Global, Logger, Module } from '@nestjs/common';

import { FakePaymentAdapter } from './adapters/fake-payment.adapter';
import { StripePaymentAdapter } from './adapters/stripe-payment.adapter';
import { PAYMENT_PROVIDER } from './payment-provider.base';

const logger = new Logger('PaymentsModule');

const paymentProviderFactory = {
  provide: PAYMENT_PROVIDER,
  useFactory: () => {
    const provider = process.env.PAYMENT_PROVIDER ?? 'fake';

    switch (provider) {
      case 'stripe':
        return new StripePaymentAdapter();
      case 'fake':
        return new FakePaymentAdapter();
      default:
        logger.warn(
          `Unknown PAYMENT_PROVIDER "${provider}", falling back to fake`,
        );
        return new FakePaymentAdapter();
    }
  },
};

@Global()
@Module({
  providers: [paymentProviderFactory],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
