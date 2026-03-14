import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — DB writes will be skipped');
}

export const supabase = url && key ? createClient(url, key) : null;
export const DB_ENABLED = supabase !== null;
