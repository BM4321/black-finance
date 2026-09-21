# Black Finance

A personal finance management app: accounts, transactions, budgets, savings
goals, a dashboard, and a Gemini-powered assistant grounded in your own data.

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
