export type MapboxSearchSuggestion = {
  category?: string;
  description?: string;
  label: string;
  mapboxId: string;
};

export type MapboxSearchResult = MapboxSearchSuggestion & {
  center: [number, number];
  query: string;
  zoom: number;
};

type MapboxContext = {
  country?: { name?: string };
  locality?: { name?: string };
  place?: { name?: string };
  region?: { name?: string };
};

type MapboxProperties = {
  context?: MapboxContext;
  feature_type?: string;
  full_address?: string;
  mapbox_id?: string;
  name?: string;
  place_formatted?: string;
  poi_category?: string[];
};

type MapboxFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: MapboxProperties;
};

const searchTypes = "poi,address,neighborhood,locality,place,region,country";

export function createMapboxSearchSessionToken() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function suggestMapboxPlaces({
  query,
  sessionToken,
  proximity,
  signal,
}: {
  query: string;
  sessionToken: string;
  proximity?: [number, number] | null;
  signal?: AbortSignal;
}): Promise<MapboxSearchSuggestion[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token || query.trim().length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    limit: "8",
    q: query.trim(),
    session_token: sessionToken,
    types: searchTypes,
  });

  if (proximity) {
    params.set("proximity", proximity.join(","));
  }

  params.set("mode", "suggest");
  params.delete("access_token");
  const response = await fetch(`/api/places/search?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Mapbox place search failed (${response.status}).`);
  }

  const data = (await response.json()) as {
    suggestions?: Array<{
      feature_type?: string;
      full_address?: string;
      mapbox_id?: string;
      name?: string;
      place_formatted?: string;
      poi_category?: string[];
    }>;
  };

  return (data.suggestions ?? []).flatMap((suggestion) => {
    if (!suggestion.mapbox_id || !suggestion.name) {
      return [];
    }

    return [{
      category: suggestion.poi_category?.[0],
      description: suggestion.full_address ?? suggestion.place_formatted,
      label: suggestion.name,
      mapboxId: suggestion.mapbox_id,
    }];
  });
}

export async function retrieveMapboxPlace(
  mapboxId: string,
  sessionToken: string,
  proximity?: [number, number] | null,
): Promise<MapboxSearchResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return null;
  }

  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    session_token: sessionToken,
  });

  if (proximity) {
    params.set("proximity", proximity.join(","));
  }

  params.set("mapbox_id", mapboxId);
  params.set("mode", "retrieve");
  params.delete("access_token");
  const response = await fetch(`/api/places/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Mapbox place retrieval failed (${response.status}).`);
  }

  const data = (await response.json()) as { features?: MapboxFeature[] };
  return resultFromFeature(data.features?.[0]);
}

export async function forwardSearchMapboxPlace(
  query: string,
  proximity?: [number, number] | null,
): Promise<MapboxSearchResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token || !query.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    limit: "1",
    q: query.trim(),
    types: searchTypes,
  });

  if (proximity) {
    params.set("proximity", proximity.join(","));
  }

  params.set("mode", "forward");
  params.delete("access_token");
  const response = await fetch(`/api/places/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Mapbox place search failed (${response.status}).`);
  }

  const data = (await response.json()) as { features?: MapboxFeature[] };
  return resultFromFeature(data.features?.[0]);
}

function resultFromFeature(feature?: MapboxFeature): MapboxSearchResult | null {
  const properties = feature?.properties;
  const center = feature?.geometry?.coordinates;

  if (!properties?.mapbox_id || !properties.name || !center) {
    return null;
  }

  const description = properties.full_address ?? properties.place_formatted ?? contextDescription(properties.context);
  const featureType = properties.feature_type;

  return {
    category: properties.poi_category?.[0],
    center,
    description,
    label: properties.name,
    mapboxId: properties.mapbox_id,
    query: properties.full_address ?? [properties.name, properties.place_formatted].filter(Boolean).join(", "),
    zoom: featureType === "country" ? 4 : featureType === "region" ? 6 : featureType === "place" ? 9 : 14.5,
  };
}

function contextDescription(context?: MapboxContext) {
  return [
    context?.locality?.name ?? context?.place?.name,
    context?.region?.name,
    context?.country?.name,
  ].filter(Boolean).join(", ");
}
