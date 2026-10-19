import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Dev-only startup check: warn clearly if env vars are missing or look like placeholders
  if (process.env.NODE_ENV === 'development') {
    if (!supabaseUrl || supabaseUrl.includes('placeholder') || supabaseUrl.includes('your-project')) {
      console.warn(
        '[PromptOS] NEXT_PUBLIC_SUPABASE_URL is missing or a placeholder.\n' +
        'Create .env.local with real Supabase credentials from your project dashboard.\n' +
        'See .env.example for the required variable names.'
      );
    }
    if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder') || supabaseAnonKey.includes('your-')) {
      console.warn(
        '[PromptOS] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or a placeholder.\n' +
        'Create .env.local with real Supabase credentials from your project dashboard.'
      );
    }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
