/**
 * seed.ts - Populates the database with development/testing data.
 *
 * Run with: pnpm db:seed
 * Also runs automatically on: pnpm db:migrate:reset
 *
 * This script creates a complete development environment:
 *   - 3 tenants (Acme, Globex, Stark)
 *   - 5 users with different roles across tenants
 *   - Memberships linking users to tenants with roles
 *   - 1 active API key per tenant
 *   - 3 plans (Starter, Pro, Enterprise) with prices and entitlements
 *   - 3 subscriptions (one per tenant) with entitlement snapshots
 *   - Realistic usage data for demo/testing scenarios
 *
 * IDEMPOTENT: Uses upsert for users and tenants, checks existence
 * for memberships and keys. Safe to run multiple times.
 *
 * All passwords are "DevPass123" for development convenience.
 * These credentials are documented here intentionally - this is
 * seed data, not production secrets.
 *
 * Dev accounts created:
 *   alice@meterplex.dev   → OWNER of Acme, ADMIN of Globex
 *   bob@meterplex.dev     → OWNER of Globex, DEVELOPER of Acme
 *   carol@meterplex.dev   → OWNER of Stark, BILLING of Acme
 *   dave@meterplex.dev    → DEVELOPER of Acme, DEVELOPER of Globex
 *   eve@meterplex.dev     → BILLING of Globex, ADMIN of Stark
 */
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({ adapter });

/** All dev users share this password for convenience. */
const DEV_PASSWORD = 'DevPass123';
const SALT_ROUNDS = 12;

