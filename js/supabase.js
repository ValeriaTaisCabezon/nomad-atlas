// Supabase client initialization
// The CDN sets window.supabase to the library object.
// We replace it with an initialised client so all scripts can use window.supabase.auth etc.

const SUPABASE_URL = 'https://eohzflignqhoasklfjod.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bIyP8_3ErgPovkqZWQWWkQ_43bCKGY4';

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
