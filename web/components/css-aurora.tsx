/**
 * CSS-only aurora — replaces the R3F shader which silently fails in some
 * envs (Playwright headless, locked-down WebGL, etc). Pure conic-gradient +
 * blur, runs everywhere, ~free perf cost.
 */
export function CssAurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Big blurred green blob, top-left */}
      <div
        className="absolute -left-32 -top-40 h-[600px] w-[600px] rounded-full opacity-80"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,255,136,0.35), rgba(0,255,136,0) 70%)",
          filter: "blur(80px)",
        }}
      />
      {/* Smaller teal blob, right-of-center */}
      <div
        className="absolute right-[10%] top-[20%] h-[420px] w-[420px] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, rgba(20,184,166,0.25), rgba(20,184,166,0) 70%)",
          filter: "blur(60px)",
        }}
      />
      {/* Cool blue accent, bottom-left */}
      <div
        className="absolute -left-10 bottom-0 h-[500px] w-[500px] rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(closest-side, rgba(59,130,246,0.18), rgba(59,130,246,0) 70%)",
          filter: "blur(70px)",
        }}
      />
      {/* Subtle film grain */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/></svg>\")",
        }}
      />
    </div>
  );
}
