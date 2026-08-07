export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact?'brand-compact':''}`}><img src="/yvie-logo.svg" alt="YVIE"/><div><strong>YVIE</strong>{!compact && <span>GESTÃO</span>}</div></div>;
}
