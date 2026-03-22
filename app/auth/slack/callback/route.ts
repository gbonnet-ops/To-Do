import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /auth/slack/callback — Exchange code for Slack user token
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?slack_error=${error || "no_code"}`);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?slack_error=not_configured`);
  }

  const redirectUri = `${origin}/auth/slack/callback`;

  // Exchange code for token
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.ok || !tokenData.authed_user?.access_token) {
    return NextResponse.redirect(`${origin}/?slack_error=${tokenData.error || "token_failed"}`);
  }

  // Store Slack tokens in profile
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?slack_error=not_logged_in`);
  }

  await supabase.from("profiles").update({
    slack_tokens: {
      access_token: tokenData.authed_user.access_token,
      user_id: tokenData.authed_user.id,
      team_name: tokenData.team?.name || null,
    },
  }).eq("id", user.id);

  return NextResponse.redirect(`${origin}/?slack=connected`);
}
