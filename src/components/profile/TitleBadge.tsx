// Título do jogador sob o nome. "Alpha Tester" (title:alpha) tem brilho animado.
export function TitleBadge({ id, name, empty }: { id: string | null; name: string | null; empty?: string }) {
  if (!id || !name) return empty ? <span className="pf-title pf-title--empty">{empty}</span> : null;
  return <span className={`pf-title cos-title cos-title-${id.replace('title:', '')}`}>{name}</span>;
}
