## PURPOSE
Freelance-Flow is a comprehensive dashboard platform designed for freelancers to seamlessly manage their clients, invoices, proposals, contracts, expenses, and time-tracking, featuring multiple tiers/plans and integrations like Razorpay.

## STACK
- **Framework**: Next.js (App Router, TypeScript)
- **Database/Backend**: Supabase (PostgreSQL database with custom schema migrations)
- **Styling**: Tailwind CSS + Shadcn UI
- **State/Context**: Custom context providers (e.g., ThemeProvider, PlanProvider)
- **Payment Gateway**: Razorpay Integration

## ARCHITECTURE
- **App Router (`src/app/`)**: Handles frontend pages (Dashboard, Portal, Contract signing/review) and REST API endpoints (e.g. `api/contracts`, `api/invoices`, `api/expenses`).
- **Components (`src/components/`)**: Houses reusable dashboard blocks, layout widgets (sidebar, theme toggle), and Shadcn UI core components.
- **Lib (`src/lib/`)**: Provides central utilities:
  - Supabase client instantiators (`client.ts` for browser, `server.ts` for Server Components/API routes, and `admin.ts` for elevated admin privilege operations).
  - Central styling utility `cn` (`utils.ts`).
  - Access control and plan validation (`plan-context.tsx`).

## PATTERNS
- **Supabase Clients**: Correctly instantiate Supabase client using server context `createClient` in API routes and Server Components, browser `createClient` in client components, and `createAdminClient` only in controlled server contexts requiring bypass.
- **Role/Plan Checks**: UI and api actions are guarded using plan checks like `usePlan` and `planAtLeast` to enforce tier limits.
- **API routes**: Next.js App Router route handlers (GET, POST, PATCH, DELETE) located under `src/app/api/` handle data mutations and third-party webhooks.

## TRADEOFFS
- **Next.js & Supabase integration**: Bypassing server middleware/direct database calls by using supabase client wrapper functions for auth, which adds some latency but increases flexibility.
- **Admin Client Usage**: Admin client used directly in server routines bypassing standard RLS when needed (e.g. razorpay webhooks or cron tasks).

## PHILOSOPHY
- Modular development with strict separation of backend routes, client components, and utility layers.
- High reuse of UI components (Shadcn) with Tailwind CSS custom styles.
- Tiered privilege restrictions enforced at both API route and UI levels.
