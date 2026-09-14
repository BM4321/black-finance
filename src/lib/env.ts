import { z } from "zod";

/**
 * Validates public environment variables at startup.
 *
 * These run in both browser and server contexts, so only NEXT_PUBLIC_* values
 * are read here. Missing config fails loudly — a finance app must never boot
 * against the wrong (or a missing) backend and silently show empty data.
 *
 * Vercel note: `.env.local` is gitignored, so it is NOT available during a
 * Vercel build. The variables must be added in the Vercel dashboard
 * (Project → Settings → Environment Variables) for the environments you deploy
 * to (Production / Preview / Development), then redeployed.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("must be a valid URL, e.g. https://<ref>.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "is required (the Supabase anon / publishable key)"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

function readPublicEnv(): PublicEnv {
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
        `Fix it one of these ways:\n` +
        `  - Locally: copy .env.example to .env.local and fill in your values.\n` +
        `  - On Vercel: add NEXT_PUBLIC_SUPABASE_URL and ` +
        `NEXT_PUBLIC_SUPABASE_ANON_KEY under Project → Settings → ` +
        `Environment Variables, then redeploy.\n\n` +
        `.env.local is gitignored and is NOT available during a Vercel build.`,
    );
  }

  return parsed.data;
}

/**
 * Validated public environment, resolved on first access.
 *
 * Read lazily rather than at module load so that importing this module (for
 * example transitively through a shared server module) does not throw merely
 * because a variable is absent. The error still surfaces at the first real use,
 * which is the request that actually needs Supabase.
 */
let cached: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  cached ??= readPublicEnv();
  return cached;
}
