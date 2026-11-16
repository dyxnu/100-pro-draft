/** Marca do 100 pro Draft: Diana no crescente. */
export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`relative inline-grid place-items-center overflow-hidden rounded-full ring-2 ring-gold/70 ${lg ? 'h-14 w-14' : 'h-9 w-9'}`}>
        <img src="/icon.png" alt="" className="h-full w-full object-cover" />
      </span>
      <span className={`font-black tracking-tight text-gold2 ${lg ? 'text-4xl' : 'text-xl'}`}>
        100 <span className="text-accent2">pro</span> Draft
      </span>
    </span>
  );
}
