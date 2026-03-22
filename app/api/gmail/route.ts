import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google";

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
  // Try plain text from parts
  if (msg.payload?.parts) {
    const textPart = msg.payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) return decodeBase64Url(textPart.body.data);
  }
  // Try body directly
  if (msg.payload?.body?.data) return decodeBase64Url(msg.payload.body.data);
  // Fallback to snippet
  return msg.snippet || "";
}

function getHeader(msg: GmailMessageDetail, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

// POST /api/gmail — Scan inbox and extract task suggestions via Claude API
export async function POST(request: Request) {
  const tokens = await getGoogleTokens();
  if (!tokens) return NextResponse.json({ error: "No Google tokens" }, { status: 401 });

  const body = await request.json();
  const existingTasks: string[] = body.existingTasks || [];
  const dealNames: string[] = body.dealNames || [];

  // Fetch recent messages (last 3 days)
  const threeDaysAgo = Math.floor((Date.now() - 3 * 86400000) / 1000);
  const listData = await googleFetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?` +
    `q=after:${threeDaysAgo}&maxResults=15`,
    tokens
  );

  const messageIds: GmailMessage[] = listData.messages || [];
  if (messageIds.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch message details (max 10)
  const messages = await Promise.all(
    messageIds.slice(0, 10).map(async (m) => {
      const detail: GmailMessageDetail = await googleFetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        tokens
      );
      return {
        id: m.id,
        subject: getHeader(detail, "Subject"),
        from: getHeader(detail, "From"),
        body: extractBody(detail).slice(0, 1000), // Limit body size
      };
    })
  );

  // Send to OpenAI API for task extraction
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const existingDesc = existingTasks.slice(0, 15).join("; ");
  const emailSummary = messages
    .map((m, i) => `Email ${i + 1}:\nFrom: ${m.from}\nSubject: ${m.subject}\nBody: ${m.body}\n---`)
    .join("\n");

  const prompt = `Analyze these emails and extract actionable tasks/follow-ups.

Existing tasks (don't duplicate): ${existingDesc}

Available deals/projects: ${dealNames.join(", ")}

${emailSummary}

Return ONLY a valid JSON array where each suggested task has:
- "text": concise task description in French (max 60 chars)
- "deal": one of the available deals, or null if unclear
- "priority": "high", "medium", or "low"
- "deadline": "YYYY-MM-DD" or null
- "assignee": person name or null
- "source": email subject line (short)

Only include actionable items. Max 8 suggestions. No markdown, no explanation, just JSON array. If no tasks found, return [].`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text().catch(() => "");
    return NextResponse.json({ error: `OpenAI API: ${err.slice(0, 200)}` }, { status: 500 });
  }

  const openaiData = await openaiRes.json();
  const textContent = openaiData.choices?.[0]?.message?.content || "";

  // Parse JSON from OpenAI's response
  try {
    const cleaned = textContent.replace(/```json|```/g, "").trim();
    const start = cleaned.search(/[\[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start === -1 || end === -1) return NextResponse.json([]);
    const suggestions = JSON.parse(cleaned.slice(start, end + 1));
    return NextResponse.json(Array.isArray(suggestions) ? suggestions : []);
  } catch {
    return NextResponse.json([]);
  }
}
