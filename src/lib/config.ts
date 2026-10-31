import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SHARESPACE_DB_PATH: z.string().min(1).default("./data/sharespace.db"),
  INSTITUTION_TIMEZONE: z.string().min(1).default("Asia/Kolkata"),
  SESSION_IDLE_HOURS: z.coerce.number().int().positive().default(8),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(24),
  DEMO_USER_PASSWORD: z.string().optional().default(""),
  APP_ORIGIN: z.string().default("http://localhost:3000"),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    SHARESPACE_DB_PATH: process.env.SHARESPACE_DB_PATH,
    INSTITUTION_TIMEZONE: process.env.INSTITUTION_TIMEZONE,
    SESSION_IDLE_HOURS: process.env.SESSION_IDLE_HOURS,
    SESSION_ABSOLUTE_HOURS: process.env.SESSION_ABSOLUTE_HOURS,
    DEMO_USER_PASSWORD: process.env.DEMO_USER_PASSWORD,
    APP_ORIGIN: process.env.APP_ORIGIN,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid application configuration: ${issues.join("; ")}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetConfigForTests(): void {
  cached = null;
}
