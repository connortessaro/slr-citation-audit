/**
 * CSS-only aurora. Single accent + one cool charcoal blob for depth.
 * Avoids the rainbow-aurora look. Pure radial gradient plus blur, no JS.
 */
export function CssAurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Single accent blob, top-left */}
      <div
        className="absolute -left-32 -top-40 h-[640px] w-[640px] rounded-full opacity-80"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,255,136,0.32), transparent 70%)",
          filter: "blur(90px)",
        }}
      />
      {/* Desaturated highlight, lower-right, for depth (no second hue) */}
      <div
        className="absolute bottom-0 right-[8%] h-[440px] w-[440px] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,255,255,0.06), transparent 70%)",
          filter: "blur(70px)",
        }}
      />
      {/* Subtle film grain */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/></svg>\")",
        }}
      />
    </div>
  );
}
