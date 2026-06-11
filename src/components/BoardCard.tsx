import Link from "next/link";
import type { Board } from "@/lib/data";

type BoardCardProps = {
  board: Board;
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
        </div>
      </Link>
    </article>
  );
}
