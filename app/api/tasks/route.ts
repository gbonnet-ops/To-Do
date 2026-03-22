import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("tasks")
    .select("*, deals(name, color)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Map to frontend format
  const tasks = (data || []).map((t) => ({
    id: t.id,
    text: t.text,
    deal: t.deals?.name || "Perso",
    priority: t.priority,
    deadline: t.deadline,
    assignee: t.assignee,
    done: t.done,
    synced: t.synced_to_calendar,
    calendar_event_id: t.calendar_event_id,
    source: t.source,
    created_at: t.created_at,
    completed_at: t.completed_at,
  }));

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Look up deal_id from deal name
  let dealId = null;
  if (body.deal) {
    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", body.deal)
      .single();
    dealId = deal?.id || null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      deal_id: dealId,
      text: body.text,
      priority: body.priority || "medium",
      deadline: body.deadline || null,
      assignee: body.assignee || null,
      done: false,
      source: body.source || "manual",
      source_email_id: body.source_email_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

  // Handle deal name → deal_id conversion
  if (updates.deal) {
    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", updates.deal)
      .single();
    updates.deal_id = deal?.id || null;
    delete updates.deal;
  }

  if (updates.done === true && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  } else if (updates.done === false) {
    updates.completed_at = null;
  }

  if (updates.synced !== undefined) {
    updates.synced_to_calendar = updates.synced;
    delete updates.synced;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
