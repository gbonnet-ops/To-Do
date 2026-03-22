import { NextResponse } from "next/server";
import { getSlackTokens, searchSlackMessages, findChannelsByKeywords } from "@/lib/slack";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { callClaude } from "@/lib/claude";

// POST /api/slack/scan — Scan Slack messages and extract task suggestions
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(user.id, "slack-scan", { maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const tokens = await getSlackTokens();
  if (!tokens) return NextResponse.json({ error: "Slack non connecté" }, { status: 401 });

  const body = await request.json();
  const existingTasks: string[] = body.existingTasks || [];
  const dealNames: string[] = body.dealNames || [];

  // Search recent messages in deal-related channels + DMs
  const allMessages: Array<{ from: string; channel: string; text: string; date: string }> = [];

  // 1. Search in deal/project channels
  const dealWords = dealNames.flatMap((d) =>
    d.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
  );
  const channels = await findChannelsByKeywords(tokens, [...new Set(dealWords.map((w) => w.toLowerCase()))]);

  for (const ch of channels.slice(0, 5)) {
    try {
      const results = await searchSlackMessages(tokens, [`in:#${ch.name}`], 8);
      allMessages.push(...results);
    } catch { /* skip */ }
  }

  // 2. General recent keyword search
  if (dealWords.length > 0) {
    const results = await searchSlackMessages(tokens, dealWords.slice(0, 4), 10);
    allMessages.push(...results);
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = allMessages.filter((m) => {
    const key = m.text.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);

  if (unique.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const existingDesc = existingTasks.slice(0, 15).join("; ");
  const msgSummary = unique
    .map((m, i) => `Slack ${i + 1}:\nFrom: @${m.from} in #${m.channel}\nDate: ${m.date}\nMessage: ${m.text}\n---`)
    .join("\n");

  const prompt = `Analyze these Slack messages and extract actionable tasks/follow-ups.

Existing tasks (don't duplicate): ${existingDesc}

Available deals/projects: ${dealNames.join(", ")}

${msgSummary}

Return ONLY a valid JSON array where each suggested task has:
- "text": concise task description in French (max 60 chars)
- "deal": one of the available deals, or null if unclear
- "priority": "high", "medium", or "low"
- "deadline": "YYYY-MM-DD" or null
- "assignee": person name or null
- "source": "Slack #channel" or "Slack @user" (short)

Only include actionable items. Max 8 suggestions. No markdown, no explanation, just JSON array. If no tasks found, return [].`;

  let textContent: string;
  try {
    textContent = await callClaude(prompt, { maxTokens: 2048 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Claude API error" }, { status: 500 });
  }

  try {
    const cleaned = textContent.replace(/```json|```/g, "").trim();
    const start = cleaned.search(/[\[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start === -1 || end === -1) return NextResponse.json({ suggestions: [] });
    const suggestions = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json({
      suggestions: Array.isArray(suggestions) ? suggestions : [],
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
