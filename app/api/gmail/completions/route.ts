import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";

interface GmailMessage {
  id: string;
  threadId: string;
}

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

// POST /api/gmail/completions — Analyze sent emails to suggest task completions
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(user.id, "gmail-completions", { maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const tokens = await getGoogleTokens();
  if (!tokens) return NextResponse.json({ error: "No Google tokens" }, { status: 401 });

  const body = await request.json();
  const openTasks: Array<{ id: string; text: string; deal: string; assignee: string | null }> = body.openTasks || [];

  if (openTasks.length === 0) {
    return NextResponse.json({ completions: [] });
  }

  // Fetch sent emails from today and yesterday
  const now = new Date();
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const afterEpoch = Math.floor(yesterdayStart.getTime() / 1000);

  // Search sent emails only (in:sent)
  const url = new URL("https://www.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", `in:sent after:${afterEpoch}`);
  url.searchParams.set("maxResults", "50");

  const listData = await googleFetch(url.toString(), tokens);
  const messageIds: GmailMessage[] = listData.messages || [];

  if (messageIds.length === 0) {
    return NextResponse.json({ completions: [] });
  }

  // Fetch message details
  const sentEmails = await Promise.all(
    messageIds.map(async (m) => {
      const detail: GmailMessageDetail = await googleFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        tokens
      );
      return {
        id: m.id,
        to: getHeader(detail, "To"),
        subject: getHeader(detail, "Subject"),
        body: extractBody(detail).slice(0, 500),
      };
    })
  );

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const taskList = openTasks
    .map((t, i) => `Task ${i + 1} [id=${t.id}]: "${t.text}" (deal: ${t.deal}${t.assignee ? `, assignee: ${t.assignee}` : ""})`)
    .join("\n");

  const emailList = sentEmails
    .map((e, i) => `Sent ${i + 1}:\nTo: ${e.to}\nSubject: ${e.subject}\nBody: ${e.body}\n---`)
    .join("\n");

  const prompt = `You are analyzing sent emails to determine which existing tasks may have been completed.

Here are the user's open (incomplete) tasks:
${taskList}

Here are emails SENT by the user today:
${emailList}

For each task that appears to be completed based on the sent emails, return a JSON object.
For example, if a task says "envoyer mail Fabrice" and there is a sent email to Fabrice, that task is likely done.

CRITICAL RULES:
- The email must DIRECTLY relate to the specific task. A match requires both the ACTION and the RECIPIENT/SUBJECT to align.
- NEVER match a task from one project/deal with an email about a DIFFERENT project/deal. For example, a task about "Babylon" cannot be marked as done by an email about "Darwin" or "Nova" etc.
- The deal/project name in the task MUST match the email context. If a task is tagged to deal "Babylon", only emails clearly about Babylon can complete it.
- Be STRICT — only suggest completion if there's an obvious, direct match. When in doubt, do NOT include it.

Return ONLY a valid JSON array where each item has:
- "taskId": the task id
- "taskText": the task text (for display)
- "reason": short explanation in French of why it seems done (max 50 chars, e.g. "Mail envoyé à Fabrice à 14h23")

Max 10 matches. No markdown, no explanation, just JSON array. If no matches, return [].`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text().catch(() => "");
    return NextResponse.json({ error: `OpenAI API: ${err.slice(0, 200)}` }, { status: 500 });
  }

  const openaiData = await openaiRes.json();
  const textContent = openaiData.choices?.[0]?.message?.content || "";

  try {
    const cleaned = textContent.replace(/```json|```/g, "").trim();
    const start = cleaned.search(/[\[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start === -1 || end === -1) return NextResponse.json({ completions: [] });
    const completions = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json({
      completions: Array.isArray(completions) ? completions : [],
    });
  } catch {
    return NextResponse.json({ completions: [] });
  }
}
