type MobileFrameProps = {
  children: React.ReactNode;
  className?: string;
};

export function MobileFrame({ children, className = "" }: MobileFrameProps) {
  return (
    <main className="mobile-frame">
      <div className={`mobile-frame-inner ${className}`}>
        {children}
      </div>
    </main>
  );
}
