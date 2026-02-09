import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please connect your project.');
}

// Ensure URL is valid and trimmed
const validUrl = supabaseUrl ? supabaseUrl.trim() : 'https://cugqvijpcooaqsugxold.supabase.co';
const validKey = supabaseAnonKey ? supabaseAnonKey.trim() : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Z3F2aWpwY29vYXFzdWd4b2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDI1OTUsImV4cCI6MjA4NjExODU5NX0.n_g0Hz3zwgzybzEDHdWQ8KYW1Em1MmcWp_8MvuyeiLs';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type UserRole = 'admin' | 'vendedor' | 'cliente';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  client_id?: string;
  created_at: string;
}
