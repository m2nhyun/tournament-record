import { createClient } from "@supabase/supabase-js";
import {
  EMAIL_DOMAIN,
  PASSWORD,
  memberEmail,
  guestEmail,
  CLUB_NAME_PREFIX,
} from "./fixture.mjs";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[qa] missing env: ${name}`);
  }
  return value;
}

export function readSupabaseEnv() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, anonKey, serviceKey };
}

export function createAdminClient() {
  const { url, serviceKey } = readSupabaseEnv();
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient() {
  const { url, anonKey } = readSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(accessToken) {
  const { url, anonKey } = readSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export async function signInAs(email, password = PASSWORD) {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`[qa] sign-in failed for ${email}: ${error.message}`);
  }
  return {
    accessToken: data.session.access_token,
    userId: data.user.id,
  };
}

export function clubName(suffix = "") {
  // 매 실행마다 같은 결과로 식별 가능하도록 prefix 고정.
  return suffix ? `${CLUB_NAME_PREFIX} ${suffix}` : CLUB_NAME_PREFIX;
}

export function isQaEmail(email) {
  return Boolean(email) && email.endsWith(`@${EMAIL_DOMAIN}`) && email.startsWith("qa-full-club+");
}

export { memberEmail, guestEmail };

export function assert(condition, message) {
  if (!condition) {
    throw new Error(`[qa-assert] ${message}`);
  }
}

export function section(title) {
  const line = "─".repeat(60);
  console.log(`\n${line}\n▶ ${title}\n${line}`);
}

export function log(message, payload) {
  if (payload === undefined) {
    console.log(`  · ${message}`);
  } else {
    console.log(`  · ${message}`, payload);
  }
}
