import { NextResponse } from "next/server";
import { getSlackTokens } from "@/lib/slack";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// POST /api/slack/notify — Send a Slack DM when a task is assigned
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await getSlackTokens();
  if (!tokens) return NextResponse.json({ error: "Slack non connecté" }, { status: 401 });

  const body = await request.json();
  const { assigneeName, taskText, dealName, priority, deadline } = body;

  if (!assigneeName || !taskText) {
    return NextResponse.json({ error: "Missing assigneeName or taskText" }, { status: 400 });
  }

  try {
    // 1. Find the Slack user by name
    const usersRes = await fetch("https://slack.com/api/users.list?limit=200", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const usersData = await usersRes.json();
    if (!usersData.ok) {
      return NextResponse.json({ error: `Slack users.list: ${usersData.error}` }, { status: 500 });
    }

    const members: Array<{
      id: string;
      name: string;
      real_name?: string;
      deleted?: boolean;
      is_bot?: boolean;
      profile?: { display_name?: string; real_name?: string };
    }> = usersData.members || [];

    const normalizedSearch = assigneeName.toLowerCase().trim();
    const matchedUser = members.find((m) => {
      if (m.deleted || m.is_bot) return false;
      const names = [
        m.name,
        m.real_name,
        m.profile?.display_name,
        m.profile?.real_name,
      ].filter(Boolean).map((n) => n!.toLowerCase());

      // Match by first name, full name, or display name
      return names.some((n) =>
        n === normalizedSearch ||
        n.startsWith(normalizedSearch) ||
        n.split(/\s+/)[0] === normalizedSearch
      );
    });

    if (!matchedUser) {
      return NextResponse.json({
        sent: false,
        reason: `Utilisateur "${assigneeName}" non trouvé sur Slack`,
      });
    }

    // 2. Open a DM channel with the user
    const dmRes = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ users: matchedUser.id }),
    });
    const dmData = await dmRes.json();
    if (!dmData.ok) {
      return NextResponse.json({ error: `Slack conversations.open: ${dmData.error}` }, { status: 500 });
    }
    const channelId = dmData.channel.id;

    // 3. Build and send the message
    const priorityEmoji = priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";
    const deadlineText = deadline ? `\n📅 Échéance: ${deadline}` : "";
    const dealText = dealName ? `\n📁 Projet: ${dealName}` : "";

    const message = `${priorityEmoji} *Nouvelle tâche assignée*\n\n> ${taskText}${dealText}${deadlineText}\n\n_Assignée par DealFlow_`;

    const postRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        text: message,
        unfurl_links: false,
      }),
    });
    const postData = await postRes.json();
    if (!postData.ok) {
      return NextResponse.json({ error: `Slack chat.postMessage: ${postData.error}` }, { status: 500 });
    }

    return NextResponse.json({
      sent: true,
      user: matchedUser.real_name || matchedUser.name,
    });
  } catch (e) {
    return NextResponse.json({
      error: `Erreur Slack: ${e instanceof Error ? e.message : "unknown"}`,
    }, { status: 500 });
  }
}
