import { NextResponse } from "next/server";
import { assertSupabaseAdmin } from "@/lib/supabase-admin";

function normalizeWallet(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const wallet = normalizeWallet((formData.get("wallet") as string) ?? null);
    const file = formData.get("file");

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const supabaseAdmin = assertSupabaseAdmin();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.type.split("/")[1] || "jpg";
    const objectName = `${wallet}/${Date.now()}.${ext}`;

    const upload = await supabaseAdmin.storage.from("avatars").upload(objectName, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const { data: publicUrl } = supabaseAdmin.storage.from("avatars").getPublicUrl(objectName);
    const avatarUrl = publicUrl.publicUrl;

    const { data: profile, error: upsertErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          wallet,
          avatar_url: avatarUrl,
        },
        { onConflict: "wallet" }
      )
      .select("wallet, username, avatar_url, badges, badges_count")
      .single();

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Unexpected error" }, { status: 500 });
  }
}
