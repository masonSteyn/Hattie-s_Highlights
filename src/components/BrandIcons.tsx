/**
 * lucide-react v1 dropped its brand glyphs, so Instagram and Facebook are drawn
 * here on Lucide's own 24×24 grid with the same stroke conventions (round caps
 * and joins, no fill). They take `size` and `strokeWidth` like any Lucide icon,
 * which keeps the whole set at one visual weight.
 */

type IconProps = {
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
};

const base = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function Instagram({ size = 24, strokeWidth = 1.25, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} {...rest}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function Facebook({ size = 24, strokeWidth = 1.25, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} {...rest}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
