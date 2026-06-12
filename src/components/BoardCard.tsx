import Link from "next/link";
import type { AppBoard } from "@/lib/boards";

type BoardCardProps = {
  board: AppBoard;
  tall?: boolean;
};

export function BoardCard({ board, tall = false }: BoardCardProps) {
  const previewImages = [board.previewImageUrls[0] ?? board.coverImageUrl, board.previewImageUrls[1], board.previewImageUrls[2]].filter(
    (imageUrl): imageUrl is string => Boolean(imageUrl),
  );

  return (
    <article className={`group relative overflow-hidden rounded-[28px] bg-white shadow-soft ${tall ? "row-span-2" : ""}`}>
      <Link className="block" href={`/boards/${board.slug}`}>
        <div className={tall ? "h-64" : "h-40"}>
          <BoardPreview images={previewImages} title={board.title} />
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

function BoardPreview({ images, title }: { images: string[]; title: string }) {
  if (images.length <= 1) {
    return (
      <img
        alt={title}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        src={images[0] ?? "/hawaii-reference-map.png"}
      />
    );
  }

  return (
    <div className="grid h-full grid-cols-[1.25fr_0.85fr] gap-1 bg-white">
      <img alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={images[0]} />
      <div className="grid h-full grid-rows-2 gap-1">
        <img alt="" className="h-full min-h-0 w-full object-cover transition duration-500 group-hover:scale-105" src={images[1] ?? images[0]} />
        <img alt="" className="h-full min-h-0 w-full object-cover transition duration-500 group-hover:scale-105" src={images[2] ?? images[0]} />
      </div>
    </div>
  );
}
