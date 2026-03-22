import { NextResponse } from "next/server";
import { getSlackTokens } from "@/lib/slack";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface SlackMember {
  id: string;
  name: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: { display_name?: string; real_name?: string; image_48?: string };
}

function matchMembers(members: SlackMember[], search: string): SlackMember[] {
  const normalized = search.toLowerCase().trim();
  return members.filter((m) => {
    if (m.deleted || m.is_bot) return false;
    const names = [
      m.name,
      m.real_name,
      m.profile?.display_name,
      m.profile?.real_name,
    ].filter(Boolean).map((n) => n!.toLowerCase());

    return names.some((n) =>
      n === normalized ||
      n.startsWith(normalized) ||
      n.split(/\s+/)[0] === normalized
    );
  });
}

// POST /api/slack/notify — Send a Slack DM when a task is assigned
// Supports disambiguation: if multiple users match, returns the list for the user to pick.
// Pass `slackUserId` to skip the search and send directly to that user.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await getSlackTokens();
  if (!tokens) return NextResponse.json({ error: "Slack non connecté" }, { status: 401 });

  const body = await request.json();
  const { assigneeName, taskText, dealName, priority, deadline, slackUserId } = body;

  if (!assigneeName || !taskText) {
    return NextResponse.json({ error: "Missing assigneeName or taskText" }, { status: 400 });
  }

  try {
    let targetUserId: string;
    let targetUserName: string;

    if (slackUserId) {
      // Direct send — user already disambiguated
      targetUserId = slackUserId;
      targetUserName = assigneeName;
    } else {
      // Search for matching users
      const usersRes = await fetch("https://slack.com/api/users.list?limit=200", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const usersData = await usersRes.json();
      if (!usersData.ok) {
        return NextResponse.json({ error: `Slack users.list: ${usersData.error}` }, { status: 500 });
      }

      const members: SlackMember[] = usersData.members || [];
      const matches = matchMembers(members, assigneeName);

      if (matches.length === 0) {
        return NextResponse.json({
          sent: false,
          reason: `Utilisateur "${assigneeName}" non trouvé sur Slack`,
        });
      }

      if (matches.length > 1) {
        // Ambiguous — return candidates for the user to pick
        return NextResponse.json({
          sent: false,
          ambiguous: true,
          matches: matches.map((m) => ({
            id: m.id,
            name: m.real_name || m.name,
            displayName: m.profile?.display_name || m.name,
            avatar: m.profile?.image_48 || null,
          })),
        });
      }

      // Single match
      targetUserId = matches[0].id;
      targetUserName = matches[0].real_name || matches[0].name;
    }

    // Open a DM channel with the user
    const dmRes = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ users: targetUserId }),
    });
    const dmData = await dmRes.json();
    if (!dmData.ok) {
      return NextResponse.json({ error: `Slack conversations.open: ${dmData.error}` }, { status: 500 });
    }
    const channelId = dmData.channel.id;

    // Build and send the message
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
      user: targetUserName,
      slackUserId: targetUserId,
    });
  } catch (e) {
    return NextResponse.json({
      error: `Erreur Slack: ${e instanceof Error ? e.message : "unknown"}`,
    }, { status: 500 });
  }
}
