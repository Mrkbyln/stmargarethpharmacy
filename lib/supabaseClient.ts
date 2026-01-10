// lib/supabaseClient.ts - Supabase client initialization
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : '');

let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('⚠️ Supabase environment variables not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env or Vercel dashboard.');
}

export { supabase };

// Optional: Export types for better TypeScript support
export type Database = any;
