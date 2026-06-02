import { ImageResponse } from "next/og";
import { getOverviewStats } from "@/lib/data";

export const runtime = "nodejs";
export const alt = "slr.audit — citation coverage of technical-debt SLRs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  const stats = getOverviewStats();
  const mean = stats.meanCoveragePct.toFixed(1);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          color: "#f4f4f5",
          padding: "80px",
          fontFamily: "Geist, system-ui, sans-serif",
        }}
      >
        {/* aurora-style glow blob behind everything */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "-150px",
            top: "-150px",
            width: "600px",
            height: "600px",
            borderRadius: "9999px",
            background:
              "radial-gradient(closest-side, rgba(0,255,136,0.35), transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "22px",
            color: "#00ff88",
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "12px",
              height: "12px",
              background: "#00ff88",
              borderRadius: "9999px",
              boxShadow: "0 0 24px #00ff88",
            }}
          />
          <div style={{ display: "flex" }}>Citation coverage audit</div>
        </div>

        {/* hero stat */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: "32px",
            fontSize: "280px",
            fontWeight: 500,
            letterSpacing: "-8px",
            lineHeight: 1,
          }}
        >
          {mean}%
        </div>

        {/* subhead */}
        <div
          style={{
            display: "flex",
            fontSize: "36px",
            color: "#b4b4b4",
            marginTop: "32px",
            maxWidth: "900px",
            lineHeight: 1.3,
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
          }}
        >
          {stats.slrCount} literature reviews cite, on average, {mean}% of the
          most-cited papers in their own subfield.
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: "22px",
            color: "#909090",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "12px",
                height: "12px",
                background: "#00ff88",
                borderRadius: "9999px",
              }}
            />
            <div style={{ display: "flex" }}>slr.audit</div>
          </div>
          <div style={{ display: "flex" }}>
            {stats.slrCount} SLRs · {stats.topCount} canonical papers ·{" "}
            {stats.zeroCoverage} at 0%
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
