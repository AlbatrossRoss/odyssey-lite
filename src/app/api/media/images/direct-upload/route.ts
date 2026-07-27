import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createCloudflareImageDirectUpload } from "@/lib/cloudflare/images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accountSessionCookie = "odyssey-lite-account-id";
const maxFilenameLength = 255;

type DirectUploadRequest = {
  accountId?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  size?: unknown;
};

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ error: "Expected a JSON request." }, { status: 415 });
    }

    const payload = (await request.json()) as DirectUploadRequest;
    const accountId = typeof payload.accountId === "string" ? payload.accountId : "";
    const filename = typeof payload.filename === "string" ? payload.filename.trim().slice(0, maxFilenameLength) : "";
    const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.toLowerCase() : "";
    const size = typeof payload.size === "number" ? payload.size : Number.NaN;
    const cookieStore = await cookies();
    const sessionAccountId = cookieStore.get(accountSessionCookie)?.value ?? "";

    if (!accountId || !sessionAccountId || sessionAccountId !== accountId) {
      return NextResponse.json({ error: "Log in again before uploading media." }, { status: 401 });
    }

    if (!filename || !mimeType.startsWith("image/") || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Choose a valid image to upload." }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: account, error } = await supabase.from("app_accounts").select("id").eq("id", accountId).maybeSingle();

    if (error) {
      throw error;
    }

    if (!account) {
      return NextResponse.json({ error: "The selected account no longer exists." }, { status: 403 });
    }

    const directUpload = await createCloudflareImageDirectUpload({ accountId, filename });

    return NextResponse.json(directUpload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare the image upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

