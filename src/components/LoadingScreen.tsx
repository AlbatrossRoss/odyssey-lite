"use client";

import Image from "next/image";

export function LoadingScreen() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#fbf7ef] text-ink">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_55%,rgba(245,214,157,0.34),transparent_34%),linear-gradient(155deg,#fffdfa_0%,#f9f3e9_48%,#eef1ef_100%)]" />
      <section className="relative z-10 flex min-h-[100dvh] flex-col items-center px-8 pt-[32vh] text-center">
        <div className="flex flex-col items-center">
          <Image alt="Odyssey" className="h-[158px] w-[158px] rounded-[36px] shadow-lift" height={158} src="/icon-512.png" width={158} priority />
          <p className="mt-3 font-serif text-[38px] font-bold tracking-[0.22em] text-[#15345d]">ODYSSEY</p>
          <p className="mt-11 text-[18px] font-medium text-[#15345d]">Discover places.</p>
          <div className="mt-11 h-[5px] w-[282px] max-w-[72vw] overflow-hidden rounded-full bg-[#e5e2dd]">
            <div className="h-full w-[74%] rounded-full bg-[#0c3b66]" />
          </div>
          <p className="mt-8 text-[16px] font-medium text-[#9fb0c2]">Loading...</p>
        </div>
      </section>
    </main>
  );
}
