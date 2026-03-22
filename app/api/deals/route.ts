import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizeString } from "@/lib/validation";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const deals = (data || []).map((d) => ({
    id: d.id,
    name: d.name,
    color: d.color,
    keywords: d.keywords || [],
    sort_order: d.sort_order,
  }));

  return NextResponse.json(deals);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const name = sanitizeString(body.name, 100);
  if (!name) return NextResponse.json({ error: "Missing deal name" }, { status: 400 });

  const { data, error } = await supabase
    .from("deals")
    .insert({
      user_id: user.id,
      name,
      color: sanitizeString(body.color, 20) || "#888",
      keywords: body.keywords || [],
      sort_order: body.sort_order || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) return NextResponse.json({ error: "Missing deal name" }, { status: 400 });

  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("user_id", user.id)
    .eq("name", name);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
