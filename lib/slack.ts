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

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string };
}

/**
 * Find Slack channels whose name matches any of the given keywords.
 * Useful for finding project/client-specific channels (e.g. #projet-babylon, #client-acme).
 */
export async function findChannelsByKeywords(
  tokens: SlackTokens,
  keywords: string[]
): Promise<SlackChannel[]> {
  if (keywords.length === 0) return [];

  try {
    // Fetch channels (public + private the user is in)
    const data = await slackFetch(
      "https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=500",
      tokens
    );

    const channels: Array<{ id: string; name: string }> = data.channels || [];
    const lowerKeywords = keywords.map((k) => k.toLowerCase());

    // Match channels whose name contains any keyword
    return channels.filter((ch) => {
      const name = ch.name.toLowerCase();
      return lowerKeywords.some((kw) => name.includes(kw));
    }).map((ch) => ({ id: ch.id, name: ch.name }));
  } catch {
    return [];
  }
}

/**
 * Get member user IDs of a Slack channel.
 */
export async function getChannelMembers(
  tokens: SlackTokens,
  channelId: string
): Promise<string[]> {
  try {
    const data = await slackFetch(
      `https://slack.com/api/conversations.members?channel=${channelId}&limit=100`,
      tokens
    );
    return data.members || [];
  } catch {
    return [];
  }
}

/**
 * Get display names for a list of Slack user IDs.
 */
export async function getUserNames(
  tokens: SlackTokens,
  userIds: string[]
): Promise<Array<{ id: string; name: string }>> {
  const results: Array<{ id: string; name: string }> = [];
  // Limit to avoid too many API calls
  for (const uid of userIds.slice(0, 20)) {
    try {
      const data = await slackFetch(
        `https://slack.com/api/users.info?user=${uid}`,
        tokens
      );
      const user: SlackUser = data.user;
      const displayName =
        user.profile?.display_name ||
        user.profile?.real_name ||
        user.real_name ||
        user.name;
      results.push({ id: uid, name: displayName });
    } catch {
      // skip
    }
  }
  return results;
}

/**
 * Smart Slack search: finds project/client channels, then searches within those channels
 * AND in DMs with channel members. Returns deduplicated results.
 *
 * Strategy:
 * 1. Find channels matching deal/company/keyword names
 * 2. Get members of those channels
 * 3. Search within matching channels (in:#channel)
 * 4. Search DMs with those members (from:@user)
 */
export async function searchSlackWithContext(
  tokens: SlackTokens,
  options: {
    keywords: string[];
    dealName?: string | null;
    companyName?: string | null;
    attendeeNames?: string[];
    maxResults?: number;
  }
): Promise<Array<{ from: string; channel: string; text: string; date: string }>> {
  const { keywords, dealName, companyName, attendeeNames: names = [], maxResults = 10 } = options;
  const allResults: Array<{ from: string; channel: string; text: string; date: string }> = [];
  const seenTexts = new Set<string>();

  const addResults = (results: Array<{ from: string; channel: string; text: string; date: string }>) => {
    for (const r of results) {
      const key = r.text.slice(0, 100);
      if (!seenTexts.has(key) && allResults.length < maxResults) {
        seenTexts.add(key);
        allResults.push(r);
      }
    }
  };

  // Build channel search terms from deal name, company name, and keywords
  const channelSearchTerms: string[] = [];
  if (dealName) {
    channelSearchTerms.push(
      ...dealName.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
    );
  }
  if (companyName) {
    channelSearchTerms.push(
      ...companyName.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
    );
  }
  // Also add main keywords for channel matching
  channelSearchTerms.push(...keywords.filter((w) => w.length > 2));
  const uniqueChannelTerms = [...new Set(channelSearchTerms.map((t) => t.toLowerCase()))];

  // 1. Find matching channels
  const matchingChannels = await findChannelsByKeywords(tokens, uniqueChannelTerms);

  // 2. Search within matching channels
  for (const ch of matchingChannels.slice(0, 3)) {
    if (allResults.length >= maxResults) break;
    // Search in this channel with keywords
    const channelQuery = keywords.length > 0
      ? `in:#${ch.name} ${keywords.slice(0, 3).join(" ")}`
      : `in:#${ch.name}`;
    try {
      const data = await slackFetch(
        `https://slack.com/api/search.messages?query=${encodeURIComponent(channelQuery)}&count=5&sort=timestamp&sort_dir=desc`,
        tokens
      );
      const matches = data.messages?.matches || [];
      addResults(
        matches.map((m: { username?: string; channel?: { name?: string }; text?: string; ts?: string }) => ({
          from: m.username || "unknown",
          channel: m.channel?.name || ch.name,
          text: (m.text || "").slice(0, 500),
          date: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : "",
        }))
      );
    } catch { /* skip */ }
  }

  // 3. Get members of matching channels, then search DMs with them
  const memberIds = new Set<string>();
  for (const ch of matchingChannels.slice(0, 3)) {
    const members = await getChannelMembers(tokens, ch.id);
    for (const mid of members) {
      // Exclude the user themselves
      if (mid !== tokens.user_id) memberIds.add(mid);
    }
  }

  if (memberIds.size > 0 && allResults.length < maxResults) {
    // Get display names to search DMs
    const users = await getUserNames(tokens, [...memberIds].slice(0, 10));
    for (const user of users) {
      if (allResults.length >= maxResults) break;
      // Search messages from this user (catches both DMs and channels)
      const dmQuery = keywords.length > 0
        ? `from:@${user.name} ${keywords.slice(0, 2).join(" ")}`
        : `from:@${user.name}`;
      try {
        const data = await slackFetch(
          `https://slack.com/api/search.messages?query=${encodeURIComponent(dmQuery)}&count=3&sort=timestamp&sort_dir=desc`,
          tokens
        );
        const matches = data.messages?.matches || [];
        addResults(
          matches.map((m: { username?: string; channel?: { name?: string }; text?: string; ts?: string }) => ({
            from: m.username || user.name,
            channel: m.channel?.name || "dm",
            text: (m.text || "").slice(0, 500),
            date: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : "",
          }))
        );
      } catch { /* skip */ }
    }
  }

  // 4. Fallback: original keyword search (if we don't have enough results yet)
  if (allResults.length < 3) {
    const fallbackTerms = [...(names || []).slice(0, 2), ...keywords.slice(0, 2)].filter(Boolean);
    if (fallbackTerms.length > 0) {
      const fallback = await searchSlackMessages(tokens, fallbackTerms, maxResults - allResults.length);
      addResults(fallback);
    }
  }

  return allResults;
}
