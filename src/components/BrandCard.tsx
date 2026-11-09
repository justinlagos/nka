// The client's brand at a glance: logo, colours and typefaces found on their website.
export function BrandCard({
  name,
  logoUrl,
  palette,
  fonts,
  website,
}: {
  name: string;
  logoUrl?: string | null;
  palette: string[];
  fonts: string[];
  website?: string;
}) {
  if (!logoUrl && palette.length === 0 && fonts.length === 0) return null;
  return (
    <div className="brand-card">
      <div className="brand-logo">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${name} logo`} />
        ) : (
          <span>{name.slice(0, 1)}</span>
        )}
      </div>
      <div className="brand-meta">
        <b>{name}</b>
        {website && <span className="small muted">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>}
        {palette.length > 0 && (
          <div className="swatches" aria-label="Brand colours">
            {palette.map((c) => (
              <span key={c} className="swatch" style={{ background: c }} title={c}>
                <span className="skip">{c}</span>
              </span>
            ))}
          </div>
        )}
        {fonts.length > 0 && <span className="small">{fonts.join(", ")}</span>}
      </div>
    </div>
  );
}
