import { createServerSupabaseClient } from "./supabase-server";

export interface SlackTokens {
  access_token: string;
  user_id?: string;
  team_name?: string;
}

export async function getSlackTokens(): Promise<SlackTokens | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("slack_tokens")
    .eq("id", user.id)
    .single();

  if (!profile?.slack_tokens) return null;
  return profile.slack_tokens as SlackTokens;
}

export async function saveSlackTokens(tokens: SlackTokens): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ slack_tokens: tokens })
    .eq("id", user.id);
}

export async function clearSlackTokens(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ slack_tokens: null })
    .eq("id", user.id);
}

export async function slackFetch(url: string, tokens: SlackTokens) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Slack API ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

// Search Slack messages matching keywords, returns formatted message strings
export async function searchSlackMessages(
  tokens: SlackTokens,
  keywords: string[],
  maxResults = 5
): Promise<Array<{ from: string; channel: string; text: string; date: string }>> {
  if (keywords.length === 0) return [];

  const query = keywords.join(" ");
  try {
    const data = await slackFetch(
      `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=${maxResults}&sort=timestamp&sort_dir=desc`,
      tokens
    );

    const matches = data.messages?.matches || [];
    return matches.map((m: { username?: string; channel?: { name?: string }; text?: string; ts?: string }) => ({
      from: m.username || "unknown",
      channel: m.channel?.name || "dm",
      text: (m.text || "").slice(0, 500),
      date: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : "",
    }));
  } catch {
    return [];
  }
}
