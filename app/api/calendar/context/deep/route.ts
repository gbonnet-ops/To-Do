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
    parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: Array<{ mimeType?: string; body?: { data?: string } }> }>;
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
    for (const part of msg.payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
      if (part.parts) {
        const sub = part.parts.find((p) => p.mimeType === "text/plain");
        if (sub?.body?.data) return decodeBase64Url(sub.body.data);
      }
    }
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

// POST /api/calendar/context/deep — Generate a detailed context for a single meeting
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(user.id, "calendar-context-deep", { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const tokens = await getGoogleTokens();
  if (!tokens) return NextResponse.json({ error: "No Google tokens" }, { status: 401 });

  const slackTokens = await getSlackTokens();

  const body = await request.json();
  const { title, deal } = body as { key: string; title: string; deal?: string };

  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

  const titleWords = title
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 5);

  const dealWords = deal && deal !== "_unmatched"
    ? deal.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
    : [];

  const searchTerms = [...new Set([...titleWords, ...dealWords])];
  if (searchTerms.length === 0) return NextResponse.json({ context: null });

  const now = new Date();
  const fourWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 28);
  const afterEpoch = Math.floor(fourWeeksAgo.getTime() / 1000);

  // Collect all sources
  const allSources: Array<{ source: string; from: string; date: string; subject: string; body: string }> = [];

  // Gmail search
  try {
    const queries = [
      searchTerms.length > 0 ? `after:${afterEpoch} ${searchTerms.join(" ")}` : null,
      dealWords.length > 0 && titleWords.length > 0 ? `after:${afterEpoch} ${dealWords.join(" ")}` : null,
    ].filter(Boolean) as string[];

    const seenIds = new Set<string>();

    for (const query of queries) {
      const searchData = await googleFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
        tokens
      );
      const messageIds: Array<{ id: string }> = searchData.messages || [];

      for (const m of messageIds.slice(0, 8)) {
        if (seenIds.has(m.id)) continue;
        seenIds.add(m.id);

        try {
          const detail: GmailMessageDetail = await googleFetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
            tokens
          );
          allSources.push({
            source: "email",
            subject: getHeader(detail, "Subject"),
            from: getHeader(detail, "From"),
            date: getHeader(detail, "Date"),
            body: extractBody(detail).slice(0, 800),
          });
        } catch {
          // skip
        }
      }
    }
  } catch {
    // skip
  }

  // Slack search
  if (slackTokens) {
    try {
      // Search with title keywords
      const slackResults = await searchSlackMessages(slackTokens, searchTerms, 8);
      for (const msg of slackResults) {
        allSources.push({
          source: "slack",
          from: msg.from,
          date: msg.date,
          subject: `#${msg.channel}`,
          body: msg.text.slice(0, 600),
        });
      }

      // Also search with deal name alone if different from title keywords
      if (dealWords.length > 0) {
        const dealResults = await searchSlackMessages(slackTokens, dealWords, 5);
        const existingTexts = new Set(allSources.filter((s) => s.source === "slack").map((s) => s.body));
        for (const msg of dealResults) {
          if (!existingTexts.has(msg.text.slice(0, 600))) {
            allSources.push({
              source: "slack",
              from: msg.from,
              date: msg.date,
              subject: `#${msg.channel}`,
              body: msg.text.slice(0, 600),
            });
          }
        }
      }
    } catch {
      // skip
    }
  }

  if (allSources.length === 0) return NextResponse.json({ context: null });

  const sourceText = allSources
    .map((m, i) => {
      if (m.source === "slack") {
        return `Slack ${i + 1}:\n  De: @${m.from} dans ${m.subject}\n  Date: ${m.date}\n  Message: ${m.body}`;
      }
      return `Email ${i + 1}:\n  De: ${m.from}\n  Date: ${m.date}\n  Sujet: ${m.subject}\n  Contenu: ${m.body}`;
    })
    .join("\n\n");

  const prompt = `Tu prépares un briefing pour un meeting "${title}"${deal && deal !== "_unmatched" ? ` (projet: ${deal})` : ""}.

Voici les échanges récents (emails et messages Slack) liés à ce meeting :

${sourceText}

Génère un briefing de préparation concis mais complet en français (3-6 lignes max). Inclus :
- Les sujets/enjeux principaux à discuter
- Les points en suspens ou décisions à prendre
- Le contexte clé (chiffres, dates, noms importants)

Sois direct et factuel. Pas de formule de politesse. Retourne uniquement le texte du briefing.`;

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!openaiRes.ok) return NextResponse.json({ context: null });

    const data = await openaiRes.json();
    const context = data.choices?.[0]?.message?.content?.trim() || null;
    return NextResponse.json({ context });
  } catch {
    return NextResponse.json({ context: null });
  }
}
