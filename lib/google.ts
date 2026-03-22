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

async function refreshGoogleToken(refreshToken: string): Promise<GoogleTokens | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Google doesn't always return a new refresh token
  };
}

async function saveGoogleTokens(tokens: GoogleTokens): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ google_tokens: tokens })
    .eq("id", user.id);
}

export async function googleFetch(url: string, tokens: GoogleTokens, options?: RequestInit) {
  let res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  // If unauthorized, try refreshing the token
  if (res.status === 401 && tokens.refresh_token) {
    const newTokens = await refreshGoogleToken(tokens.refresh_token);
    if (newTokens) {
      await saveGoogleTokens(newTokens);

      // Retry with new token
      res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${newTokens.access_token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });
    }
  }

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Google API ${res.status}: ${err.slice(0, 200)}`);
  }

  return res.json();
}
