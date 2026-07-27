import fs from "node:fs";
import path from "node:path";

const execute = process.argv.includes("--execute");
const env = loadEnvFile(path.resolve(".env.local"));
const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const cloudflareAccountId = required("CLOUDFLARE_ACCOUNT_ID");
const cloudflareApiToken = required("CLOUDFLARE_API_TOKEN");
const cloudflareImagesHash = required("NEXT_PUBLIC_CLOUDFLARE_IMAGES_ACCOUNT_HASH");
const cloudflareApiBase = "https://api.cloudflare.com/client/v4";
const videoExtensions = new Set(["avi", "m4v", "mov", "mp4", "webm"]);

const posts = await supabaseRequest("/rest/v1/app_posts?select=id,account_id,image_url,media_urls,media_types&order=created_at.asc");
const referencesByUrl = collectReferences(posts);
const supabaseEntries = [...referencesByUrl.entries()].filter(([url]) => isSupabaseStorageUrl(url));
const existingAssets = await supabaseRequest(
  "/rest/v1/media_assets?select=id,provider,provider_asset_id,status,delivery_url,legacy_url&limit=1000",
);
const existingByLegacyUrl = new Map(existingAssets.filter((asset) => asset.legacy_url).map((asset) => [asset.legacy_url, asset]));
const summary = {
  alreadyMigrated: 0,
  failed: 0,
  images: 0,
  linkedPosts: 0,
  videos: 0,
};

console.log(`Found ${supabaseEntries.length} unique Supabase media URLs referenced by ${posts.length} posts.`);
console.log(`${existingByLegacyUrl.size} legacy mappings already exist.`);

if (!execute) {
  const imageCount = supabaseEntries.filter(([url, references]) => inferKind(url, references) === "image").length;
  const videoCount = supabaseEntries.length - imageCount;
  console.log(`Dry run: ${imageCount} images and ${videoCount} videos are eligible.`);
  console.log("Run with --execute to copy assets. No post rows or Supabase Storage objects will be changed.");
  process.exit(0);
}

await runPool(supabaseEntries, 3, async ([legacyUrl, references], index) => {
  const existing = existingByLegacyUrl.get(legacyUrl);

  try {
    const asset = existing ?? (await migrateAsset(legacyUrl, references));

    if (existing) {
      summary.alreadyMigrated += 1;
    } else if (asset.provider === "cloudflare_stream") {
      summary.videos += 1;
    } else {
      summary.images += 1;
    }

    const linkedPosts = await linkAssetToPosts(asset.id, references);
    summary.linkedPosts += linkedPosts;
    console.log(`[${index + 1}/${supabaseEntries.length}] ${existing ? "mapped" : "copied"} ${asset.provider}: ${legacyUrl}`);
  } catch (error) {
    summary.failed += 1;
    console.error(`[${index + 1}/${supabaseEntries.length}] failed: ${legacyUrl}`);
    console.error(error instanceof Error ? error.message : error);
  }
});

console.log(JSON.stringify(summary, null, 2));

if (summary.failed) {
  process.exitCode = 1;
}

