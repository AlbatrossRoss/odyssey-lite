type MobileFrameProps = {
  children: React.ReactNode;
  className?: string;
};

export function MobileFrame({ children, className = "" }: MobileFrameProps) {
  return (
    <main className="app-viewport w-full px-0 py-0 text-ink sm:flex sm:items-center sm:justify-center sm:p-6">
      <div
        className={`app-viewport w-full bg-shell shadow-soft sm:h-[852px] sm:min-h-0 sm:max-h-[calc(100vh-48px)] sm:w-[393px] sm:rounded-[34px] sm:ring-8 sm:ring-white/55 ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
