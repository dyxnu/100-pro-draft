export function AuthCard({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-10 w-full max-w-md sm:mt-16">
      <div className="panel p-6 shadow-2xl shadow-black/40 sm:p-8">
        <h1 className="text-2xl font-bold text-gold2">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
