'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import './MagicRings.css';

function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (Number.isNaN(num) || cleaned.length < 6) return [168, 85, 247];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const DEFAULT_PROPS: Required<MagicRingsProps> = {
  color: '#fc42ff',
  colorTwo: '#42fcff',
  speed: 1,
  ringCount: 6,
  attenuation: 10,
  lineThickness: 2,
  baseRadius: 0.35,
  radiusStep: 0.1,
  scaleRate: 0.1,
  opacity: 1,
  blur: 0,
  noiseAmount: 0.1,
  rotation: 0,
  ringGap: 1.5,
  fadeIn: 0.7,
  fadeOut: 0.5,
  followMouse: false,
  mouseInfluence: 0.2,
  hoverScale: 1.2,
  parallax: 0.05,
  clickBurst: false,
  alphaMode: 'luminance',
};

// Canvas-2D fallback used on devices without WebGL2. Draws the same expanding,
// fading rings so pinned tracks keep their animated glow on every phone.
function startCanvasFallback(
  mount: HTMLDivElement,
  propsRef: React.MutableRefObject<Required<MagicRingsProps> | null>,
) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  mount.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    mount.removeChild(canvas);
    return () => {};
  }

  const size = { w: 0, h: 0 };
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = Math.max(1, Math.round(mount.clientWidth));
    size.h = Math.max(1, Math.round(mount.clientHeight));
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  const ro = new ResizeObserver(resize);
  ro.observe(mount);

  let frameId = 0;
  let isVisible = false;
  let isPageVisible = !document.hidden;
  let elapsed = 0;
  let lastT = 0;

  const CYCLE = 3.45;

  const drawRing = (
    cx: number,
    cy: number,
    radius: number,
    width: number,
    t0: number,
    color: string,
    alpha: number,
    px: number,
  ) => {
    const t = (elapsed + t0) % CYCLE;
    const lifeProgress = t / CYCLE;
    const p = propsRef.current || DEFAULT_PROPS;
    const r = radius + lifeProgress * p.scaleRate;
    const fadeIn = 0.7;
    const fadeOut = 0.5;
    const fade = lifeProgress < fadeIn ? lifeProgress / fadeIn : 1 - Math.max(0, (lifeProgress - fadeOut) / (CYCLE - fadeOut - 0.2));
    if (fade <= 0.01) return;

    const gapEnd = 1 - (width * 1.5) / Math.max(cx + cy, 1);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.1, r * Math.min(cx, cy)), 0, Math.PI * 2 * gapEnd);
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.max(0, Math.min(1, fade * alpha * p.opacity));
    ctx.lineWidth = Math.max(1, width * px * p.lineThickness);
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const animate = (t: number) => {
    frameId = requestAnimationFrame(animate);
    const p = propsRef.current || DEFAULT_PROPS;

    const dt = lastT === 0 ? 0 : Math.min(t - lastT, 100);
    lastT = t;
    elapsed += dt * 0.001 * p.speed;

    ctx.clearRect(0, 0, size.w, size.h);
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size.w / 2;
    const cy = size.h / 2;
    const px = 1 / Math.min(size.w, size.h);
    const baseRadius = p.baseRadius;
    const radiusStep = p.radiusStep;
    const ringGap = p.ringGap;
    const rcf = Math.max(p.ringCount - 1, 1);
    const [r1, g1, b1] = hexToRgb(p.color);
    const [r2, g2, b2] = hexToRgb(p.colorTwo);
    const noiseAmount = p.noiseAmount;

    for (let i = 0; i < p.ringCount; i++) {
      const fi = i;
      const mr = mix(r1, r2, fi / rcf);
      const mg = mix(g1, g2, fi / rcf);
      const mb = mix(b1, b2, fi / rcf);
      const cutoff = Math.pow(ringGap, fi);
      const radius = baseRadius + fi * radiusStep;
      const ringAlpha = Math.pow(cutoff, 2) * 1.5;
      drawRing(cx, cy, radius * 0.9, cutoff * 0.12 + 0.35, i === 0 ? 0 : 2.95 * fi, `rgb(${mr | 0},${mg | 0},${mb | 0})`, Math.min(1, ringAlpha), px);
    }

    if (noiseAmount > 0.01) {
      ctx.globalAlpha = Math.min(1, noiseAmount);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(0, 0, size.w, size.h);
    }
    ctx.globalAlpha = 1;
  };

  const tryStart = () => {
    if (isVisible && isPageVisible && frameId === 0) {
      lastT = 0;
      frameId = requestAnimationFrame(animate);
    }
  };
  const tryStop = () => {
    if (frameId !== 0) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        tryStart();
      } else {
        tryStop();
      }
    },
    { threshold: 0 },
  );
  io.observe(mount);

  const onVisibility = () => {
    isPageVisible = !document.hidden;
    if (isPageVisible) {
      tryStart();
    } else {
      tryStop();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  tryStart();

  return () => {
    tryStop();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    ro.disconnect();
    mount.removeChild(canvas);
  };
}

const vertexShader = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform float uMouseInfluence, uHoverAmount, uHoverScale, uParallax, uBurst;
uniform float uCoverageAlpha;
uniform vec2 uResolution, uMouse;
uniform vec3 uColor, uColorTwo;
uniform int uRingCount;

const float HP = 1.5707963;
const float CYCLE = 3.45;

float fade(float t) {
  return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * uScaleRate;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * uLineThickness;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}

void main() {
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  float cr = cos(uRotation), sr = sin(uRotation);
  p = mat2(cr, -sr, sr, cr) * p;
  p -= uMouse * uMouseInfluence;
  float sc = mix(1.0, uHoverScale, uHoverAmount) + uBurst * 0.3;
  p /= sc;
  vec3 c = vec3(0.0);
  float coverage = 0.0;
  float rcf = max(float(uRingCount) - 1.0, 1.0);
  for (int i = 0; i < 10; i++) {
    if (i >= uRingCount) break;
    float fi = float(i);
    vec2 pr = p - fi * uParallax * uMouse;
    vec3 rc = mix(uColor, uColorTwo, fi / rcf);
    float ringAmount = ring(pr, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 2.95 * fi, px);
    c = mix(c, rc, vec3(ringAmount));
    coverage = max(coverage, ringAmount);
  }
  c *= 1.0 + uBurst * 2.0;
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;
  float intensity = max(c.r, max(c.g, c.b));
  vec3 emissiveColor = intensity > 0.0001 ? clamp(c / intensity, 0.0, 1.0) : vec3(0.0);
  vec3 outputColor = mix(emissiveColor, clamp(c, 0.0, 1.0), uCoverageAlpha);
  float outputAlpha = mix(intensity, coverage, uCoverageAlpha);
  gl_FragColor = vec4(outputColor, clamp(outputAlpha * uOpacity, 0.0, 1.0));
}
`;

interface MagicRingsProps {
  color?: string;
  colorTwo?: string;
  speed?: number;
  ringCount?: number;
  attenuation?: number;
  lineThickness?: number;
  baseRadius?: number;
  radiusStep?: number;
  scaleRate?: number;
  opacity?: number;
  blur?: number;
  noiseAmount?: number;
  rotation?: number;
  ringGap?: number;
  fadeIn?: number;
  fadeOut?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  hoverScale?: number;
  parallax?: number;
  clickBurst?: boolean;
  alphaMode?: 'luminance' | 'coverage';
}

export default function MagicRings({
  color = '#fc42ff',
  colorTwo = '#42fcff',
  speed = 1,
  ringCount = 6,
  attenuation = 10,
  lineThickness = 2,
  baseRadius = 0.35,
  radiusStep = 0.1,
  scaleRate = 0.1,
  opacity = 1,
  blur = 0,
  noiseAmount = 0.1,
  rotation = 0,
  ringGap = 1.5,
  fadeIn = 0.7,
  fadeOut = 0.5,
  followMouse = false,
  mouseInfluence = 0.2,
  hoverScale = 1.2,
  parallax = 0.05,
  clickBurst = false,
  alphaMode = 'luminance',
}: MagicRingsProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef<Required<MagicRingsProps> | null>(null);
  const mouseRef = useRef([0, 0]);
  const smoothMouseRef = useRef([0, 0]);
  const hoverAmountRef = useRef(0);
  const isHoveredRef = useRef(false);
  const burstRef = useRef(0);

  useEffect(() => {
    propsRef.current = {
      color, colorTwo, speed, ringCount, attenuation, lineThickness,
      baseRadius, radiusStep, scaleRate, opacity, blur, noiseAmount,
      rotation, ringGap, fadeIn, fadeOut, followMouse, mouseInfluence,
      hoverScale, parallax, clickBurst, alphaMode,
    };
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true });
    } catch {
      return startCanvasFallback(mount, propsRef);
    }

    // WebGL2 is required by the shader's GLSL (uniform int loops). Phones that
    // only support WebGL1 fall back to the 2D canvas renderer instead. Note:
    // renderer.capabilities.isWebGL2 is hardcoded to true in three >= r163, so
    // probe the actual context object.
    const gl = renderer.getContext();
    const isWebGL2 =
      typeof WebGL2RenderingContext !== 'undefined' &&
      gl instanceof WebGL2RenderingContext;

    if (!isWebGL2) {
      renderer.dispose();
      return startCanvasFallback(mount, propsRef);
    }

    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 1;

    const uniforms = {
      uTime: { value: 0 },
      uAttenuation: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Color() },
      uColorTwo: { value: new THREE.Color() },
      uLineThickness: { value: 0 },
      uBaseRadius: { value: 0 },
      uRadiusStep: { value: 0 },
      uScaleRate: { value: 0 },
      uRingCount: { value: 0 },
      uOpacity: { value: 1 },
      uNoiseAmount: { value: 0 },
      uRotation: { value: 0 },
      uRingGap: { value: 1.6 },
      uFadeIn: { value: 0.5 },
      uFadeOut: { value: 0.75 },
      uMouse: { value: new THREE.Vector2() },
      uMouseInfluence: { value: 0 },
      uHoverAmount: { value: 0 },
      uHoverScale: { value: 1 },
      uParallax: { value: 0 },
      uBurst: { value: 0 },
      uCoverageAlpha: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(quad);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      renderer.setSize(w, h);
      renderer.setPixelRatio(dpr);
      uniforms.uResolution.value.set(w * dpr, h * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const onMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouseRef.current[0] = (e.clientX - rect.left) / rect.width - 0.5;
      mouseRef.current[1] = -((e.clientY - rect.top) / rect.height - 0.5);
    };
    const onMouseEnter = () => { isHoveredRef.current = true; };
    const onMouseLeave = () => {
      isHoveredRef.current = false;
      mouseRef.current[0] = 0;
      mouseRef.current[1] = 0;
    };
    const onClick = () => { burstRef.current = 1; };

    mount.addEventListener('mousemove', onMouseMove);
    mount.addEventListener('mouseenter', onMouseEnter);
    mount.addEventListener('mouseleave', onMouseLeave);
    mount.addEventListener('click', onClick);

    let frameId = 0;
    let isVisible = false;
    let isPageVisible = !document.hidden;
    let elapsed = 0;
    let lastT = 0;
    let fallbackActive = false;
    let fallbackCleanup: () => void = () => {};

    const switchToFallback = () => {
      if (fallbackActive) return;
      fallbackActive = true;
      tryStop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      mount.removeEventListener('mousemove', onMouseMove);
      mount.removeEventListener('mouseenter', onMouseEnter);
      mount.removeEventListener('mouseleave', onMouseLeave);
      mount.removeEventListener('click', onClick);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      material.dispose();
      fallbackCleanup = startCanvasFallback(mount, propsRef);
    };

    const animate = (t: number) => {
      frameId = requestAnimationFrame(animate);
      const p = propsRef.current!;

      const dt = lastT === 0 ? 0 : Math.min(t - lastT, 100);
      lastT = t;
      elapsed += dt * 0.001 * p.speed;

      smoothMouseRef.current[0] += (mouseRef.current[0] - smoothMouseRef.current[0]) * 0.08;
      smoothMouseRef.current[1] += (mouseRef.current[1] - smoothMouseRef.current[1]) * 0.08;
      hoverAmountRef.current += ((isHoveredRef.current ? 1 : 0) - hoverAmountRef.current) * 0.08;
      burstRef.current *= 0.95;
      if (burstRef.current < 0.001) burstRef.current = 0;

      uniforms.uTime.value = elapsed;
      uniforms.uAttenuation.value = p.attenuation;
      uniforms.uColor.value.set(p.color);
      uniforms.uColorTwo.value.set(p.colorTwo);
      uniforms.uLineThickness.value = p.lineThickness;
      uniforms.uBaseRadius.value = p.baseRadius;
      uniforms.uRadiusStep.value = p.radiusStep;
      uniforms.uScaleRate.value = p.scaleRate;
      uniforms.uRingCount.value = p.ringCount;
      uniforms.uOpacity.value = p.opacity;
      uniforms.uNoiseAmount.value = p.noiseAmount;
      uniforms.uRotation.value = (p.rotation * Math.PI) / 180;
      uniforms.uRingGap.value = p.ringGap;
      uniforms.uFadeIn.value = p.fadeIn;
      uniforms.uFadeOut.value = p.fadeOut;
      uniforms.uMouse.value.set(smoothMouseRef.current[0], smoothMouseRef.current[1]);
      uniforms.uMouseInfluence.value = p.followMouse ? p.mouseInfluence : 0;
      uniforms.uHoverAmount.value = hoverAmountRef.current;
      uniforms.uHoverScale.value = p.hoverScale;
      uniforms.uParallax.value = p.parallax;
      uniforms.uBurst.value = p.clickBurst ? burstRef.current : 0;
      uniforms.uCoverageAlpha.value = p.alphaMode === 'coverage' ? 1 : 0;

      try {
        renderer.render(scene, camera);
      } catch (error) {
        // A shader compile error (common on some local browsers/drivers) throws
        // on the first render. Fall back to the plain canvas renderer instead
        // of silently showing nothing.
        console.error('MagicRings WebGL render failed, falling back to canvas:', error);
        switchToFallback();
      }
    };
    frameId = 0;

    const tryStart = () => {
      if (isVisible && isPageVisible && frameId === 0) {
        lastT = 0;
        frameId = requestAnimationFrame(animate);
      }
    };
    const tryStop = () => {
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
renderer.debug.onShaderError = () => {
      console.error('MagicRings WebGL shader failed to compile, falling back to canvas');
      switchToFallback();
    };

    tryStart();
        } else {
          tryStop();
        }
      },
      { threshold: 0 }
    );
    io.observe(mount);

    const onVisibility = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) {
        tryStart();
      } else {
        tryStop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    tryStart();

    return () => {
      tryStop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      mount.removeEventListener('mousemove', onMouseMove);
      mount.removeEventListener('mouseenter', onMouseEnter);
      mount.removeEventListener('mouseleave', onMouseLeave);
      mount.removeEventListener('click', onClick);
      if (fallbackActive) {
        fallbackCleanup();
        return;
      }
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      material.dispose();
    };
  }, []);

  return <div ref={mountRef} className="magic-rings-container" style={blur > 0 ? { filter: `blur(${blur}px)` } : undefined} />;
}
