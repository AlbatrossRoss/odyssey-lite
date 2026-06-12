import Link from "next/link";
import type { AppBoard } from "@/lib/boards";

type BoardCardProps = {
  board: AppBoard;
  tall?: boolean;
};

export function BoardCard({ board, tall = false }: BoardCardProps) {
  return (
    <article className={`group relative overflow-hidden rounded-[28px] bg-white shadow-soft ${tall ? "row-span-2" : ""}`}>
      <Link className="block" href={`/boards/${board.slug}`}>
        <div className={tall ? "h-64" : "h-40"}>
          <img
            alt={board.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            src={board.coverImageUrl}
          />
        </div>
        <div className="space-y-1 p-4">
          <h2 className="text-lg font-extrabold text-ink">{board.title}</h2>
          <p className="text-sm leading-snug text-ink/62">{board.subtitle}</p>
          <p className="pt-1 text-xs font-black uppercase tracking-[0.14em] text-ink/38">
            {board.postIds.length} {board.postIds.length === 1 ? "post" : "posts"}
          </p>
        </div>
      </Link>
    </article>
  );
}
