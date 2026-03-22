import { createServerSupabaseClient } from "./supabase-server";

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
}

export async function getGoogleTokens(): Promise<GoogleTokens | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_tokens")
    .eq("id", user.id)
    .single();

  if (!profile?.google_tokens) return null;
  return profile.google_tokens as GoogleTokens;
}

export async function googleFetch(url: string, tokens: GoogleTokens, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Google API ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json();
}
