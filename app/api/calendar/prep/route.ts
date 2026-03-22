import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { callClaude } from "@/lib/claude";

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

// POST /api/calendar/prep — AI-powered meeting prep suggestions
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(user.id, "calendar-prep", { maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const tokens = await getGoogleTokens();
  if (!tokens) return NextResponse.json({ error: "No Google tokens" }, { status: 401 });

  const body = await request.json();
  const newEvents: Array<{ title: string; date: string; start: string; deal: string | null }> = body.newEvents || [];
  const existingTasks: string[] = body.existingTasks || [];
  const dealNames: string[] = body.dealNames || [];

  if (newEvents.length === 0) {
    return NextResponse.json({ prepSuggestions: [] });
  }

  // Search Gmail for emails related to each new meeting (by title keywords)
  const meetingKeywords = newEvents.map((e) => {
    // Extract meaningful words from meeting title (skip very short words)
    const words = e.title
      .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return { event: e, words };
  });

  // Build a Gmail search query to find related emails
  const searchTerms = meetingKeywords
    .flatMap((mk) => mk.words.slice(0, 3)) // top 3 words per meeting
    .filter((w, i, arr) => arr.indexOf(w) === i); // deduplicate

  let emailContext = "";

  if (searchTerms.length > 0) {
    try {
      // Search for emails mentioning meeting-related terms (last 7 days)
      const now = new Date();
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      const afterEpoch = Math.floor(weekAgo.getTime() / 1000);
      const query = `after:${afterEpoch} {${searchTerms.join(" ")}}`;

      const searchData = await googleFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
        tokens
      );

      const messageIds: Array<{ id: string }> = searchData.messages || [];

      if (messageIds.length > 0) {
        const details = await Promise.all(
          messageIds.slice(0, 8).map(async (m) => {
            const detail: GmailMessageDetail = await googleFetch(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
              tokens
            );
            return {
              subject: getHeader(detail, "Subject"),
              from: getHeader(detail, "From"),
              body: extractBody(detail).slice(0, 600),
            };
          })
        );

        emailContext = details
          .map((m, i) => `Email ${i + 1}:\nFrom: ${m.from}\nSubject: ${m.subject}\nBody: ${m.body}\n---`)
          .join("\n");
      }
    } catch {
      // Gmail search failed — continue without email context
    }
  }

  const meetingList = newEvents
    .map((e, i) => `Meeting ${i + 1}: "${e.title}" le ${e.date}${e.deal ? ` (deal: ${e.deal})` : ""}`)
    .join("\n");

  const existingDesc = existingTasks.slice(0, 20).join("; ");

  const prompt = `De nouveaux meetings viennent d'apparaître dans le calendrier. Analyse les emails récents pour identifier les actions de préparation nécessaires avant chaque meeting.

Nouveaux meetings:
${meetingList}

${emailContext ? `Emails récents liés:\n${emailContext}` : "Aucun email lié trouvé."}

Tâches existantes (NE PAS dupliquer): ${existingDesc || "aucune"}

Deals/projets disponibles: ${dealNames.join(", ")}

Pour chaque meeting, propose 0 à 2 tâches de préparation si pertinent. Inspire-toi du contexte des emails (ex: si un email mentionne "préparer un agenda", "envoyer un document", "confirmer la présence de X", etc.).

Si aucun email ne donne de contexte, propose une préparation générique UNIQUEMENT si le meeting semble important (pas de préparation pour des meetings récurrents banals comme "daily standup", "sync", "1:1").

Return ONLY a valid JSON array where each item has:
- "meetingTitle": le titre du meeting concerné
- "text": description concise de la tâche de préparation en français (max 60 chars)
- "deal": one of the available deals, or null
- "priority": "high" or "medium"
- "deadline": "YYYY-MM-DD" (veille du meeting ou plus tôt si nécessaire)
- "source": "Prépa: [nom du meeting court]"

Max 6 suggestions total. No markdown, no explanation, just JSON array. Return [] if no prep needed.`;

  let textContent: string;
  try {
    textContent = await callClaude(prompt, { maxTokens: 1500 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Claude API error" }, { status: 500 });
  }

  try {
    const cleaned = textContent.replace(/```json|```/g, "").trim();
    const start = cleaned.search(/[\[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start === -1 || end === -1) return NextResponse.json({ prepSuggestions: [] });
    const suggestions = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json({
      prepSuggestions: Array.isArray(suggestions) ? suggestions : [],
    });
  } catch {
    return NextResponse.json({ prepSuggestions: [] });
  }
}
