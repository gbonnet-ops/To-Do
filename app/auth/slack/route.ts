import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /auth/slack — Redirect to Slack OAuth
export async function GET(request: Request) {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "SLACK_CLIENT_ID not configured" }, { status: 500 });
  }

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/auth/slack/callback`;

  // user scopes: search messages, list channels & members, read user profiles
  const scopes = "search:read,channels:read,groups:read,users:read";

  const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
  slackUrl.searchParams.set("client_id", clientId);
  slackUrl.searchParams.set("user_scope", scopes);
  slackUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(slackUrl.toString());
}

// POST /auth/slack — Disconnect Slack
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await supabase.from("profiles").update({ slack_tokens: null }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
