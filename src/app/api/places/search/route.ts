import { NextRequest, NextResponse } from "next/server";

const mapboxSearchBaseUrl = "https://api.mapbox.com/search/searchbox/v1";

export async function GET(request: NextRequest) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return NextResponse.json({ message: "Mapbox is not configured." }, { status: 503 });
  }

  const incoming = request.nextUrl.searchParams;
  const mode = incoming.get("mode");
  const mapboxId = incoming.get("mapbox_id");
  const params = new URLSearchParams();

  for (const key of ["q", "language", "limit", "session_token", "types", "proximity"]) {
    const value = incoming.get(key);
    if (value) {
      params.set(key, value);
    }
  }

  params.set("access_token", token);

  let endpoint: string;
  if (mode === "retrieve" && mapboxId) {
    endpoint = `${mapboxSearchBaseUrl}/retrieve/${encodeURIComponent(mapboxId)}`;
  } else if (mode === "forward") {
    endpoint = `${mapboxSearchBaseUrl}/forward`;
  } else if (mode === "suggest") {
    endpoint = `${mapboxSearchBaseUrl}/suggest`;
  } else {
    return NextResponse.json({ message: "Invalid place-search request." }, { status: 400 });
  }

  try {
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ message: "Place search is temporarily unavailable." }, { status: 502 });
  }
}
