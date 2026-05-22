/**
 * Meterplex Application Entry Point
 *
 * This file bootstraps the NestJS application and configures:
 *   - Global API prefix and versioning (/api/v1/...)
 *   - Swagger/OpenAPI documentation
 *   - Security headers (Helmet)
 *   - Response compression (gzip)
 *   - CORS for frontend access
 *   - Global validation pipe (reject malformed requests)
 *   - Graceful shutdown hooks (clean up DB connections on SIGTERM)
 *
 * Execution order matters here.
 * - Helmet must run before any response is sent.
 * - Compression must wrap the response stream early.
 * - Validation pipe must be global so no controller can skip it.
 */
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import compression from 'compression';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';

import { API_PREFIX, API_VERSION } from '@common/constants/app';
import { HttpExceptionFilter } from '@common/filters';
import { AuditLogInterceptor } from '@common/interceptors';

import { getWinstonConfig } from '@config/logger.config';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const ENV = process.env.NODE_ENV ?? 'development';

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(getWinstonConfig(ENV)),
    rawBody: true,
  });

  // =============================================================
  // Security - Helmet sets HTTP headers that protect against
  //    common attacks: XSS, clickjacking, MIME sniffing, etc.
  //    This MUST run before any route handler sends a response.
  // =============================================================
  app.use(
    helmet({
      // Scalar loads JS/CSS from CDN - default CSP blocks it.
      // Disabled in dev (where Scalar runs), enabled in prod (where it doesn't).
      contentSecurityPolicy: ENV === 'production',
    }),
  );

  // =============================================================
  // Compression - gzip responses over the wire.
  //    Reduces payload size by 60-80% for JSON responses.
  //    In production, we typically let a reverse proxy (nginx)
  //    handle this. But for dev and smaller deployments, this works.
  // =============================================================
  app.use(compression());

  // =============================================================
  // CORS - Controls which frontends can call this API.
  //    Reads allowed origins from env. In production, this is our
  //    actual frontend domain. Never use origin: true (allow all)
  //    in production - that's a security hole.
  // =============================================================
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // =============================================================
  // Global prefix - Every route starts with /api.
  //    /tenants becomes /api/tenants.
  //    Separates API routes from static assets, health checks, etc.
  //    We exclude /health so load balancers hit it without the prefix.
  // =============================================================
  app.setGlobalPrefix(API_PREFIX, {
    exclude: ['health'],
  });

  // =============================================================
  // API Versioning - URI-based: /api/v1/tenants, /api/v2/tenants.
  //
  //    Why URI versioning over header versioning?
  //    - Visible in the URL (easy to debug, easy to curl)
  //    - Works with Swagger out of the box
  //    - Every major API (Stripe, GitHub, Twilio) uses URI versioning
  //
  //    When we need a breaking change to an endpoint, we create
  //    a v2 controller alongside v1. Old clients keep working.
  // =============================================================
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });

  // =============================================================
  // Global Exception Filter - Catches ALL unhandled exceptions
  //     and returns a consistent JSON error response.
  //     Without this, unhandled errors leak stack traces to clients.
  // =============================================================
  app.useGlobalFilters(new HttpExceptionFilter());

  // =============================================================
  // Global Audit Log Interceptor - Records every mutation
  //    (POST, PATCH, PUT, DELETE) to the audit_logs table.
  //    Runs after the route handler completes. Fire-and-forget:
  //    audit failures are logged but never block the response.
  //
  //    Skips: GET requests, health checks, auth endpoints.
  //    Use @SkipAudit() decorator to exclude specific routes.
  //
  //    Retrieved from the DI container (not new()) because it
  //    depends on PrismaService and Reflector.
  // =============================================================
  app.useGlobalInterceptors(app.get(AuditLogInterceptor));

  // =============================================================
  // Global Validation Pipe -
  //    Rejects invalid request bodies
  //    BEFORE they reach our business logic.
  //
  //    How it works:
  //    - Our DTO class has decorators: @IsEmail(), @IsString(), etc.
  //    - When a request comes in, this pipe validates the body
  //      against those decorators automatically.
  //    - If validation fails, the client gets a 400 with clear errors.
  //    - Our controller code never sees invalid data.
  //
  //    Options explained:
  //    - whitelist: strips properties not in the DTO (prevents injection)
  //    - forbidNonWhitelisted: rejects request if extra properties sent
  //    - transform: auto-converts types (string "5" → number 5)
  // =============================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // =============================================================
  // API Documentation - Swagger spec + Scalar UI
  //
  //    Swagger generates the OpenAPI JSON spec from your decorators.
  //    Scalar renders it as a modern, interactive docs page.
  //
  //    /api/docs        → Scalar UI (beautiful, interactive)
  //    /api/docs-json   → Raw OpenAPI JSON (for Bruno, Postman, SDK generators)
  //
  //    Only enabled in non-production. You don't expose internal
  //    API docs in production unless it's a public API.
  // =============================================================
  if (ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Meterplex API')
      .setDescription(
        'B2B usage metering, entitlements, and billing platform. ' +
          'Manages tenants, plans, subscriptions, usage tracking, ' +
          'and invoice generation.',
      )
      .setVersion(API_VERSION)
      .addBearerAuth()
      .addTag(
        'Auth',
        'Authentication, token generation, and registration flows',
      )
      .addTag('Users', 'User account profile management')
      .addTag(
        'Tenants',
        'Organization management, settings, and role memberships',
      )
      .addTag(
        'API Keys',
        'Server-to-server API key management for authentication',
      )
      .addTag('Plans', 'Global pricing plan definitions')
      .addTag(
        'Plan Prices',
        'Billing pricing tiers (base fees and overage costs)',
      )
      .addTag(
        'Features',
        'Global feature catalog definition (metered, boolean, etc.)',
      )
      .addTag('Subscriptions', 'Tenant plan subscription lifecycle')
      .addTag('Entitlements', 'Static definitions of plan features and limits')
      .addTag(
        'Entitlement Checks',
        'Runtime checks for customer access and quotas',
      )
      .addTag('Usage Events', 'High-throughput usage ingestion endpoint')
      .addTag(
        'Invoices',
        'Draft generation, lifecycle, and invoice item details',
      )
      .addTag('Billing', 'Tenant double-entry ledger and balance querying')
      .addTag('Payments', 'Payment processing and invoice payment attempts')
      .addTag(
        'Webhooks',
        'Payment provider webhook events (Stripe, fake, etc.)',
      )
      .addTag('Health', 'System uptime and dependency checks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    // Raw OpenAPI JSON - importable by Bruno, Postman, SDK generators.
    SwaggerModule.setup(`${API_PREFIX}/swagger`, app, document, {
      jsonDocumentUrl: `${API_PREFIX}/docs-json`,
    });

    // Scalar UI - modern interactive API docs replacing Swagger UI.
    // Dynamic import avoids CJS/ESM compatibility issues.
    const { apiReference } = await import('@scalar/nestjs-api-reference');
    app.use(
      `/${API_PREFIX}/docs`,
      apiReference({
        content: document,
        theme: 'purple',
      }),
    );
  }

  // =============================================================
  // Graceful Shutdown - When the process receives SIGTERM
  //    (e.g., Kubernetes rolling update, docker compose down),
  //    NestJS will:
  //    1. Stop accepting new connections
  //    2. Wait for in-flight requests to complete
  //    3. Close database connections cleanly
  //    4. Disconnect Kafka consumers
  //
  //    Without this, active database transactions get killed
  //    mid-operation, potentially corrupting data.
  // =============================================================
  app.enableShutdownHooks();

  // =============================================================
  // Start listening
  // =============================================================
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`
  ┌──────────────────────────────────────────────┐
  │  Meterplex API running                       │
  │  Local:   http://localhost:${String(port).padEnd(4)}              │
  │  Docs:    http://localhost:${String(port).padEnd(4)}/api/docs     │
  │  Health:  http://localhost:${String(port).padEnd(4)}/health       │
  │  Mode:    ${String(ENV ?? 'development').padEnd(35)}│
  └──────────────────────────────────────────────┘
  `);
}

void bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
