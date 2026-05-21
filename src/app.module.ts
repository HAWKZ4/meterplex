/**
 * AppModule - Root module of the Meterplex application.
 *
 * Module registration order matters:
 *   1. ConfigModule - FIRST, validates .env, makes ConfigService global
 *   2. PrismaModule - database connection, available globally
 *   3. HealthModule - readiness/liveness checks
 *   4. Feature modules - tenants, billing, usage, etc.
 */
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { CacheModule } from '@infra/cache';
import { MessagingModule } from '@infra/messaging';
import { OutboxModule } from '@infra/outbox';

import { ApiKeysModule } from '@modules/api-keys';
import { AuthModule } from '@modules/auth';
import { EntitlementCheckModule } from '@modules/entitlement-check';
import { EntitlementsModule } from '@modules/entitlements';
import { FeaturesModule } from '@modules/features';
import { InvoicesModule } from '@modules/invoices';
import { PaymentsModule } from '@modules/payments';
import { PlanPricesModule } from '@modules/plan-prices';
import { PlansModule } from '@modules/plans';
import { SubscriptionsModule } from '@modules/subscriptions';
import { TenantsModule } from '@modules/tenants';
import { UsageEventsModule } from '@modules/usage-events';
import { UsagePipelineModule } from '@modules/usage-pipeline';
import { UsersModule } from '@modules/users';

import {
  AuditLogInterceptor,
  CorrelationIdMiddleware,
  RequestLoggerMiddleware,
} from './common';
import { ConfigModule } from './config';
import { HealthModule } from './health';
import { PrismaModule } from './prisma';

@Module({
  imports: [
    // ConfigModule MUST be first - it validates .env and makes
    // ConfigService available globally. If env validation fails,
    // the app crashes here before any other module initializes.
    ConfigModule,
    // PrismaModule makes PrismaService available for injection
    // in any service across the entire app without re-importing.
    PrismaModule,
    // enables @Cron decorators
    ScheduleModule.forRoot(),
    // global, provides KafkaProducerService & KafkaConsumerService
    MessagingModule,
    // global, provides RedisService
    CacheModule,
    // HealthModule - readiness/liveness checks
    HealthModule,
    // Feature modules
    TenantsModule,
    UsersModule,
    AuthModule,
    ApiKeysModule,
    PlansModule,
    FeaturesModule,
    PlanPricesModule,
    EntitlementsModule,
    SubscriptionsModule,
    EntitlementCheckModule,
    UsageEventsModule,
    OutboxModule,
    UsagePipelineModule,
    InvoicesModule,
    PaymentsModule,
  ],
  controllers: [],
  providers: [
    // Global audit log interceptor - registered here so DI resolves
    // PrismaService and Reflector automatically. Applied globally in main.ts.
    AuditLogInterceptor,
  ],
})
export class AppModule implements NestModule {
  /**
   * configure() is called by NestJS during module initialization.
   * Middleware runs in the order registered, on every matching route.
   *
   * Order matters:
   *   1. CorrelationIdMiddleware - assigns x-correlation-id
   *   2. RequestLoggerMiddleware - logs request with that correlation ID
   *
   * forRoutes('*') applies to every route in the application.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggerMiddleware)
      .forRoutes('*path');
  }
}
