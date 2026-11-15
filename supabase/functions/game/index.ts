// The game API as a Supabase Edge Function (all the logic is in ./api.js).
// Deploy: supabase functions deploy game --no-verify-jwt
// (--no-verify-jwt: the game signs in with its own session key, not a Supabase JWT.)
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are provided by Supabase.
import { serveGame } from './api.js';

Deno.serve((req) => serveGame(req, {
  url: Deno.env.get('SUPABASE_URL'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
}));
