# Black Finance

A personal finance management app: accounts, transactions, budgets, savings
goals, investments, debts, a dashboard, and a Gemini-powered assistant grounded
in your own data.

## Getting Started

Install dependencies and configure the environment:

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon / publishable key (safe; protected by RLS) |
| `GEMINI_API_KEY` | **Server only** | Google AI Studio key for the assistant |
| `GEMINI_MODEL` | Server only | Optional model override (defaults to `gemini-3.6-flash`) |
| `SESSION_IDLE_MINUTES` | Server only | Optional idle timeout in minutes (defaults to `30`) |
| `SITE_URL` | Server only | Optional public URL for links in emails, e.g. `https://your-app.vercel.app` (defaults to the request's origin) |

`.env.local` is gitignored and is **not** available during a Vercel build.

## Deploying to Vercel

The build does not require secrets, but the running app does. Set the
variables in the Vercel dashboard — `.env.local` never reaches Vercel.

1. Push the repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. In the project: **Settings → Environment Variables**, add each variable below
   for **Production**, **Preview** and **Development**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (only if you want the assistant enabled)
3. **Redeploy.** Vercel only applies environment variables to deployments made
   after they are added; existing deployments keep the old environment.
4. In Supabase: **Authentication → URL Configuration**, add your Vercel domain
   (e.g. `https://your-app.vercel.app`) to **Site URL** and **Redirect URLs**,
   otherwise auth redirects will fail in production.

### If the build fails with "Invalid public environment configuration"

That error means the app tried to use Supabase without a URL/key. On Vercel
this is almost always one of:

- The variables were added **after** the deployment — redeploy.
- They were added for a different environment than the one building
  (e.g. added to Production but the deploy is a Preview).
- A name is misspelled, or the value is empty/whitespace.

## Password reset emails

"Forgot password?" on the sign-in page emails a link that opens
`/auth/confirm`, which signs the user in for the reset and forwards them to
`/reset-password` to choose a new password. Two Supabase settings make this
work:

1. **Authentication → URL Configuration → Redirect URLs**: add
   `https://<your-domain>/auth/confirm` (and `http://localhost:3000/auth/confirm`
   for local development). Supabase refuses to send users anywhere else.
2. **Recommended: Authentication → Emails → Reset Password**, set the link to

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset password</a>
   ```

   With the default template the link only works in the browser that asked
   for it; this one also works when the email is opened on another device.
   Set **Site URL** to your production domain so `{{ .SiteURL }}` is right.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # run the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest
```

## Database

Migrations live in `supabase/migrations/`. See `supabase/README.md` for how to
apply them and how to run the Row Level Security test suite.
