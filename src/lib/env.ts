import { z } from "zod";

/**
 * Validates public environment variables at startup.
 *
 * These run in both browser and server contexts, so only NEXT_PUBLIC_* values
 * are read here. Missing config fails loudly instead of producing cryptic
 * runtime errors deep inside the Supabase client.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid public environment configuration:\n${issues}\n\n` +
      `Copy .env.example to .env.local and fill in your Supabase values.`,
  );
}

export const publicEnv = parsed.data;
