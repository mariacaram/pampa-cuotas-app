"use client";

import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para el navegador (solo para el login con Google).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
