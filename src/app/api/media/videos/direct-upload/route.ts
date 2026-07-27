import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCloudflareStreamDirectUpload } from "@/lib/cloudflare/stream";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accountSessionCookie = "odyssey-lite-account-id";
const maxBasicUploadBytes = 200 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      accountId?: unknown;
      filename?: unknown;
      mimeType?: unknown;
      size?: unknown;
    };
    const accountId = typeof payload.accountId === "string" ? payload.accountId : "";
    const filename = typeof payload.filename === "string" ? payload.filename.trim().slice(0, 255) : "";
    const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.toLowerCase() : "";
    const size = typeof payload.size === "number" ? payload.size : Number.NaN;
    const sessionAccountId = (await cookies()).get(accountSessionCookie)?.value ?? "";

    if (!accountId || sessionAccountId !== accountId) {
      return NextResponse.json({ error: "Log in again before uploading media." }, { status: 401 });
    }

    if (!filename || !mimeType.startsWith("video/") || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Choose a valid video to upload." }, { status: 400 });
    }

    if (size > maxBasicUploadBytes) {
      return NextResponse.json({ error: "Videos over 200 MB require resumable upload support." }, { status: 413 });
    }

    const supabase = createSupabaseServerClient();
    const { data: account, error } = await supabase.from("app_accounts").select("id").eq("id", accountId).maybeSingle();

    if (error) throw error;
    if (!account) return NextResponse.json({ error: "The selected account no longer exists." }, { status: 403 });

    return NextResponse.json(await createCloudflareStreamDirectUpload({ accountId, filename }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare the video upload." },
      { status: 500 },
    );
  }
}

