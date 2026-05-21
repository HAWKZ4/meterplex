/**
 * env.validation.ts - Environment Variable Validation
 *
 * Uses class-validator to validate ALL environment variables at boot time.
 * If any required variable is missing or malformed, the app crashes
 * immediately with a clear error message - not 30 seconds later on the
 * first database query.
 *
 * This is the "fail fast" principle: catch config errors at startup,
 * not at runtime when a customer is waiting for a response.
 *
 * How it works:
 *   1. NestJS ConfigModule calls validate() on startup
 *   2. We transform raw process.env into an EnvConfig instance
 *   3. class-validator checks every property against its decorators
 *   4. If validation fails → app crashes with the exact missing/invalid vars
 *   5. If validation passes → the typed EnvConfig is available via ConfigService
 */
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

/** Allowed Node environments - prevents typos like "devlopment" */
enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvConfig {
  // --- Application ---

  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  PORT: number = 3000;

  @IsString()
  API_PREFIX: string = 'api';

  @IsString()
  API_VERSION: string = '1';

  // --- Database ---
  // No default - this MUST be set. Missing DATABASE_URL = crash on boot.

  @IsString()
  DATABASE_URL!: string;

  // --- Kafka ---

  @IsString()
  KAFKA_BROKERS: string = 'localhost:9092';

  @IsString()
  KAFKA_CLIENT_ID: string = 'meterplex';

  @IsString()
  KAFKA_CONSUMER_GROUP: string = 'meterplex-group';

  // --- Redis ---

  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Min(1)
  REDIS_PORT: number = 6379;

  // --- Logging ---

  @IsString()
  LOG_LEVEL: string = 'debug';

  // --- CORS ---

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  // --- Rate Limiting ---

  @IsNumber()
  @Min(1)
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @Min(1)
  THROTTLE_LIMIT: number = 100;

  // --- Auth (JWT) ---

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRATION: string = '15m';

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRATION: string = '7d';

  // --- Payment Provider ---

  @IsString()
  PAYMENT_PROVIDER: string = 'fake';

  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  FAKE_PAYMENT_SUCCESS_RATE?: number = 90;
}

/**
 * validate() - Called by ConfigModule on startup.
 *
 * Transforms raw process.env (all strings) into typed EnvConfig,
 * then validates every field. Returns the validated config or
 * throws with a detailed error listing every invalid variable.
 *
 * @param config - Raw process.env key-value pairs
 * @returns Validated and typed EnvConfig instance
 * @throws Error with list of validation failures
 */
export function validate(config: Record<string, unknown>): EnvConfig {
  const validated = plainToInstance(EnvConfig, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => {
        const constraints = Object.values(err.constraints ?? {}).join(', ');
        return `  ${err.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `\n\nEnvironment validation failed:\n${messages}\n\n` +
        `Check your .env file against .env.example\n`,
    );
  }

  return validated;
}
