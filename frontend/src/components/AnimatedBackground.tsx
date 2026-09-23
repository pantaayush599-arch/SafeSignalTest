import { useEffect, useRef } from "react";
import { useSecurityState } from "../state/securityState";
import { useTheme } from "../state/theme";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Pulse {
  fromIdx: number;
  toIdx: number;
  t: number; // 0..1 progress
  speed: number;
}

const STATE_TUNING = {
  calm: { count: 42, speed: 0.12, linkDist: 130, opacity: 0.35, pulseChance: 0.002 },
  risk: { count: 48, speed: 0.22, linkDist: 140, opacity: 0.45, pulseChance: 0.01 },
  paused: { count: 40, speed: 0.08, linkDist: 120, opacity: 0.4, pulseChance: 0.004 },
  verifying: { count: 46, speed: 0.28, linkDist: 150, opacity: 0.55, pulseChance: 0.045 },
  verified: { count: 46, speed: 0.18, linkDist: 140, opacity: 0.5, pulseChance: 0.02 },
} as const;

/**
 * Subtle security-network background that reflects the app's current
 * position in DETECT -> PAUSE -> VERIFY -> DECIDE (task spec sections 4-5):
 * calm ambient drift normally, a slightly more active network when risk is
 * detected, a darker/gold-red-tinted atmosphere while paused, visibly
 * traveling signal pulses while verifying, and a settling green pulse on
 * verified. Never interferes with foreground readability -- low opacity,
 * no large shapes, and it fully freezes under prefers-reduced-motion.
 */
export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = useSecurityState();
  const { resolved } = useTheme();
  const reducedMotion = useReducedMotion();
  const stateRef = useRef(state);
  const themeRef = useRef(resolved);
  stateRef.current = state;
  themeRef.current = resolved;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    let pulses: Pulse[] = [];
    let raf = 0;
    let successPulse = 0; // 0..1 fade-out ring on entering "verified"
    let lastState = stateRef.current;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const tuning = STATE_TUNING[stateRef.current];
      particles = Array.from({ length: tuning.count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * tuning.speed,
        vy: (Math.random() - 0.5) * tuning.speed,
        r: 1 + Math.random() * 1.5,
      }));
    }

    function accentColors() {
      const dark = themeRef.current === "dark";
      return {
        cyan: dark ? "53,214,207" : "15,143,136",
        gold: dark ? "220,170,84" : "169,117,39",
        red: dark ? "224,87,74" : "193,57,44",
        green: dark ? "85,201,138" : "47,158,99",
        line: dark ? "255,255,255" : "20,30,60",
      };
    }

    function draw() {
      if (!ctx) return;
      const s = stateRef.current;
      if (s !== lastState) {
        if (s === "verified") successPulse = 1;
        lastState = s;
      }
      const tuning = STATE_TUNING[s];
      const colors = accentColors();
      ctx.clearRect(0, 0, width, height);

      // ambient radial wash, tinted per state
      const wash = ctx.createRadialGradient(width * 0.5, height * 0.15, 0, width * 0.5, height * 0.15, Math.max(width, height) * 0.7);
      const washColor = s === "paused" ? colors.gold : s === "risk" ? colors.red : s === "verified" ? colors.green : colors.cyan;
      wash.addColorStop(0, `rgba(${washColor},${s === "paused" ? 0.05 : 0.04})`);
      wash.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      // move + draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colors.cyan},${tuning.opacity * 0.7})`;
        ctx.fill();
      }

      // connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < tuning.linkDist) {
            const alpha = (1 - dist / tuning.linkDist) * tuning.opacity * 0.25;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${colors.line},${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // occasional traveling signal pulses -- more frequent while verifying
      if (Math.random() < tuning.pulseChance && particles.length > 4) {
        const fromIdx = Math.floor(Math.random() * particles.length);
        let toIdx = Math.floor(Math.random() * particles.length);
        if (toIdx === fromIdx) toIdx = (toIdx + 1) % particles.length;
        pulses.push({ fromIdx, toIdx, t: 0, speed: 0.02 + Math.random() * 0.02 });
      }
      pulses = pulses.filter((pulse) => pulse.t < 1);
      for (const pulse of pulses) {
        pulse.t += pulse.speed;
        const a = particles[pulse.fromIdx];
        const b = particles[pulse.toIdx];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * pulse.t;
        const y = a.y + (b.y - a.y) * pulse.t;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colors.cyan},0.9)`;
        ctx.shadowColor = `rgba(${colors.cyan},0.8)`;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // success ring pulse on entering "verified"
      if (successPulse > 0) {
        const radius = (1 - successPulse) * Math.max(width, height) * 0.5;
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.3, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${colors.green},${successPulse * 0.3})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        successPulse -= 0.012;
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);

    if (reducedMotion) {
      // Single static, calm frame -- no animation loop at all.
      draw();
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.9 }}
    />
  );
}
