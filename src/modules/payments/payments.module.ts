/**
 * PaymentsModule - Payment provider integration, webhook handling, payment lifecycle.
 */
import { Global, Logger, Module } from '@nestjs/common';

import { InvoicesModule } from '@modules/invoices';

import { FakePaymentAdapter } from './adapters/fake-payment.adapter';
import { StripePaymentAdapter } from './adapters/stripe-payment.adapter';
import { PaymentFailureHandler } from './handlers/payment-failure.handler';
import { PaymentSuccessHandler } from './handlers/payment-success.handler';
import { PaymentIntentService } from './payment-intent.service';
import { PAYMENT_PROVIDER } from './payment-provider.base';
import { WebhookProcessingService } from './webhook-processing.service';
import { WebhookController } from './webhook.controller';

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
  imports: [InvoicesModule],
  controllers: [WebhookController],
  providers: [
    paymentProviderFactory,
    PaymentIntentService,
    WebhookProcessingService,
    PaymentSuccessHandler,
    PaymentFailureHandler,
  ],
  exports: [PAYMENT_PROVIDER, PaymentIntentService],
})
export class PaymentsModule {}
