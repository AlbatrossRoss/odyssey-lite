"use client";

import Image from "next/image";

export function LoadingScreen({ className = "", framed = false, progress = 74 }: { className?: string; framed?: boolean; progress?: number }) {
  const minHeightClass = framed ? "min-h-full" : "min-h-[100dvh]";
  const minHeight = framed ? "100%" : "100dvh";
  const progressWidth = `${Math.max(0, Math.min(100, progress))}%`;

  return (
    <main
      className={`relative ${minHeightClass} overflow-hidden bg-[#fbf7ef] text-ink ${className}`}
      style={{
        backgroundColor: "#fbf7ef",
        color: "#18231f",
        minHeight,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_16%_55%,rgba(245,214,157,0.34),transparent_34%),linear-gradient(155deg,#fffdfa_0%,#f9f3e9_48%,#eef1ef_100%)]"
        style={{
          background:
            "radial-gradient(circle at 16% 55%, rgba(245,214,157,0.34), transparent 34%), linear-gradient(155deg, #fffdfa 0%, #f9f3e9 48%, #eef1ef 100%)",
          inset: 0,
          position: "absolute",
        }}
      />
      <section
        className={`relative z-10 flex ${minHeightClass} flex-col items-center px-8 pt-[32vh] text-center`}
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          minHeight,
          paddingLeft: "2rem",
          paddingRight: "2rem",
          paddingTop: "32vh",
          position: "relative",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <div className="flex flex-col items-center" style={{ alignItems: "center", display: "flex", flexDirection: "column" }}>
          <Image
            alt="Odyssey"
            className="h-[158px] w-[158px] rounded-[36px] shadow-lift"
            height={158}
            src="/icon-512.png"
            style={{
              borderRadius: 36,
              boxShadow: "0 12px 28px rgba(24, 35, 31, 0.18)",
              height: 158,
              width: 158,
            }}
            width={158}
            priority
          />
          <p
            className="mt-3 font-serif text-[38px] font-bold tracking-[0.22em] text-[#15345d]"
            style={{
              color: "#15345d",
              fontFamily: "ui-serif, Georgia, Cambria, Times New Roman, Times, serif",
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "0.22em",
              margin: "0.75rem 0 0",
            }}
          >
            ODYSSEY
          </p>
          <p
            className="mt-11 text-[18px] font-medium text-[#15345d]"
            style={{
              color: "#15345d",
              fontSize: 18,
              fontWeight: 500,
              margin: "2.75rem 0 0",
            }}
          >
            Discover places.
          </p>
          <div
            className="mt-11 h-[5px] w-[282px] max-w-[72vw] overflow-hidden rounded-full bg-[#e5e2dd]"
            style={{
              backgroundColor: "#e5e2dd",
              borderRadius: 999,
              height: 5,
              marginTop: "2.75rem",
              maxWidth: "72vw",
              overflow: "hidden",
              width: 282,
            }}
          >
            <div
              className="h-full rounded-full bg-[#0c3b66] transition-[width] duration-500 ease-out"
              style={{ backgroundColor: "#0c3b66", borderRadius: 999, height: "100%", width: progressWidth }}
            />
          </div>
          <p
            className="mt-8 text-[16px] font-medium text-[#9fb0c2]"
            style={{
              color: "#9fb0c2",
              fontSize: 16,
              fontWeight: 500,
              margin: "2rem 0 0",
            }}
          >
            Loading...
          </p>
        </div>
      </section>
    </main>
  );
}