async function migrateAsset(legacyUrl, references) {
  const kind = inferKind(legacyUrl, references);
  const ownerAccountId = references[0].accountId;
  const originalFilename = decodeURIComponent(new URL(legacyUrl).pathname.split("/").pop() || "media");

  if (kind === "video") {
    const video = await cloudflareRequest("/stream/copy", {
      body: JSON.stringify({
        meta: {
          legacyUrl,
          ownerAccountId,
          source: "odyssey-lite-supabase-backfill",
        },
        url: legacyUrl,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!video.uid) throw new Error("Stream copy did not return an asset ID.");

    const inserted = await insertMediaAsset({
      delivery_url: null,
      kind: "video",
      legacy_url: legacyUrl,
      metadata: {},
      original_filename: originalFilename,
      owner_account_id: ownerAccountId,
      provider: "cloudflare_stream",
      provider_asset_id: video.uid,
      status: "processing",
    });
    const readyVideo = await waitForStream(video.uid);
    const deliveryUrl = streamDeliveryUrl(readyVideo);
    const [updated] = await supabaseRequest(
      `/rest/v1/media_assets?id=eq.${encodeURIComponent(inserted.id)}`,
      {
        body: JSON.stringify({
          delivery_url: deliveryUrl,
          duration_seconds: readyVideo.duration ?? null,
          height: readyVideo.input?.height ?? null,
          metadata: {
            dash: readyVideo.playback?.dash ?? null,
            hls: readyVideo.playback?.hls ?? null,
            thumbnail: readyVideo.thumbnail ?? null,
          },
          status: "ready",
          width: readyVideo.input?.width ?? null,
        }),
        headers: { Prefer: "return=representation" },
        method: "PATCH",
      },
    );
    return updated;
  }

  const body = new FormData();
  body.set("url", legacyUrl);
  body.set("requireSignedURLs", "false");
  body.set(
    "metadata",
    JSON.stringify({
      legacyUrl,
      ownerAccountId,
      source: "odyssey-lite-supabase-backfill",
    }),
  );
  const image = await cloudflareRequest("/images/v1", { body, method: "POST" });

  if (!image.id) throw new Error("Images copy did not return an asset ID.");

  return insertMediaAsset({
    delivery_url: `https://imagedelivery.net/${cloudflareImagesHash}/${image.id}/hero`,
    kind: "image",
    legacy_url: legacyUrl,
    metadata: {},
    original_filename: originalFilename,
    owner_account_id: ownerAccountId,
    provider: "cloudflare_images",
    provider_asset_id: image.id,
    status: "ready",
  });
}

async function insertMediaAsset(asset) {
  const [inserted] = await supabaseRequest("/rest/v1/media_assets", {
    body: JSON.stringify(asset),
    headers: { Prefer: "return=representation" },
    method: "POST",
  });
  return inserted;
}

async function linkAssetToPosts(mediaAssetId, references) {
  const uniqueReferences = [
    ...new Map(references.map((reference) => [`${reference.postId}:${reference.position}`, reference])).values(),
  ];

  if (!uniqueReferences.length) return 0;

  await supabaseRequest("/rest/v1/app_post_media?on_conflict=post_id,position", {
    body: JSON.stringify(
      uniqueReferences.map((reference) => ({
        media_asset_id: mediaAssetId,
        position: reference.position,
        post_id: reference.postId,
      })),
    ),
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    method: "POST",
  });
  return uniqueReferences.length;
}

async function waitForStream(assetId) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const video = await cloudflareRequest(`/stream/${encodeURIComponent(assetId)}`, { method: "GET" });

    if (video.status?.state === "error") {
      throw new Error(video.status.errorReasonText || "Cloudflare Stream processing failed.");
    }

    if (video.readyToStream) {
      return video;
    }

    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  throw new Error(`Timed out waiting for Stream asset ${assetId}.`);
}

function streamDeliveryUrl(video) {
  if (!video.uid || !video.preview) throw new Error("Ready Stream video has no playback URL.");
  const url = new URL(video.preview);
  url.pathname = `/${video.uid}/iframe`;
  url.search = "";
  return url.toString();
}

function collectReferences(postRows) {
  const references = new Map();

  for (const post of postRows) {
    const urls = post.media_urls?.length ? post.media_urls : post.image_url ? [post.image_url] : [];

    urls.forEach((url, position) => {
      if (!url) return;
      const current = references.get(url) ?? [];
      current.push({
        accountId: post.account_id,
        kind: post.media_types?.[position],
        position,
        postId: post.id,
      });
      references.set(url, current);
    });
  }

  return references;
}

function inferKind(url, references) {
  if (references.some((reference) => reference.kind === "video")) return "video";
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
  return videoExtensions.has(extension) ? "video" : "image";
}

function isSupabaseStorageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(".supabase.co") && parsed.pathname.includes("/storage/v1/object/");
  } catch {
    return false;
  }
}

async function cloudflareRequest(pathname, init) {
  const response = await fetch(`${cloudflareApiBase}/accounts/${cloudflareAccountId}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cloudflareApiToken}`,
      ...init.headers,
    },
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).filter(Boolean).join("; ") || `Cloudflare HTTP ${response.status}`);
  }

  return payload.result;
}

async function supabaseRequest(pathname, init = {}) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function runPool(items, concurrency, worker) {
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

function loadEnvFile(filename) {
  return Object.fromEntries(
    fs
      .readFileSync(filename, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local.`);
  return value;
}
