import fs from "node:fs";
import path from "node:path";

const env = loadEnvFile(path.resolve(".env.local"));
const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const cloudflareAccountId = required("CLOUDFLARE_ACCOUNT_ID");
const cloudflareApiToken = required("CLOUDFLARE_API_TOKEN");
const cloudflareImagesHash = required("NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH");

const accounts = await supabaseRequest(
  "/rest/v1/app_accounts?select=id,username,profile_photo_url&profile_photo_url=like.data:*",
);
const embeddedAccounts = accounts.filter((account) => account.profile_photo_url?.startsWith("data:image/"));

console.log(`Found ${embeddedAccounts.length} embedded profile photos.`);

for (const [index, account] of embeddedAccounts.entries()) {
  const match = account.profile_photo_url.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) {
    console.warn(`[${index + 1}/${embeddedAccounts.length}] skipped @${account.username}: unsupported data URL`);
    continue;
  }

  const mimeType = match[1];
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const bytes = Buffer.from(match[2], "base64");
  const body = new FormData();
  body.set("file", new Blob([bytes], { type: mimeType }), `${account.username}.${extension}`);
  body.set("requireSignedURLs", "false");
  body.set(
    "metadata",
    JSON.stringify({
      ownerAccountId: account.id,
      source: "odyssey-lite-embedded-profile-backfill",
      username: account.username,
    }),
  );

  const image = await cloudflareRequest("/images/v1", { body, method: "POST" });
  if (!image.id) throw new Error(`Cloudflare did not return an image ID for @${account.username}.`);

  const deliveryUrl = `https://imagedelivery.net/${cloudflareImagesHash}/${image.id}/avatar`;

  await supabaseRequest(`/rest/v1/media_assets`, {
    body: JSON.stringify({
      delivery_url: deliveryUrl,
      kind: "image",
      metadata: { source: "embedded-profile-photo-backfill", username: account.username },
      mime_type: mimeType,
      original_filename: `${account.username}.${extension}`,
      owner_account_id: account.id,
      provider: "cloudflare_images",
      provider_asset_id: image.id,
      status: "ready",
    }),
    headers: { Prefer: "return=minimal" },
    method: "POST",
  });

  await supabaseRequest(`/rest/v1/app_accounts?id=eq.${encodeURIComponent(account.id)}`, {
    body: JSON.stringify({ profile_photo_url: deliveryUrl }),
    headers: { Prefer: "return=minimal" },
    method: "PATCH",
  });

  console.log(`[${index + 1}/${embeddedAccounts.length}] migrated @${account.username}`);
}

async function cloudflareRequest(endpoint, init) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}${endpoint}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${cloudflareApiToken}`,
        ...init.headers,
      },
    },
  );
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join("; ") || "Cloudflare request failed.");
  }

  return payload.result;
}

async function supabaseRequest(endpoint, init = {}) {
  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": init.body instanceof FormData ? undefined : "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function loadEnvFile(filename) {
  const values = {};

  for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }

  return values;
}

function required(name) {
  const value = process.env[name] || env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
