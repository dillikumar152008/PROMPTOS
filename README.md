# PromptOS

PromptOS is a premium, high-conversion SaaS platform where **Creators** build single-purpose AI mini-apps using plain English, and **End-Users** consume them in restricted, zero-distraction runtimes.

Inspired by the engineering aesthetics of Linear, Vercel, and Stripe:
- Crisp 1px structural borders (`border-zinc-800`), deep neutral base (`#09090b`), high-contrast monochrome buttons.
- Zero generic AI purple gradient borders or floating icons.
- Strict role isolation at the edge: Creators and Users never share workspaces or code pathways.

---

## 🛠️ Stack Architecture

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + Geist Sans / Inter
- **Authentication & Database:** Supabase Auth (SSR with cookie sessions + RLS)
- **Role Isolation:** Edge `middleware.ts` + defense-in-depth layout and server action assertions.
- **Model Engine:** Server-only provider-agnostic execution engine with per-user rate limiting.

---

## 🚀 Getting Started

1. **Clone & Configure:**
   ```bash
   cp .env.example .env.local
   # Populate NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

4. **Production Build:**
   ```bash
   npm run build
   ```

---

## 🔐 Security & Role Architecture

- **Database Schema & RLS:** The database schema and Row Level Security (RLS) policies are managed directly in Supabase and are not included in this repository.
- **Authoritative Role Store:** User roles (`creator` vs `user`) are authored exclusively in `profiles` and `app_metadata` through server-side triggers on signup, protected with strict Row Level Security (RLS) preventing client alteration.
- **Route Guards:**
  - Unauthenticated access to `/dashboard/*` &rarr; redirects to `/login?next=<path>`
  - Users requesting `/dashboard/creator/*` &rarr; bounces to `/dashboard/user`
  - Creators requesting `/dashboard/user/*` &rarr; bounces to `/dashboard/creator`
  - Authenticated visits to `/login` or `/signup` &rarr; redirects to assigned role dashboard
- **System Prompt Secrecy:** End-users can never read `apps.system_prompt`. Safe metadata views prevent prompt exposure; execution runs strictly server-side.
