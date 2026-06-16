"use client";

import Image from "next/image";

export function LoadingScreen() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-shell px-5 text-ink">
      <section className="flex w-full max-w-[393px] flex-col items-center rounded-[34px] bg-white px-8 py-12 text-center shadow-soft">
        <Image alt="Odyssey Lite" className="h-20 w-20 rounded-[22px] shadow-lift" height={80} src="/icon-192.png" width={80} priority />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-coral">Odyssey Lite</p>
        <h1 className="mt-2 text-2xl font-black text-ink">Loading your map</h1>
        <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-shell">
          <div className="h-full w-2/5 rounded-full bg-coral motion-safe:animate-[odyssey-loading_1.2s_ease-in-out_infinite]" />
        </div>
      </section>
    </main>
  );
}
