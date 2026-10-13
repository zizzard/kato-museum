import type { Craft } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const pct = (value: number) => `${(Math.min(Math.max(value, 0), 1) * 100).toFixed(2)}%`;

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface CraftCardProps {
  craft: Craft;
  teamLabel: string;
  stickerImages: Record<string, string | null>;
}

export default function CraftCard({ craft, teamLabel, stickerImages }: CraftCardProps) {
  const titleStyle = craft.color ? { color: craft.color } : undefined;
  const restricted = craft.minFloat > 0 || craft.maxFloat < 1;
  const rows = [
    { label: "Paint seed", value: craft.seed ?? "—" },
    ...(craft.value != null ? [{ label: "Sticker value", value: usd.format(craft.value) }] : []),
    ...(craft.updated ? [{ label: "Last updated", value: formatDate(craft.updated) }] : []),
  ];

  return (
    <article className="card">
      <div className="card-strip">
        <span className="card-team">{teamLabel}</span>
        {craft.rank != null ? <span>Rank #{craft.rank}</span> : null}
      </div>

      <div className="card-title-block">
        <div className="card-title" style={titleStyle} title={craft.title}>
          {craft.title}
        </div>
        <div className="card-subtitle">
          {craft.statTrak ? <span className="stattrak">StatTrak | </span> : null}
          {craft.wear ?? "—"}
        </div>
      </div>

      <div className="card-image">
        {craft.image ? <img src={craft.image} alt={craft.title} loading="lazy" /> : null}
      </div>

      <div
        className="fbar-row"
        title={restricted ? `Float range ${craft.minFloat.toFixed(2)} – ${craft.maxFloat.toFixed(2)}` : undefined}
      >
        <div className="fbar" aria-hidden="true">
          {craft.minFloat > 0 ? (
            <span className="fbar-mask fbar-mask--left" style={{ width: pct(craft.minFloat) }} />
          ) : null}
          {craft.maxFloat < 1 ? (
            <span className="fbar-mask fbar-mask--right" style={{ width: pct(1 - craft.maxFloat) }} />
          ) : null}
          {craft.float != null ? <span className="fbar-mark" style={{ left: pct(craft.float) }} /> : null}
        </div>
        <span className="fbar-value">{craft.float != null ? craft.float.toFixed(8) : "—"}</span>
      </div>

      <div className="card-body">
        <dl className="meta">
          {rows.map((row) => (
            <div key={row.label} className="meta-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        {craft.stickers.length > 0 ? (
          <div className="sockets" aria-label="Stickers">
            {craft.stickers.map((sticker, index) => {
              const image = stickerImages[sticker.label];
              return (
                <div key={index} className="socket" title={`Slot ${sticker.slot}: ${sticker.label}`}>
                  <span className="socket-frame">
                    {image ? <img src={image} alt={sticker.label} loading="lazy" /> : null}
                    <span className="socket-slot">{sticker.slot}</span>
                  </span>
                  <span className="socket-wear">
                    {Math.round(Math.min(Math.max(1 - sticker.wear, 0), 1) * 100)}%
                  </span>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, 5 - craft.stickers.length) }, (_, index) => (
              <div key={`empty-${index}`} className="socket socket--empty" aria-hidden="true">
                <span className="socket-frame" />
                <span className="socket-wear">–</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
