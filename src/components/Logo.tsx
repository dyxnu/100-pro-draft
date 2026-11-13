export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <span className={`font-extrabold tracking-[0.08em] text-gold2 ${size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-lg'}`}>
      NEXUS<span className="ml-1.5 font-normal text-gold">DRAFT</span>
    </span>
  );
}
