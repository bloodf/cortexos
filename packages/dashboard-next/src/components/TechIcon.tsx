import { BRAND_COLORS } from "@/mocks/seed";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  name: string;
  size?: number;
  className?: string;
}

function mix(hex: string): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 0.7;
  const m = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * f)))
      .toString(16)
      .padStart(2, "0");
  return `#${m(r)}${m(g)}${m(b)}`;
}

export function TechIcon({ slug, name, size = 32, className }: Props) {
  const color = BRAND_COLORS[slug] ?? "oklch(0.55 0.18 277)";
  const monogram = name.slice(0, 2).toUpperCase();
  // simple deterministic gradient end
  const c2 = mix(color);
  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "flex items-center justify-center rounded-md font-semibold text-white shadow-sm shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: `linear-gradient(135deg, ${color}, ${c2})`,
      }}
    >
      {monogram}
    </div>
  );
}
