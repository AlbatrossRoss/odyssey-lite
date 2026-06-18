"use client";

import dynamic from "next/dynamic";
import type { MapboxMapProps } from "@/components/MapboxMap";

const DynamicMapboxMapComponent = dynamic(
  () => import("@/components/MapboxMap").then((module) => module.MapboxMap),
  {
    loading: () => <div className="h-full w-full bg-[#a9d7ed]" />,
    ssr: false,
  },
);

export function DynamicMapboxMap(props: MapboxMapProps) {
  return <DynamicMapboxMapComponent {...props} />;
}
