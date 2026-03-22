import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google";
import { getSlackTokens, searchSlackMessages, findChannelsByKeywords } from "@/lib/slack";
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

/** Build project email address from deal name */
function projectEmail(dealName: string): string | null {
  const slug = dealName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}@clipperton.net` : null;
}

// POST /api/recap — Generate a recap of all exchanges on a project
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(user.id, "recap", { maxRequests: 3, windowMs: 60_000 });
  if (limited) return limited;

  const body = await request.json();
  const { dealName, company, period } = body; // period: "today" | "week"

  if (!dealName) {
    return NextResponse.json({ error: "dealName required" }, { status: 400 });
  }

  const tokens = await getGoogleTokens();
  const slackTokens = await getSlackTokens();

  if (!tokens && !slackTokens) {
    return NextResponse.json({ error: "Aucune source connectée (Gmail/Slack)" }, { status: 401 });
  }

  // Time window
  const now = new Date();
  const windowStart = period === "week"
    ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const afterEpoch = Math.floor(windowStart.getTime() / 1000);

  const allSources: Array<{
    source: "email" | "slack";
    from: string;
    date: string;
    subject?: string;
    channel?: string;
    body: string;
  }> = [];

  // ── Gmail search ──
  if (tokens) {
    const seenIds = new Set<string>();
    const gmailQueries: string[] = [];

    // Project email address
    const projEmail = projectEmail(dealName);
    if (projEmail) {
      gmailQueries.push(`after:${afterEpoch} from:${projEmail} OR to:${projEmail}`);
    }

    // Deal name keywords
    const dealWords = dealName.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2);
    if (dealWords.length > 0) {
      gmailQueries.push(`after:${afterEpoch} ${dealWords.join(" ")}`);
    }

    // Company name
    if (company) {
      const companyWords = company.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2);
      if (companyWords.length > 0) {
        gmailQueries.push(`after:${afterEpoch} ${companyWords.join(" ")}`);
      }
    }

    for (const query of gmailQueries) {
      if (seenIds.size >= 20) break;
      try {
        const searchData = await googleFetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
          tokens
        );
        const messageIds: Array<{ id: string }> = searchData.messages || [];
        for (const m of messageIds) {
          if (seenIds.has(m.id) || seenIds.size >= 20) continue;
          seenIds.add(m.id);
          try {
            const detail: GmailMessageDetail = await googleFetch(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
              tokens
            );
            allSources.push({
              source: "email",
              from: getHeader(detail, "From"),
              date: getHeader(detail, "Date"),
              subject: getHeader(detail, "Subject"),
              body: extractBody(detail).slice(0, 600),
            });
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }

  // ── Slack search ──
  if (slackTokens) {
    const dealWords = dealName.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2);
    const searchTerms = [...dealWords];
    if (company) {
      searchTerms.push(...company.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2));
    }

    // Find matching channels
    const channels = await findChannelsByKeywords(slackTokens, [...new Set(searchTerms.map((t) => t.toLowerCase()))]);
    for (const ch of channels.slice(0, 3)) {
      try {
        const results = await searchSlackMessages(slackTokens, [`in:#${ch.name}`], 10);
        // Filter by date window
        const filtered = results.filter((m) => {
          if (!m.date) return true;
          return new Date(m.date).getTime() >= windowStart.getTime();
        });
        allSources.push(
          ...filtered.map((m) => ({
            source: "slack" as const,
            from: m.from,
            date: m.date,
            channel: m.channel,
            body: m.text.slice(0, 600),
          }))
        );
      } catch { /* skip */ }
    }

    // Keyword search
    if (searchTerms.length > 0) {
      const results = await searchSlackMessages(slackTokens, searchTerms.slice(0, 4), 10);
      const filtered = results.filter((m) => {
        if (!m.date) return true;
        return new Date(m.date).getTime() >= windowStart.getTime();
      });
      allSources.push(
        ...filtered.map((m) => ({
          source: "slack" as const,
          from: m.from,
          date: m.date,
          channel: m.channel,
          body: m.text.slice(0, 600),
        }))
      );
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = allSources.filter((s) => {
    const key = `${s.source}:${s.body.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    return NextResponse.json({ recap: `Aucun échange trouvé pour "${dealName}" sur cette période.` });
  }

  // Generate recap with Claude API
  const periodLabel = period === "week" ? "les 7 derniers jours" : "aujourd'hui";
  const sourcesSummary = unique.map((s, i) => {
    if (s.source === "email") {
      return `Email ${i + 1}:\n  De: ${s.from}\n  Date: ${s.date}\n  Sujet: ${s.subject || "(sans sujet)"}\n  Contenu: ${s.body}`;
    }
    return `Slack ${i + 1}:\n  De: @${s.from} dans #${s.channel || "dm"}\n  Date: ${s.date}\n  Message: ${s.body}`;
  }).join("\n\n");

  const prompt = `Tu es un analyste M&A. Génère un récapitulatif structuré et concis de tous les échanges concernant le projet "${dealName}"${company ? ` (${company})` : ""} pour ${periodLabel}.

Sources (${unique.length} échanges):
${sourcesSummary}

Génère un récap en français avec :
1. **Résumé exécutif** (2-3 phrases)
2. **Points clés** (liste à puces des informations importantes)
3. **Actions en cours / Prochaines étapes** (ce qui doit être fait)
4. **Personnes impliquées** (qui a communiqué sur quoi)

Sois concis et factuel. Format Markdown.`;

  let recap: string;
  try {
    recap = await callClaude(prompt, { maxTokens: 2048 }) || "Impossible de générer le récap.";
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Claude API error" }, { status: 500 });
  }

  return NextResponse.json({
    recap,
    sourcesCount: unique.length,
    emailCount: unique.filter((s) => s.source === "email").length,
    slackCount: unique.filter((s) => s.source === "slack").length,
  });
}
