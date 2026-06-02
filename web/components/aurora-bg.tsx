"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Animated aurora: layered simplex-like noise → green/teal gradient drift.
// Vivid #00ff88 accent, transparent fade to bg at edges.
const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;

  // Hash + value noise (cheap, GPU-friendly)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float t = uTime * 0.04;
    float n1 = fbm(p * 1.6 + vec2(t, t * 0.7));
    float n2 = fbm(p * 2.8 + vec2(-t * 0.5, t * 0.3));
    float band = smoothstep(0.45, 0.85, n1 * 0.7 + n2 * 0.5);

    vec3 accent = vec3(0.0, 1.0, 0.533);  // #00ff88
    vec3 teal   = vec3(0.0, 0.6,  0.6);
    vec3 col    = mix(teal, accent, band);

    // Vertical falloff so aurora sits near top, bg blends below
    float verticalFade = smoothstep(0.0, 0.6, uv.y);
    float edgeFade = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x);

    float alpha = band * verticalFade * edgeFade * 0.75;
    gl_FragColor = vec4(col, alpha);
  }
`;

function AuroraMaterial({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!ref.current) return;
    const size = state.size;
    uniforms.uRes.value.set(size.width, size.height);
    if (!reduced) uniforms.uTime.value += delta;
  });

  return (
    <shaderMaterial
      ref={ref}
      vertexShader={VERT}
      fragmentShader={FRAG}
      uniforms={uniforms}
      transparent
      depthWrite={false}
    />
  );
}

export function AuroraBg({ className = "" }: { className?: string }) {
  // SSR-safe reduced-motion check happens client-side in <Canvas>
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 ${className}`}
      aria-hidden
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], near: 0, far: 2, zoom: 1 }}
        gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        frameloop={reduced ? "demand" : "always"}
      >
        <mesh>
          <planeGeometry args={[2, 2]} />
          <AuroraMaterial reduced={reduced} />
        </mesh>
      </Canvas>
    </div>
  );
}
