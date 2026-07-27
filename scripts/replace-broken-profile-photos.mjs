import fs from "node:fs";
import path from "node:path";

const env = loadEnvFile(path.resolve(".env.local"));
const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const cloudflareAccountId = required("CLOUDFLARE_ACCOUNT_ID");
const cloudflareApiToken = required("CLOUDFLARE_API_TOKEN");
const cloudflareImagesHash = required("NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH");

const accounts = await supabaseRequest(
  "/rest/v1/app_accounts?select=id,username,profile_photo_url&profile_photo_url=not.is.null",
);
const candidates = accounts.filter((account) => {
  try {
    return new URL(account.profile_photo_url).hostname.endsWith("cdninstagram.com");
  } catch {
    return false;
  }
});

console.log(`Found ${candidates.length} expired Instagram profile-photo URLs.`);

for (const [index, account] of candidates.entries()) {
  const generatedAvatarUrl =
    `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(account.username)}&size=512`;
  const body = new FormData();
  body.set("url", generatedAvatarUrl);
  body.set("requireSignedURLs", "false");
  body.set(
    "metadata",
    JSON.stringify({
      ownerAccountId: account.id,
      replacedHost: new URL(account.profile_photo_url).hostname,
      source: "odyssey-lite-expired-avatar-replacement",
      username: account.username,
    }),
  );

  const image = await cloudflareRequest("/images/v1", { body, method: "POST" });
  if (!image.id) throw new Error(`Cloudflare did not return an image ID for @${account.username}.`);

  const deliveryUrl = `https://imagedelivery.net/${cloudflareImagesHash}/${image.id}/avatar`;

  await supabaseRequest("/rest/v1/media_assets", {
    body: JSON.stringify({
      delivery_url: deliveryUrl,
      kind: "image",
      metadata: {
        replacedExpiredUrl: true,
        source: "generated-profile-avatar",
        username: account.username,
      },
      mime_type: "image/png",
      original_filename: `${account.username}-avatar.png`,
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

  console.log(`[${index + 1}/${candidates.length}] replaced @${account.username}`);
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
      "Content-Type": "application/json",
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
