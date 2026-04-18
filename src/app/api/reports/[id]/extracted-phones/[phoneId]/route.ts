import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string; phoneId: string }>;
}

/**
 * PATCH /api/reports/[id]/extracted-phones/[phoneId]
 * Body: { include_in_report: boolean }
 * Updates inclusion flag for a phone row (report owner only).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: reportId, phoneId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = json as { include_in_report?: unknown };
  if (typeof body.include_in_report !== "boolean") {
    return NextResponse.json(
      { error: "include_in_report (boolean) is required" },
      { status: 400 }
    );
  }

  const { data: owned, error: ownedErr } = await supabase
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("created_by_user_id", user.id)
    .maybeSingle();

  if (ownedErr) {
    return NextResponse.json({ error: ownedErr.message }, { status: 500 });
  }
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from("extracted_phones")
    .update({ include_in_report: body.include_in_report })
    .eq("id", phoneId)
    .eq("report_id", reportId)
    .select("id, include_in_report")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true as const, phone: updated });
}
