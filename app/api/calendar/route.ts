import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { EXCLUDED_TITLES } from "@/lib/constants";

interface CalendarEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
}

// GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: Request) {
  const tokens = await getGoogleTokens();
  if (!tokens) return NextResponse.json({ error: "No Google tokens" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end params" }, { status: 400 });
  }

  const timeMin = new Date(`${start}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${end}T23:59:59Z`).toISOString();

  const data = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=100`,
    tokens
  );

  // Get user's deals for keyword matching
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  let dealKeywords: Record<string, string[]> = {};
  let dealColors: Record<string, string> = {};

  if (user) {
    const { data: deals } = await supabase
      .from("deals")
      .select("name, color, keywords")
      .eq("user_id", user.id);

    if (deals) {
      deals.forEach((d) => {
        // Always include the deal name itself as an implicit keyword
        const kw = d.keywords || [];
        const nameLower = d.name.toLowerCase();
        if (!kw.some((k: string) => k.toLowerCase() === nameLower)) {
          kw.push(d.name);
        }
        dealKeywords[d.name] = kw;
        dealColors[d.name] = d.color;
      });
    }
  }

  const events = (data.items || [])
    .map((e: CalendarEvent) => {
      const title = e.summary || "Sans titre";
      const startStr = e.start?.dateTime || e.start?.date || "";
      const endStr = e.end?.dateTime || e.end?.date || "";
      const date = startStr.slice(0, 10);

      // Exclude personal/blocked events
      const titleLower = title.toLowerCase();
      if (EXCLUDED_TITLES.some((ex) => titleLower.includes(ex))) return null;
      if (titleLower.length < 3) return null;

      // Match to a deal by keywords
      let matchedDeal: string | null = null;
      for (const [dealName, keywords] of Object.entries(dealKeywords)) {
        if (keywords.some((kw) => titleLower.includes(kw.toLowerCase()))) {
          matchedDeal = dealName;
          break;
        }
      }

      return {
        title,
        start: startStr,
        end: endStr,
        date,
        location: e.location || null,
        deal: matchedDeal || "_unmatched",
      };
    })
    .filter(Boolean);

  return NextResponse.json(events);
}

// POST /api/calendar — Push task deadline as calendar event
export async function POST(request: Request) {
  const tokens = await getGoogleTokens();
  if (!tokens) return NextResponse.json({ error: "No Google tokens" }, { status: 401 });

  const body = await request.json();
  const { title, date, description } = body;

  if (!title || !date) {
    return NextResponse.json({ error: "Missing title/date" }, { status: 400 });
  }

  const event = await googleFetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    tokens,
    {
      method: "POST",
      body: JSON.stringify({
        summary: title,
        description: description || "",
        start: { date },
        end: { date },
      }),
    }
  );

  return NextResponse.json({ id: event.id, ok: true });
}
