import { trips, users } from "@/lib/data";

export function HomeFeed() {
  return (
    <section className="nav-cleared-bottom absolute inset-x-0 z-30 rounded-t-[34px] bg-shell/98 px-4 pb-5 pt-3 shadow-[0_-18px_40px_rgba(24,35,31,0.18)] backdrop-blur-xl">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/18" />
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Friend signal</p>
          <h2 className="text-xl font-extrabold text-ink">Recent trips</h2>
        </div>
        <p className="text-xs font-bold text-moss">12 new saves</p>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {trips.map((trip) => {
          const user = users.find((item) => item.id === trip.userId);

          return (
            <article className="w-56 shrink-0 overflow-hidden rounded-[26px] bg-white shadow-soft" key={trip.id}>
              <img alt="" className="h-32 w-full object-cover" src={trip.coverImageUrl} />
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <img alt="" className="h-7 w-7 rounded-full object-cover" src={user?.avatarUrl} />
                  <p className="text-sm font-bold text-ink">{user?.name}</p>
                </div>
                <div>
                  <h3 className="text-base font-extrabold leading-tight text-ink">{trip.title}</h3>
                  <p className="text-xs font-semibold text-ink/52">
                    {trip.destination} · {trip.date}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
