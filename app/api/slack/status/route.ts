import { NextResponse } from "next/server";
import { getSlackTokens } from "@/lib/slack";

// GET /api/slack/status — Check if Slack is connected
export async function GET() {
  const tokens = await getSlackTokens();
  return NextResponse.json({
    connected: !!tokens,
    team: tokens?.team_name || null,
  });
}
