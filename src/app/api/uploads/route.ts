import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/uploads
 * Accepts a multipart form upload of a PDF file.
 * Stores the file in Supabase Storage under uploads/{userId}/{reportId}/{filename}
 * Returns the public URL of the stored file.
 *
 * TODO: Add file type validation server-side (PDF only).
 * TODO: Add file size limit enforcement.
 * TODO: Trigger extraction pipeline after successful upload.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const reportId = formData.get("reportId") as string | null;

  if (!file || !reportId) {
    return NextResponse.json(
      { error: "Missing file or reportId" },
      { status: 400 }
    );
  }

  const filePath = `uploads/${user.id}/${reportId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("report-uploads")
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("report-uploads").getPublicUrl(filePath);

  return NextResponse.json({ url: publicUrl, path: filePath }, { status: 201 });
}