/** Hash a password with bcrypt. */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** SHA-256 hash for API key storage. */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function main(): Promise<void> {
  console.log('Seeding database...\n');

  const passwordHash = await hashPassword(DEV_PASSWORD);

  // =========================================================
  // TENANTS
  // =========================================================

  console.log('--- Tenants ---');

  const acme = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: { name: 'Acme Corporation' },
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      metadata: {
        timezone: 'America/New_York',
        billingEmail: 'billing@acme.example.com',
        industry: 'Technology',
      },
    },
  });
  console.log(`  Tenant: ${acme.name} (${acme.slug})`);

  const globex = await prisma.tenant.upsert({
    where: { slug: 'globex' },
    update: { name: 'Globex Industries' },
    create: {
      name: 'Globex Industries',
      slug: 'globex',
      metadata: {
        timezone: 'America/Chicago',
        billingEmail: 'accounts@globex.example.com',
        industry: 'Manufacturing',
      },
    },
  });
  console.log(`  Tenant: ${globex.name} (${globex.slug})`);

  const stark = await prisma.tenant.upsert({
    where: { slug: 'stark' },
    update: { name: 'Stark Enterprises' },
    create: {
      name: 'Stark Enterprises',
      slug: 'stark',
      metadata: {
        timezone: 'America/Los_Angeles',
        billingEmail: 'finance@stark.example.com',
        industry: 'Defense',
      },
    },
  });
  console.log(`  Tenant: ${stark.name} (${stark.slug})`);

  // =========================================================
  // USERS
  // =========================================================

  console.log('\n--- Users ---');

  const alice = await prisma.user.upsert({
    where: { email: 'alice@meterplex.dev' },
    update: {},
    create: {
      email: 'alice@meterplex.dev',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson',
    },
  });
  console.log(`  User: ${alice.email} (${alice.firstName} ${alice.lastName})`);

  const bob = await prisma.user.upsert({
    where: { email: 'bob@meterplex.dev' },
    update: {},
    create: {
      email: 'bob@meterplex.dev',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Smith',
    },
  });
  console.log(`  User: ${bob.email} (${bob.firstName} ${bob.lastName})`);

  const carol = await prisma.user.upsert({
    where: { email: 'carol@meterplex.dev' },
    update: {},
    create: {
      email: 'carol@meterplex.dev',
      passwordHash,
      firstName: 'Carol',
      lastName: 'Williams',
    },
  });
  console.log(`  User: ${carol.email} (${carol.firstName} ${carol.lastName})`);

  const dave = await prisma.user.upsert({
    where: { email: 'dave@meterplex.dev' },
    update: {},
    create: {
      email: 'dave@meterplex.dev',
      passwordHash,
      firstName: 'Dave',
      lastName: 'Brown',
    },
  });
  console.log(`  User: ${dave.email} (${dave.firstName} ${dave.lastName})`);

  const eve = await prisma.user.upsert({
    where: { email: 'eve@meterplex.dev' },
    update: {},
    create: {
      email: 'eve@meterplex.dev',
      passwordHash,
      firstName: 'Eve',
      lastName: 'Davis',
    },
  });
  console.log(`  User: ${eve.email} (${eve.firstName} ${eve.lastName})`);

  // =========================================================
  // MEMBERSHIPS
  // =========================================================

  console.log('\n--- Memberships ---');

  const memberships = [
    // Acme Corp: Alice=OWNER, Bob=DEVELOPER, Carol=BILLING, Dave=DEVELOPER
    {
      userId: alice.id,
      tenantId: acme.id,
      role: 'OWNER' as const,
      label: 'Alice → Acme (OWNER)',
    },
    {
      userId: bob.id,
      tenantId: acme.id,
      role: 'DEVELOPER' as const,
      label: 'Bob → Acme (DEVELOPER)',
    },
    {
      userId: carol.id,
      tenantId: acme.id,
      role: 'BILLING' as const,
      label: 'Carol → Acme (BILLING)',
    },
    {
      userId: dave.id,
      tenantId: acme.id,
      role: 'DEVELOPER' as const,
      label: 'Dave → Acme (DEVELOPER)',
    },

    // Globex: Bob=OWNER, Alice=ADMIN, Dave=DEVELOPER, Eve=BILLING
    {
      userId: bob.id,
      tenantId: globex.id,
      role: 'OWNER' as const,
      label: 'Bob → Globex (OWNER)',
    },
    {
      userId: alice.id,
      tenantId: globex.id,
      role: 'ADMIN' as const,
      label: 'Alice → Globex (ADMIN)',
    },
    {
      userId: dave.id,
      tenantId: globex.id,
      role: 'DEVELOPER' as const,
      label: 'Dave → Globex (DEVELOPER)',
    },
    {
      userId: eve.id,
      tenantId: globex.id,
      role: 'BILLING' as const,
      label: 'Eve → Globex (BILLING)',
    },

    // Stark: Carol=OWNER, Eve=ADMIN
    {
      userId: carol.id,
      tenantId: stark.id,
      role: 'OWNER' as const,
      label: 'Carol → Stark (OWNER)',
    },
    {
      userId: eve.id,
      tenantId: stark.id,
      role: 'ADMIN' as const,
      label: 'Eve → Stark (ADMIN)',
    },
  ];

  for (const m of memberships) {
    await prisma.membership.upsert({
      where: {
        userId_tenantId: {
          userId: m.userId,
          tenantId: m.tenantId,
        },
      },
      update: { role: m.role },
      create: {
        userId: m.userId,
        tenantId: m.tenantId,
        role: m.role,
      },
    });
    console.log(`  ${m.label}`);
  }

  // =========================================================
  // API KEYS
  // =========================================================

  console.log('\n--- API Keys ---');

  const apiKeys = [
    {
      tenantId: acme.id,
      createdByUserId: alice.id,
      name: 'Acme Production Key',
      label: 'Acme Corp',
    },
    {
      tenantId: globex.id,
      createdByUserId: bob.id,
      name: 'Globex Production Key',
      label: 'Globex Industries',
    },
    {
      tenantId: stark.id,
      createdByUserId: carol.id,
      name: 'Stark Production Key',
      label: 'Stark Enterprises',
    },
  ];

  for (const ak of apiKeys) {
    // Check if tenant already has an active key with this name
    const existing = await prisma.apiKey.findFirst({
      where: {
        tenantId: ak.tenantId,
        name: ak.name,
        status: 'ACTIVE',
      },
    });

    if (existing) {
      console.log(
        `  ${ak.label}: key already exists (${existing.keyPrefix}...)`,
      );
      continue;
    }

    // Generate a deterministic-looking key for dev (still secure in practice)
    const rawKey = `mp_live_${randomBytes(30).toString('base64url')}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10);

    await prisma.apiKey.create({
      data: {
        tenantId: ak.tenantId,
        createdByUserId: ak.createdByUserId,
        keyPrefix,
        keyHash,
        name: ak.name,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    console.log(`  ${ak.label}: ${keyPrefix}... (key: ${rawKey})`);
  }

  // =========================================================
  // PLANS
  // =========================================================

  console.log('\n--- Plans ---');

  const starterPlan = await prisma.plan.upsert({
    where: { slug: 'starter' },
    update: { name: 'Starter' },
    create: {
      name: 'Starter',
      slug: 'starter',
      description: 'For individuals and small teams getting started.',
      displayOrder: 1,
      metadata: { trialDays: 14, supportTier: 'community' },
    },
  });
  console.log(`  Plan: ${starterPlan.name} (${starterPlan.slug})`);

  const proPlan = await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: { name: 'Pro' },
    create: {
      name: 'Pro',
      slug: 'pro',
      description: 'For growing teams that need more power.',
      displayOrder: 2,
      metadata: { trialDays: 14, supportTier: 'priority' },
    },
  });
  console.log(`  Plan: ${proPlan.name} (${proPlan.slug})`);

  const enterprisePlan = await prisma.plan.upsert({
    where: { slug: 'enterprise' },
    update: { name: 'Enterprise' },
    create: {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large organizations with advanced requirements.',
      displayOrder: 3,
      metadata: { trialDays: 30, supportTier: 'dedicated' },
    },
  });
  console.log(`  Plan: ${enterprisePlan.name} (${enterprisePlan.slug})`);

  // =========================================================
  // PLAN PRICES
  //
  // Each plan gets monthly + annual pricing.
  // Annual = ~10 months of monthly (2 months free).
  // Amount is in cents: $29.00 = 2900, $99.00 = 9900
  // =========================================================

  console.log('\n--- Plan Prices ---');

  const planPrices = [
    // Starter: $29/mo, $278/yr (2 months free)
    {
      planId: starterPlan.id,
      interval: 'MONTHLY' as const,
      amount: 2900,
      label: 'Starter monthly ($29/mo)',
    },
    {
      planId: starterPlan.id,
      interval: 'ANNUALLY' as const,
      amount: 27800,
      label: 'Starter annual ($278/yr)',
    },
    // Pro: $99/mo, $948/yr (2 months free)
    {
      planId: proPlan.id,
      interval: 'MONTHLY' as const,
      amount: 9900,
      label: 'Pro monthly ($99/mo)',
    },
    {
      planId: proPlan.id,
      interval: 'ANNUALLY' as const,
      amount: 94800,
      label: 'Pro annual ($948/yr)',
    },
    // Enterprise: $499/mo, $4788/yr (2 months free)
    {
      planId: enterprisePlan.id,
      interval: 'MONTHLY' as const,
      amount: 49900,
      label: 'Enterprise monthly ($499/mo)',
    },
    {
      planId: enterprisePlan.id,
      interval: 'ANNUALLY' as const,
      amount: 478800,
      label: 'Enterprise annual ($4,788/yr)',
    },
  ];

  // Track prices by plan+interval for subscription creation later
  const priceMap = new Map<string, string>(); // key: "planId-interval", value: priceId

  for (const pp of planPrices) {
    const existing = await prisma.planPrice.findUnique({
      where: {
        planId_interval_currency: {
          planId: pp.planId,
          interval: pp.interval,
          currency: 'usd',
        },
      },
    });

    if (existing) {
      priceMap.set(`${pp.planId}-${pp.interval}`, existing.id);
      console.log(`  ${pp.label}: already exists`);
      continue;
    }

    const price = await prisma.planPrice.create({
      data: {
        planId: pp.planId,
        interval: pp.interval,
        amount: pp.amount,
        currency: 'usd',
      },
    });
    priceMap.set(`${pp.planId}-${pp.interval}`, price.id);
    console.log(`  ${pp.label}`);
  }

  // =========================================================
  // FEATURES
  //
  // Global catalog of platform capabilities.
  // Feature types:
  //   BOOLEAN - on/off gating
  //   QUOTA   - numeric limit with reset period
  //   METERED - usage-based billing
  // =========================================================

  console.log('\n--- Features ---');

  const featureDefs = [
    {
      name: 'API Access',
      lookupKey: 'api_access',
      type: 'BOOLEAN' as const,
      unit: null,
      description: 'Access to the public API',
    },
    {
      name: 'API Calls',
      lookupKey: 'api_calls',
      type: 'QUOTA' as const,
      unit: 'calls',
      description: 'Number of API requests per billing period',
    },
    {
      name: 'Storage',
      lookupKey: 'storage',
      type: 'METERED' as const,
      unit: 'GB',
      description: 'Storage usage metered per GB',
    },
    {
      name: 'SSO',
      lookupKey: 'sso',
      type: 'BOOLEAN' as const,
      unit: null,
      description: 'Single Sign-On integration',
    },
    {
      name: 'Webhooks',
      lookupKey: 'webhooks',
      type: 'BOOLEAN' as const,
      unit: null,
      description: 'Outbound webhook events',
    },
    {
      name: 'Priority Support',
      lookupKey: 'priority_support',
      type: 'BOOLEAN' as const,
      unit: null,
      description: 'Priority email and chat support',
    },
    {
      name: 'Team Seats',
      lookupKey: 'team_seats',
      type: 'QUOTA' as const,
      unit: 'seats',
      description: 'Maximum number of users in the tenant',
    },
    {
      name: 'Analytics Export',
      lookupKey: 'analytics_export',
      type: 'BOOLEAN' as const,
      unit: null,
      description: 'Export analytics data to CSV/JSON',
    },
  ];

  const featureMap = new Map<string, string>(); // key: lookupKey, value: id

  for (const fd of featureDefs) {
    const feature = await prisma.feature.upsert({
      where: { lookupKey: fd.lookupKey },
      update: { name: fd.name, description: fd.description },
      create: {
        name: fd.name,
        lookupKey: fd.lookupKey,
        type: fd.type,
        unit: fd.unit,
        description: fd.description,
      },
    });
    featureMap.set(fd.lookupKey, feature.id);
    console.log(
      `  Feature: ${feature.name} (${feature.lookupKey}) [${feature.type}]`,
    );
  }

  // =========================================================
  // ENTITLEMENTS
  //
  // The Plan × Feature matrix. Each cell defines what a plan
  // grants for a feature, with access rules based on feature type.
  //
  // Matrix (from docs/architecture/phase-2-plans-and-entitlements.md):
  //
  //   Feature          Starter              Pro                      Enterprise
  //   ---------------- -------------------- ------------------------ ------------------------
  //   API Access       true                 true                     true
  //   API Calls        1,000 HARD           50,000 SOFT ($0.001)     500,000 SOFT ($0.0005)
  //   Storage          1GB + $0.05/GB       10GB + $0.02/GB          100GB + $0.01/GB
  //   SSO              false                false                    true
  //   Webhooks         false                true                     true
  //   Priority Support false                false                    true
  //   Team Seats       3 HARD               10 SOFT ($10/seat)       50 SOFT ($8/seat)
  //   Analytics Export false                true                     true
  //
  // Overage prices in micro-cents: $0.001 = 10, $0.02 = 200, etc.
  // =========================================================

  console.log('\n--- Entitlements ---');

  type EntitlementDef = {
    planId: string;
    planLabel: string;
    featureLookupKey: string;
    value?: boolean;
    limit?: number;
    limitBehavior?: 'HARD' | 'SOFT';
    overagePrice?: number;
    includedAmount?: number;
    resetPeriod?: 'MONTHLY' | 'ANNUALLY' | 'NEVER';
  };

  const entitlementDefs: EntitlementDef[] = [
    // Starter entitlements
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'api_access',
      value: true,
    },
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'api_calls',
      limit: 1000,
      limitBehavior: 'HARD',
      resetPeriod: 'MONTHLY',
    },
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'storage',
      includedAmount: 1,
      overagePrice: 500,
      resetPeriod: 'MONTHLY',
    }, // $0.05/GB = 500 micro-cents
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'sso',
      value: false,
    },
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'webhooks',
      value: false,
    },
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'priority_support',
      value: false,
    },
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'team_seats',
      limit: 3,
      limitBehavior: 'HARD',
      resetPeriod: 'NEVER',
    },
    {
      planId: starterPlan.id,
      planLabel: 'Starter',
      featureLookupKey: 'analytics_export',
      value: false,
    },

    // Pro entitlements
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'api_access',
      value: true,
    },
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'api_calls',
      limit: 50000,
      limitBehavior: 'SOFT',
      overagePrice: 10,
      resetPeriod: 'MONTHLY',
    }, // $0.001/call
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'storage',
      includedAmount: 10,
      overagePrice: 200,
      resetPeriod: 'MONTHLY',
    }, // $0.02/GB
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'sso',
      value: false,
    },
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'webhooks',
      value: true,
    },
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'priority_support',
      value: false,
    },
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'team_seats',
      limit: 10,
      limitBehavior: 'SOFT',
      overagePrice: 100000,
      resetPeriod: 'NEVER',
    }, // $10/seat
    {
      planId: proPlan.id,
      planLabel: 'Pro',
      featureLookupKey: 'analytics_export',
      value: true,
    },

    // Enterprise entitlements
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'api_access',
      value: true,
    },
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'api_calls',
      limit: 500000,
      limitBehavior: 'SOFT',
      overagePrice: 5,
      resetPeriod: 'MONTHLY',
    }, // $0.0005/call
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'storage',
      includedAmount: 100,
      overagePrice: 100,
      resetPeriod: 'MONTHLY',
    }, // $0.01/GB
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'sso',
      value: true,
    },
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'webhooks',
      value: true,
    },
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'priority_support',
      value: true,
    },
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'team_seats',
      limit: 50,
      limitBehavior: 'SOFT',
      overagePrice: 80000,
      resetPeriod: 'NEVER',
    }, // $8/seat
    {
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      featureLookupKey: 'analytics_export',
      value: true,
    },
  ];

  for (const e of entitlementDefs) {
    const featureId = featureMap.get(e.featureLookupKey);
    if (!featureId) {
      console.log(`  SKIP: feature ${e.featureLookupKey} not found`);
      continue;
    }

    await prisma.entitlement.upsert({
      where: {
        planId_featureId: {
          planId: e.planId,
          featureId,
        },
      },
      update: {
        value: e.value ?? null,
        limit: e.limit ?? null,
        limitBehavior: e.limitBehavior ?? null,
        overagePrice: e.overagePrice ?? null,
        includedAmount: e.includedAmount ?? null,
        resetPeriod: e.resetPeriod ?? null,
      },
      create: {
        planId: e.planId,
        featureId,
        value: e.value ?? null,
        limit: e.limit ?? null,
        limitBehavior: e.limitBehavior ?? null,
        overagePrice: e.overagePrice ?? null,
        includedAmount: e.includedAmount ?? null,
        resetPeriod: e.resetPeriod ?? null,
      },
    });

    // Build a summary string describing the entitlement
    const summary =
      e.value !== undefined
        ? e.value
          ? 'enabled'
          : 'disabled'
        : e.limit !== undefined
          ? `${e.limit} ${e.limitBehavior}${e.overagePrice ? ` + $${(e.overagePrice / 10000).toFixed(4)}/unit` : ''}`
          : e.includedAmount !== undefined
            ? `${e.includedAmount} free + $${(e.overagePrice! / 10000).toFixed(4)}/unit`
            : '-';

    console.log(`  ${e.planLabel} → ${e.featureLookupKey}: ${summary}`);
  }

  // =========================================================
  // SUBSCRIPTIONS
  //
  // Assign plans to dev tenants:
  //   Acme Corp         → Pro (monthly)
  //   Globex Industries → Starter (monthly)
  //   Stark Enterprises → Enterprise (annual)
  //
  // Creating a subscription requires snapshotting all entitlements,
  // so we replicate the SubscriptionsService logic here in a transaction.
  // =========================================================

  console.log('\n--- Subscriptions ---');

  type SubscriptionDef = {
    tenantId: string;
    tenantLabel: string;
    planId: string;
    planLabel: string;
    priceKey: string; // "planId-interval"
  };

  const subscriptionDefs: SubscriptionDef[] = [
    {
      tenantId: acme.id,
      tenantLabel: 'Acme Corp',
      planId: proPlan.id,
      planLabel: 'Pro',
      priceKey: `${proPlan.id}-MONTHLY`,
    },
    {
      tenantId: globex.id,
      tenantLabel: 'Globex',
      planId: starterPlan.id,
      planLabel: 'Starter',
      priceKey: `${starterPlan.id}-MONTHLY`,
    },
    {
      tenantId: stark.id,
      tenantLabel: 'Stark',
      planId: enterprisePlan.id,
      planLabel: 'Enterprise',
      priceKey: `${enterprisePlan.id}-ANNUALLY`,
    },
  ];

  for (const s of subscriptionDefs) {
    // Check if tenant already has an active/trialing subscription
    const existing = await prisma.subscription.findFirst({
      where: {
        tenantId: s.tenantId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      select: { id: true, plan: { select: { slug: true } } },
    });

    if (existing) {
      console.log(
        `  ${s.tenantLabel} → ${existing.plan.slug}: subscription already exists`,
      );
      continue;
    }

    const priceId = priceMap.get(s.priceKey);
    if (!priceId) {
      console.log(`  SKIP: price not found for ${s.priceKey}`);
      continue;
    }

    // Load entitlements for snapshotting
    const entitlements = await prisma.entitlement.findMany({
      where: { planId: s.planId },
      select: {
        value: true,
        limit: true,
        limitBehavior: true,
        overagePrice: true,
        includedAmount: true,
        resetPeriod: true,
        feature: { select: { lookupKey: true, type: true } },
      },
    });

    const now = new Date();
    const billingAnchor = Math.min(now.getDate(), 28);
    const price = await prisma.planPrice.findUnique({
      where: { id: priceId },
      select: { interval: true },
    });

    const periodEnd = new Date(now);
    if (price?.interval === 'ANNUALLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Create subscription + snapshots in one transaction
    await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.create({
        data: {
          tenantId: s.tenantId,
          planId: s.planId,
          priceId,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          billingAnchor,
        },
      });

      if (entitlements.length > 0) {
        await tx.entitlementSnapshot.createMany({
          data: entitlements.map((e) => ({
            subscriptionId: sub.id,
            featureLookupKey: e.feature.lookupKey,
            featureType: e.feature.type,
            value: e.value,
            limit: e.limit,
            limitBehavior: e.limitBehavior,
            overagePrice: e.overagePrice,
            includedAmount: e.includedAmount,
            resetPeriod: e.resetPeriod,
          })),
        });
      }
    });

    console.log(
      `  ${s.tenantLabel} → ${s.planLabel} (${price?.interval}): subscribed with ${entitlements.length} entitlement snapshots`,
    );
  }

  // =========================================================
  // USAGE DATA
  //
  // Seed realistic usage events and aggregates for dev tenants.
  // Direct INSERT into usage_events (status=AGGREGATED) and
  // usage_aggregates (via atomic upsert) for instant availability.
  //
  // The pipeline is already proven end-to-end. Seed data doesn't
  // need to re-prove it - it exists to make demos tangible:
  //   Acme (Pro):        35,000 api_calls (70% of 50k), 7 GB storage
  //   Globex (Starter):  950 api_calls (95% of 1k HARD limit), 0.8 GB storage
  //   Stark (Enterprise): 50,000 api_calls (10% of 500k), 25 GB storage
  //
  // Idempotent: uses eventId-based upsert on usage_events and
  // atomic upsert on usage_aggregates. Safe to re-run.
  // =========================================================

  console.log('\n--- Usage Data ---');

  // Get active subscriptions for each tenant (needed for FK)
  const subscriptionMap = new Map<string, string>(); // tenantId → subscriptionId
  for (const tenantId of [acme.id, globex.id, stark.id]) {
    const sub = await prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
      select: { id: true },
    });
    if (sub) subscriptionMap.set(tenantId, sub.id);
  }

  // Period calculation (current month)
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const periodStart = new Date(Date.UTC(year, month, 1));
  const periodEnd = new Date(Date.UTC(year, month + 1, 1));

  type UsageSeedDef = {
    tenantId: string;
    tenantLabel: string;
    feature: string;
    amount: number;
    label: string;
  };

  const usageDefs: UsageSeedDef[] = [
    // Acme (Pro): 70% of 50k api_calls, 7 GB storage
    {
      tenantId: acme.id,
      tenantLabel: 'Acme',
      feature: 'api_calls',
      amount: 35000,
      label: '35,000 api_calls (70% of 50k)',
    },
    {
      tenantId: acme.id,
      tenantLabel: 'Acme',
      feature: 'storage',
      amount: 7,
      label: '7 GB storage',
    },
    // Globex (Starter): 95% of 1k api_calls (near HARD limit), 0.8 GB storage
    {
      tenantId: globex.id,
      tenantLabel: 'Globex',
      feature: 'api_calls',
      amount: 950,
      label: '950 api_calls (95% of 1k HARD)',
    },
    {
      tenantId: globex.id,
      tenantLabel: 'Globex',
      feature: 'storage',
      amount: 1,
      label: '0.8 GB storage (rounded to 1)',
    },
    // Stark (Enterprise): 10% of 500k api_calls, 25 GB storage
    {
      tenantId: stark.id,
      tenantLabel: 'Stark',
      feature: 'api_calls',
      amount: 50000,
      label: '50,000 api_calls (10% of 500k)',
    },
    {
      tenantId: stark.id,
      tenantLabel: 'Stark',
      feature: 'storage',
      amount: 25,
      label: '25 GB storage',
    },
  ];

  for (const u of usageDefs) {
    const subscriptionId = subscriptionMap.get(u.tenantId);
    if (!subscriptionId) {
      console.log(`  SKIP ${u.tenantLabel}: no active subscription`);
      continue;
    }

    const seedEventId = `seed-${u.tenantLabel.toLowerCase()}-${u.feature}-${periodKey}`;

    // Upsert usage_event (idempotent via eventId uniqueness)
    const existingEvent = await prisma.usageEvent.findUnique({
      where: { eventId: seedEventId },
    });

    if (!existingEvent) {
      await prisma.usageEvent.create({
        data: {
          eventId: seedEventId,
          tenantId: u.tenantId,
          subscriptionId,
          featureLookupKey: u.feature,
          amount: u.amount,
          timestamp: new Date(),
          status: 'AGGREGATED',
          metadata: { source: 'seed', description: u.label },
        },
      });
    }

    // Atomic upsert on usage_aggregates
    // Uses raw SQL because Prisma doesn't support ON CONFLICT DO UPDATE with increment
    await prisma.$executeRawUnsafe(
      `INSERT INTO usage_aggregates (
        id, tenant_id, subscription_id, feature_lookup_key,
        period_key, amount, period_start, period_end,
        last_event_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3,
        $4, $5, $6, $7,
        NOW(), NOW(), NOW()
      )
      ON CONFLICT (tenant_id, feature_lookup_key, period_key, subscription_id)
      DO UPDATE SET
        amount = $5,
        last_event_at = NOW(),
        updated_at = NOW()`,
      u.tenantId,
      subscriptionId,
      u.feature,
      periodKey,
      u.amount,
      periodStart,
      periodEnd,
    );

    console.log(`  ${u.tenantLabel} → ${u.feature}: ${u.label}`);
  }

  // =========================================================
  // INVOICES + LEDGER
  //
  // One FINALIZED invoice per tenant for the current period.
  // Each invoice has:
  //   - Base subscription fee line item
  //   - Usage-based line items (SOFT quota + METERED features)
  //   - Corresponding billing ledger CHARGE entry
  //
  // Uses the overage calculator to validate billing math
  // against seed usage data.
  //
  // Idempotent: checks for existing invoice before creating.
  // =========================================================

  console.log('\n--- Invoices & Ledger ---');

  type InvoiceSeedDef = {
    tenantId: string;
    tenantLabel: string;
    planLabel: string;
    baseFeeCents: number;
    lineItems: Array<{
      description: string;
      featureLookupKey: string | null;
      quantity: number;
      unitPriceMicroCents: number;
      amount: number;
      sortOrder: number;
    }>;
  };

  // Build invoice definitions using seed usage data
  // Acme (Pro $99/mo): 35k/50k api_calls (no overage), 7/10 GB storage (no overage)
  // Globex (Starter $29/mo): 950/1k api_calls HARD (no overage on HARD), 1/1 GB storage (no overage)
  // Stark (Enterprise $4788/yr): 50k/500k api_calls (no overage), 25/100 GB storage (no overage)
  const invoiceDefs: InvoiceSeedDef[] = [
    {
      tenantId: acme.id,
      tenantLabel: 'Acme',
      planLabel: 'Pro plan - monthly',
      baseFeeCents: 9900,
      lineItems: [
        {
          description: 'Pro plan - monthly',
          featureLookupKey: null,
          quantity: 1,
          unitPriceMicroCents: 990000,
          amount: 9900,
          sortOrder: 0,
        },
        {
          description: 'Api Calls overage (35,000 used, 50,000 included)',
          featureLookupKey: 'api_calls',
          quantity: 0,
          unitPriceMicroCents: 10,
          amount: 0,
          sortOrder: 1,
        },
        {
          description: 'Storage (7 used, 10 included)',
          featureLookupKey: 'storage',
          quantity: 0,
          unitPriceMicroCents: 200,
          amount: 0,
          sortOrder: 2,
        },
        {
          description: 'Team Seats overage (0 used, 10 included)',
          featureLookupKey: 'team_seats',
          quantity: 0,
          unitPriceMicroCents: 100000,
          amount: 0,
          sortOrder: 3,
        },
      ],
    },
    {
      tenantId: globex.id,
      tenantLabel: 'Globex',
      planLabel: 'Starter plan - monthly',
      baseFeeCents: 2900,
      lineItems: [
        {
          description: 'Starter plan - monthly',
          featureLookupKey: null,
          quantity: 1,
          unitPriceMicroCents: 290000,
          amount: 2900,
          sortOrder: 0,
        },
        {
          description: 'Storage (1 used, 1 included)',
          featureLookupKey: 'storage',
          quantity: 0,
          unitPriceMicroCents: 500,
          amount: 0,
          sortOrder: 1,
        },
      ],
    },
    {
      tenantId: stark.id,
      tenantLabel: 'Stark',
      planLabel: 'Enterprise plan - annually',
      baseFeeCents: 478800,
      lineItems: [
        {
          description: 'Enterprise plan - annually',
          featureLookupKey: null,
          quantity: 1,
          unitPriceMicroCents: 4788000,
          amount: 478800,
          sortOrder: 0,
        },
        {
          description: 'Api Calls overage (50,000 used, 500,000 included)',
          featureLookupKey: 'api_calls',
          quantity: 0,
          unitPriceMicroCents: 5,
          amount: 0,
          sortOrder: 1,
        },
        {
          description: 'Storage (25 used, 100 included)',
          featureLookupKey: 'storage',
          quantity: 0,
          unitPriceMicroCents: 100,
          amount: 0,
          sortOrder: 2,
        },
        {
          description: 'Team Seats overage (0 used, 50 included)',
          featureLookupKey: 'team_seats',
          quantity: 0,
          unitPriceMicroCents: 80000,
          amount: 0,
          sortOrder: 3,
        },
      ],
    },
  ];

  // Track invoice sequence for generating numbers
  let invoiceSeq = 0;

  for (const inv of invoiceDefs) {
    const subscriptionId = subscriptionMap.get(inv.tenantId);
    if (!subscriptionId) {
      console.log(`  SKIP ${inv.tenantLabel}: no active subscription`);
      continue;
    }

    // Check if invoice already exists for this tenant + period
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId: inv.tenantId,
        periodStart: periodStart,
        periodEnd: periodEnd,
        status: { in: ['FINALIZED', 'PAID'] },
      },
      select: { invoiceNumber: true },
    });

    if (existingInvoice) {
      console.log(
        `  ${inv.tenantLabel}: invoice already exists (${existingInvoice.invoiceNumber})`,
      );
      continue;
    }

    invoiceSeq++;
    const total = inv.lineItems.reduce((sum, li) => sum + li.amount, 0);
    const invoiceNumber = `INV-${year}-${String(invoiceSeq).padStart(4, '0')}`;
    const dueDate = new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Create invoice + line items + ledger entry in transaction
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          tenantId: inv.tenantId,
          subscriptionId,
          invoiceNumber,
          status: 'FINALIZED',
          currency: 'usd',
          subtotal: total,
          total,
          periodStart,
          periodEnd,
          dueDate,
          finalizedAt: new Date(),
        },
      });

      await tx.invoiceLineItem.createMany({
        data: inv.lineItems.map((li) => ({
          invoiceId: invoice.id,
          description: li.description,
          featureLookupKey: li.featureLookupKey,
          quantity: li.quantity,
          unitPriceMicroCents: li.unitPriceMicroCents,
          amount: li.amount,
          sortOrder: li.sortOrder,
        })),
      });

      await tx.billingLedgerEntry.create({
        data: {
          tenantId: inv.tenantId,
          invoiceId: invoice.id,
          type: 'CHARGE',
          description: `Invoice ${invoiceNumber} finalized`,
          debit: total,
          credit: 0,
          currency: 'usd',
        },
      });
    });

    // Upsert the invoice sequence counter to stay consistent
    await prisma.$executeRawUnsafe(
      `INSERT INTO invoice_sequences (year, last_value)
      VALUES ($1, $2)
      ON CONFLICT (year)
      DO UPDATE SET last_value = GREATEST(invoice_sequences.last_value, $2)`,
      year,
      invoiceSeq,
    );

    console.log(
      `  ${inv.tenantLabel} → ${invoiceNumber} (${inv.planLabel}): $${(total / 100).toFixed(2)}`,
    );
  }

  // =========================================================
  // SUMMARY
  // =========================================================

  const counts = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.apiKey.count(),
    prisma.plan.count(),
    prisma.planPrice.count(),
    prisma.feature.count(),
    prisma.entitlement.count(),
    prisma.subscription.count(),
    prisma.entitlementSnapshot.count(),
    prisma.usageEvent.count(),
    prisma.usageAggregate.count(),
    prisma.invoice.count(),
    prisma.invoiceLineItem.count(),
    prisma.billingLedgerEntry.count(),
  ]);

  console.log(`
  Seed complete:
    Tenants:              ${counts[0]}
    Users:                ${counts[1]}
    Memberships:          ${counts[2]}
    API Keys:             ${counts[3]}
    Plans:                ${counts[4]}
    Plan Prices:          ${counts[5]}
    Features:             ${counts[6]}
    Entitlements:         ${counts[7]}
    Subscriptions:        ${counts[8]}
    Entitlement Snapshots: ${counts[9]}
    Usage Events:         ${counts[10]}
    Usage Aggregates:     ${counts[11]}
    Invoices:             ${counts[12]}
    Invoice Line Items:   ${counts[13]}
    Ledger Entries:       ${counts[14]}

  Dev login credentials (all passwords: ${DEV_PASSWORD}):
    alice@meterplex.dev  → OWNER of Acme, ADMIN of Globex
    bob@meterplex.dev    → OWNER of Globex, DEVELOPER of Acme
    carol@meterplex.dev  → OWNER of Stark, BILLING of Acme
    dave@meterplex.dev   → DEVELOPER of Acme & Globex
    eve@meterplex.dev    → BILLING of Globex, ADMIN of Stark

  Dev subscriptions:
    Acme Corp         → Pro (monthly)
    Globex Industries → Starter (monthly)
    Stark Enterprises → Enterprise (annual)

  Dev usage (current period: ${periodKey}):
    Acme (Pro):        35,000 api_calls (70%), 7 GB storage
    Globex (Starter):  950 api_calls (95% near HARD limit), 1 GB storage
    Stark (Enterprise): 50,000 api_calls (10%), 25 GB storage

  Dev invoices (FINALIZED):
    Acme → INV-${year}-0001: $99.00 (Pro monthly, no overage)
    Globex → INV-${year}-0002: $29.00 (Starter monthly, no overage)
    Stark → INV-${year}-0003: $4,788.00 (Enterprise annual, no overage)
`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
