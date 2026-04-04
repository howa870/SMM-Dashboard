# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Perfect Follow - SMM Panel

Arabic RTL social media services panel. Main artifact at `artifacts/smm-panel`.

### Auth System
- **Primary auth**: Supabase Auth (`@supabase/supabase-js`) via `src/context/AuthContext.tsx`
  - Uses `signInWithPassword()` for login, `signUp()` for register, `signOut()` for logout
  - Session managed via `onAuthStateChange()` listener
  - Supabase config: `src/lib/supabase.ts` (reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **Backend sync**: On Supabase login/register, also calls `/api/auth/login` or `/api/auth/register` to get a backend JWT stored in `localStorage` as `pf_session_token`
- **Legacy auth context**: `src/lib/auth-context.tsx` wraps the Supabase context and provides backend user data (name, role, balance) via `/api/users/me`
- **Route protection**: `src/components/layout.tsx` uses `useSupabaseAuth()` to redirect unauthenticated users to `/#/login`
- **Hash routing**: All routes use `/#/` prefix (e.g., `/#/admin`, `/#/login`) via Wouter's `useHashLocation`

### Key Files
- `src/context/AuthContext.tsx` — Supabase auth context (SupabaseAuthProvider, useSupabaseAuth)
- `src/lib/auth-context.tsx` — Backend auth context (AuthProvider, useAuth)
- `src/lib/token.ts` — localStorage token utilities (storeToken, clearToken, getStoredToken)
- `src/lib/supabase.ts` — Supabase client

### Supabase Project
- URL and key stored as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- **Note**: For immediate login without email confirmation, disable "Confirm email" in Supabase Dashboard → Authentication → Providers → Email

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
