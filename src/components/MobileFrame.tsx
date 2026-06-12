type MobileFrameProps = {
  children: React.ReactNode;
  className?: string;
};

export function MobileFrame({ children, className = "" }: MobileFrameProps) {
  return (
    <main className="fixed inset-0 h-screen min-h-screen w-full overflow-hidden bg-white px-0 py-0 text-ink sm:flex sm:items-center sm:justify-center sm:bg-transparent sm:p-6">
      <div
        className={`absolute inset-0 h-screen min-h-screen overflow-hidden bg-shell shadow-soft sm:relative sm:h-[852px] sm:min-h-0 sm:max-h-[calc(100vh-48px)] sm:w-[393px] sm:rounded-[34px] sm:ring-8 sm:ring-white/55 ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
