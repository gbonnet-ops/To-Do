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

/** Build project email address from deal name: "Mon Projet" → "monprojet@clipperton.net" */
function projectEmail(dealName: string | null): string | null {
  if (!dealName) return null;
  const slug = dealName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove spaces, hyphens, etc.
  return slug ? `${slug}@clipperton.net` : null;
}

/** Extract email addresses from From/To/Cc headers */
function extractEmails(header: string): string[] {
  const matches = header.match(/[\w.+-]+@[\w.-]+\.\w+/g);
  return matches || [];
}

/** Extract first name or short identifier from email for Slack search */
function attendeeNames(attendees: string[]): string[] {
  return attendees
    .map((email) => {
      const local = email.split("@")[0];
      // "jean.dupont" → "jean dupont", "jdupont" → "jdupont"
      return local.replace(/[._-]/g, " ").split(/\s+/)[0];
    })
    .filter((n) => n.length > 2)
    .slice(0, 4);
}

interface EventInput {
  key: string;
  title: string;
  deal?: string | null;
  attendees?: string[];
  date?: string;
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
  const events: EventInput[] = body.events || [];

  if (events.length === 0) {
    return NextResponse.json({ contexts: {} });
  }

  // Load deal→company mapping from DB
  const { data: dealsData } = await supabase
    .from("deals")
    .select("name, company")
    .eq("user_id", user.id);
  const companyMap: Record<string, string> = {};
  for (const d of dealsData || []) {
    if (d.company) companyMap[d.name] = d.company;
  }

  const allMessages: Array<{ eventKey: string; source: string; from: string; subject: string; body: string }> = [];

  for (const event of events.slice(0, 10)) {
    const words = extractKeywords(event.title);
    const attendees = event.attendees || [];
    const eventDate = event.date || "";
    const dealName = event.deal && event.deal !== "_unmatched" ? event.deal : null;
    const company = dealName ? companyMap[dealName] : null;

    // Add company name as search keyword
    const companyWords = company
      ? company.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
      : [];
    const allKeywords = [...new Set([...words, ...companyWords])];

    // Time window: 5 days before the meeting (tight = more relevant)
    const meetingDate = eventDate ? new Date(eventDate) : new Date();
    const fiveDaysBefore = new Date(meetingDate.getTime() - 5 * 24 * 60 * 60 * 1000);
    const afterEpoch = Math.floor(fiveDaysBefore.getTime() / 1000);

    // Build targeted Gmail queries:
    const gmailQueries: string[] = [];

    // Project email address (e.g. monprojet@clipperton.net)
    const projEmail = projectEmail(dealName);
    if (projEmail) {
      gmailQueries.push(`after:${afterEpoch} from:${projEmail} OR to:${projEmail}`);
    }

    if (attendees.length > 0 && allKeywords.length > 0) {
      const attendeeFilter = attendees.slice(0, 3).map((e) => `from:${e} OR to:${e}`).join(" OR ");
      gmailQueries.push(`after:${afterEpoch} (${attendeeFilter}) ${allKeywords.join(" ")}`);
    }
    // Only use attendee-only query when there's no deal — otherwise it pulls
    // emails from other projects that happen to share the same participants
    if (attendees.length > 0 && !dealName) {
      const attendeeFilter = attendees.slice(0, 3).map((e) => `from:${e} OR to:${e}`).join(" OR ");
      gmailQueries.push(`after:${afterEpoch} (${attendeeFilter})`);
    }
    if (allKeywords.length > 0) {
      gmailQueries.push(`after:${afterEpoch} ${allKeywords.join(" ")}`);
    }

    const seenIds = new Set<string>();
    // Collect participants discovered from project email threads
    const projectParticipants = new Set<string>();

    for (const query of gmailQueries) {
      if (seenIds.size >= 4) break; // enough context per event
      try {
        const searchData = await googleFetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=4`,
          tokens
        );
        const messageIds: Array<{ id: string }> = searchData.messages || [];
        for (const m of messageIds.slice(0, 4)) {
          if (seenIds.has(m.id) || seenIds.size >= 4) continue;
          seenIds.add(m.id);
          try {
            const detail: GmailMessageDetail = await googleFetch(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
              tokens
            );
            allMessages.push({
              eventKey: event.key,
              source: "email",
              subject: getHeader(detail, "Subject"),
              from: getHeader(detail, "From"),
              body: extractBody(detail).slice(0, 400),
            });
            // Collect participants from project email threads
            for (const hdr of ["From", "To", "Cc"]) {
              for (const email of extractEmails(getHeader(detail, hdr))) {
                if (email !== projEmail) projectParticipants.add(email);
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    // Merge calendar attendees + project email participants for Slack search
    const allParticipants = [...new Set([...attendees, ...projectParticipants])];

    // Slack search: channels + DMs + keyword fallback
    if (slackTokens) {
      try {
        const names = attendeeNames(allParticipants);
        const slackResults = await searchSlackWithContext(slackTokens, {
          keywords: allKeywords,
          dealName: dealName,
          companyName: company,
          attendeeNames: names,
          maxResults: 5,
        });
        for (const msg of slackResults) {
          allMessages.push({
            eventKey: event.key,
            source: "slack",
            from: msg.from,
            subject: `#${msg.channel}`,
            body: msg.text.slice(0, 400),
          });
        }
      } catch { /* skip */ }
    }
  }

  if (allMessages.length === 0) {
    return NextResponse.json({ contexts: {} });
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
    const dealName = event?.deal && event.deal !== "_unmatched" ? event.deal : null;
    const comp = dealName ? companyMap[dealName] : null;
    const dealInfo = dealName ? ` (projet: ${dealName}${comp ? `, entreprise: ${comp}` : ""})` : "";
    return `Meeting "${event?.title}"${dealInfo} (key: ${key}):\n${msgText}`;
  }).join("\n\n");

  const prompt = `Pour chaque meeting ci-dessous, analyse les échanges email/Slack fournis et extrais les informations pertinentes.

${eventSummaries}

Pour chaque meeting, génère un objet JSON avec ces champs :
- "context": résumé court (max 200 caractères) de ce qui a été discuté concrètement
- "agenda": liste des sujets/discussions prévus pour ce meeting, extraits des échanges (tableau de strings). Omets ce champ si aucun agenda n'est mentionné.
- "documents": liste des documents à fournir/préparer pour ce meeting, extraits des échanges (tableau de strings). Omets ce champ si aucun document n'est mentionné.

RÈGLES CRITIQUES:
- Base-toi UNIQUEMENT sur le contenu réel des messages, pas sur des suppositions.
- Si un meeting est associé à un projet (ex: "Otrera"), IGNORE les messages qui parlent d'un AUTRE projet (ex: "Darwin", "Nova", etc.). Ne mélange JAMAIS les projets.
- Si les messages fournis ne sont pas pertinents au meeting ou parlent d'un autre projet, ne pas inclure la clé dans le résultat.
- N'invente JAMAIS d'agenda ou de documents. Ne les inclus que s'ils sont explicitement mentionnés dans les messages.

Return ONLY a valid JSON object where keys are the meeting keys and values are objects with the fields above.
Example: {"title|2025-03-20T10:00:00": {"context": "Jean demande validation du contrat avant vendredi", "agenda": ["Revue du contrat", "Pricing final"], "documents": ["Contrat v3 signé"]}}

No markdown, just JSON object.`;

  let textContent: string;
  try {
    textContent = await callClaude(prompt, { maxTokens: 2000 });
  } catch {
    return NextResponse.json({ contexts: {} });
  }

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
