import { GitCommitHorizontal } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { versionHistory } from "@/lib/versionHistory";

export default function VersionsPage() {
  return (
    <MobileFrame>
      <section className="relative h-full bg-shell">
        <div className="safe-page h-full overflow-y-auto px-5">
          <header className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Version history</p>
            <h1 className="mt-1 text-3xl font-black leading-tight text-ink">What changed</h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/54">
              A quick visible log for testing whether the latest Odyssey Lite deploy has reached your phone.
            </p>
          </header>

          <div className="space-y-3">
            {versionHistory.map((entry, index) => (
              <article className="relative overflow-hidden rounded-[26px] bg-white p-4 shadow-soft" key={entry.id}>
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white">
                    <GitCommitHorizontal aria-hidden="true" size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-coral">{entry.id}</p>
                      {index === 0 ? (
                        <span className="rounded-full bg-moss/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-moss">
                          Latest
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1 text-lg font-black leading-tight text-ink">{entry.title}</h2>
                    <p className="mt-1 text-xs font-bold text-ink/42">{entry.date}</p>
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-ink/58">{entry.summary}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <BottomNav activeTab="Versions" />
      </section>
    </MobileFrame>
  );
}
