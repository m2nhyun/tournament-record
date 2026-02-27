import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const client = createClient(url, key);
const { error } = await client.from("clubs").select("id", { head: true, count: "exact" });

if (error) {
  console.error(`Supabase smoke check failed: ${error.message}`);
  process.exit(1);
}

console.log("Supabase smoke check passed.");
