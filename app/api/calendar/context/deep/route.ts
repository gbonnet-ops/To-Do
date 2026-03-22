import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google";
import { getSlackTokens, searchSlackWithContext } from "@/lib/slack";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { callClaude } from "@/lib/claude";

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

function attendeeNames(attendees: string[]): string[] {
  return attendees
    .map((email) => {
      const local = email.split("@")[0];
      return local.replace(/[._-]/g, " ").split(/\s+/)[0];
    })
    .filter((n) => n.length > 2)
    .slice(0, 4);
}

/** Build project email address from deal name: "Mon Projet" → "monprojet@clipperton.net" */
function projectEmail(dealName: string | null | undefined): string | null {
  if (!dealName || dealName === "_unmatched") return null;
  const slug = dealName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}@clipperton.net` : null;
}

/** Extract email addresses from From/To/Cc headers */
function extractEmails(header: string): string[] {
  const matches = header.match(/[\w.+-]+@[\w.-]+\.\w+/g);
  return matches || [];
}

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
  const { title, deal, attendees: rawAttendees, date: eventDate } = body as {
    key: string; title: string; deal?: string; attendees?: string[]; date?: string;
  };

  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  // Claude API key is checked inside callClaude()

  const attendees = rawAttendees || [];

  // Look up company name for this deal
  let company: string | null = null;
  if (deal && deal !== "_unmatched") {
    const { data: dealData } = await supabase
      .from("deals")
      .select("company")
      .eq("user_id", user.id)
      .eq("name", deal)
      .single();
    company = dealData?.company || null;
  }

  const titleWords = title
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 5);

  const dealWords = deal && deal !== "_unmatched"
    ? deal.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
    : [];

  const companyWords = company
    ? company.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
    : [];

  const searchTerms = [...new Set([...titleWords, ...dealWords, ...companyWords])];

  // Time windows: 7 days tight (attendee search) + 14 days wider (keyword search)
  const meetingDate = eventDate ? new Date(eventDate) : new Date();
  const sevenDaysBefore = new Date(meetingDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysBefore = new Date(meetingDate.getTime() - 14 * 24 * 60 * 60 * 1000);
  const tightEpoch = Math.floor(sevenDaysBefore.getTime() / 1000);
  const wideEpoch = Math.floor(fourteenDaysBefore.getTime() / 1000);

  const allSources: Array<{ source: string; from: string; date: string; subject: string; body: string }> = [];
  const seenIds = new Set<string>();

  // Strategy: prioritized Gmail queries
  const gmailQueries: Array<{ query: string; max: number }> = [];

  // 0. Project email address (e.g. monprojet@clipperton.net) — highest priority
  const projEmail = projectEmail(deal);
  if (projEmail) {
    gmailQueries.push({
      query: `after:${wideEpoch} from:${projEmail} OR to:${projEmail}`,
      max: 8,
    });
  }

  // 1. Emails with attendees + keywords (most relevant)
  if (attendees.length > 0 && searchTerms.length > 0) {
    const attendeeFilter = attendees.slice(0, 4).map((e) => `from:${e} OR to:${e}`).join(" OR ");
    gmailQueries.push({
      query: `after:${tightEpoch} (${attendeeFilter}) ${searchTerms.join(" ")}`,
      max: 6,
    });
  }

  // 2. Recent threads with attendees (conversations leading up to meeting)
  if (attendees.length > 0) {
    const attendeeFilter = attendees.slice(0, 4).map((e) => `from:${e} OR to:${e}`).join(" OR ");
    gmailQueries.push({
      query: `after:${tightEpoch} (${attendeeFilter})`,
      max: 6,
    });
  }

  // 3. Keywords in wider window (fallback)
  if (searchTerms.length > 0) {
    gmailQueries.push({
      query: `after:${wideEpoch} ${searchTerms.join(" ")}`,
      max: 6,
    });
  }

  // 4. Deal-specific search
  if (dealWords.length > 0 && dealWords.join(" ") !== searchTerms.join(" ")) {
    gmailQueries.push({
      query: `after:${wideEpoch} ${dealWords.join(" ")}`,
      max: 4,
    });
  }

  // Execute Gmail queries
  const projectParticipants = new Set<string>();

  for (const { query, max } of gmailQueries) {
    if (seenIds.size >= 12) break; // enough total context
    try {
      const searchData = await googleFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
        tokens
      );
      const messageIds: Array<{ id: string }> = searchData.messages || [];

      for (const m of messageIds) {
        if (seenIds.has(m.id) || seenIds.size >= 12) continue;
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
          // Collect participants from email threads (especially project email ones)
          for (const hdr of ["From", "To", "Cc"]) {
            for (const email of extractEmails(getHeader(detail, hdr))) {
              if (email !== projEmail) projectParticipants.add(email);
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  // Merge calendar attendees + participants discovered from project email threads
  const allParticipants = [...new Set([...attendees, ...projectParticipants])];

  // Slack search — smart channel + DM + keyword strategy
  if (slackTokens) {
    const names = attendeeNames(allParticipants);

    try {
      const slackResults = await searchSlackWithContext(slackTokens, {
        keywords: searchTerms,
        dealName: deal && deal !== "_unmatched" ? deal : null,
        companyName: company,
        attendeeNames: names,
        maxResults: 12,
      });
      for (const msg of slackResults) {
        allSources.push({
          source: "slack",
          from: msg.from,
          date: msg.date,
          subject: `#${msg.channel}`,
          body: msg.text.slice(0, 600),
        });
      }
    } catch { /* skip */ }
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

  const attendeeInfo = allParticipants.length > 0
    ? `\nParticipants et contacts projet: ${allParticipants.join(", ")}`
    : "";

  const dealInfo = deal && deal !== "_unmatched"
    ? ` (projet: ${deal}${company ? `, entreprise: ${company}` : ""})`
    : "";

  const prompt = `Tu prépares un briefing pour un meeting "${title}"${dealInfo}.${attendeeInfo}

Voici les échanges récents (emails et messages Slack) avec les participants de ce meeting :

${sourceText}

IMPORTANT: Base-toi UNIQUEMENT sur le contenu concret des messages ci-dessus. Ne fais PAS de suppositions sur le projet en général. Résume ce qui a été dit/demandé/décidé récemment par les participants.

Génère un briefing de préparation concis mais complet en français (3-6 lignes max). Inclus :
- Ce dont les participants ont discuté récemment (sujets concrets)
- Les questions/demandes en attente de réponse
- Les points à trancher ou valider lors du meeting

Sois direct et factuel. Pas de formule de politesse. Retourne uniquement le texte du briefing. Si les messages ne sont pas pertinents au meeting, dis-le en une phrase.`;

  try {
    const context = (await callClaude(prompt, { maxTokens: 500 }))?.trim() || null;
    return NextResponse.json({ context });
  } catch {
    return NextResponse.json({ context: null });
  }
}
