import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google";
import { getSlackTokens, searchSlackMessages } from "@/lib/slack";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";

interface GmailMessageDetail {
  id: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
  };
  snippet?: string;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(msg: GmailMessageDetail): string {
  if (msg.payload?.parts) {
    const textPart = msg.payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data);
  }
  if (msg.payload?.body?.data) return decodeBase64Url(msg.payload.body.data);
  return msg.snippet || "";
}

function getHeader(msg: GmailMessageDetail, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

const STOPWORDS = new Set([
  "meeting", "call", "point", "weekly", "daily", "sync", "standup",
  "review", "discussion", "team", "mail", "intern", "interne", "externe",
  "the", "and", "les", "des", "pour", "avec", "par", "sur", "pas",
  "réunion", "prep", "prépa", "debrief", "catch", "update", "check",
  "management", "staffing", "entretien", "agenda",
]);

function extractKeywords(title: string): string[] {
  return title
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 4);
}

// POST /api/calendar/context — Generate short context summaries for calendar events
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(user.id, "calendar-context", { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const tokens = await getGoogleTokens();
  if (!tokens) return NextResponse.json({ error: "No Google tokens" }, { status: 401 });

  const slackTokens = await getSlackTokens();

  const body = await request.json();
  const events: Array<{ key: string; title: string }> = body.events || [];

  if (events.length === 0) {
    return NextResponse.json({ contexts: {} });
  }

  // Collect messages from Gmail + Slack for each event
  const allMessages: Array<{ eventKey: string; source: string; from: string; subject: string; body: string }> = [];

  const now = new Date();
  const twoWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  const afterEpoch = Math.floor(twoWeeksAgo.getTime() / 1000);

  for (const event of events.slice(0, 10)) {
    const words = extractKeywords(event.title);
    if (words.length === 0) continue;

    // Gmail search
    try {
      const query = `after:${afterEpoch} ${words.join(" ")}`;
      const searchData = await googleFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`,
        tokens
      );

      const messageIds: Array<{ id: string }> = searchData.messages || [];
      if (messageIds.length > 0) {
        const details = await Promise.all(
          messageIds.slice(0, 4).map(async (m) => {
            const detail: GmailMessageDetail = await googleFetch(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
              tokens
            );
            return {
              eventKey: event.key,
              source: "email",
              subject: getHeader(detail, "Subject"),
              from: getHeader(detail, "From"),
              body: extractBody(detail).slice(0, 400),
            };
          })
        );
        allMessages.push(...details);
      }
    } catch {
      // Skip Gmail errors
    }

    // Slack search
    if (slackTokens) {
      try {
        const slackResults = await searchSlackMessages(slackTokens, words, 3);
        for (const msg of slackResults) {
          allMessages.push({
            eventKey: event.key,
            source: "slack",
            from: msg.from,
            subject: `#${msg.channel}`,
            body: msg.text.slice(0, 400),
          });
        }
      } catch {
        // Skip Slack errors
      }
    }
  }

  if (allMessages.length === 0) {
    return NextResponse.json({ contexts: {} });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  // Group messages by event
  const msgsByEvent: Record<string, typeof allMessages> = {};
  for (const msg of allMessages) {
    if (!msgsByEvent[msg.eventKey]) msgsByEvent[msg.eventKey] = [];
    msgsByEvent[msg.eventKey].push(msg);
  }

  const eventSummaries = Object.entries(msgsByEvent).map(([key, msgs]) => {
    const event = events.find((e) => e.key === key);
    const msgText = msgs
      .map((m, i) => {
        if (m.source === "slack") {
          return `  Slack ${i + 1}: @${m.from} in ${m.subject} | ${m.body.slice(0, 300)}`;
        }
        return `  Email ${i + 1}: From: ${m.from} | Subject: ${m.subject} | ${m.body.slice(0, 300)}`;
      })
      .join("\n");
    return `Meeting "${event?.title}" (key: ${key}):\n${msgText}`;
  }).join("\n\n");

  const prompt = `Pour chaque meeting ci-dessous, génère un résumé de contexte TRÈS court (max 80 caractères) basé sur les échanges email et Slack. Le résumé doit donner en un coup d'oeil les sujets/enjeux principaux du meeting.

${eventSummaries}

Return ONLY a valid JSON object where keys are the meeting keys and values are the short context strings in French.
Example: {"title|2025-03-20T10:00:00": "Point sur la proposition commerciale et pricing"}

Si aucun contexte pertinent, ne pas inclure la clé. No markdown, just JSON object.`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!openaiRes.ok) {
    return NextResponse.json({ contexts: {} });
  }

  const openaiData = await openaiRes.json();
  const textContent = openaiData.choices?.[0]?.message?.content || "";

  try {
    const cleaned = textContent.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return NextResponse.json({ contexts: {} });
    const contexts = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json({ contexts });
  } catch {
    return NextResponse.json({ contexts: {} });
  }
}
