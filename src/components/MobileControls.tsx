"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Engine } from "@/game/engine";

interface Props {
  engine: Engine | null;
  active: boolean;
}

export function MobileControls({ engine, active }: Props) {
  const [isTouch, setIsTouch] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [aiming, setAiming] = useState(false);
  const [firing, setFiring] = useState(false);

  // Left virtual joystick refs
  const moveTouchId = useRef<number | null>(null);
  const joystickStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);

  // Look swipe refs
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number } | null>(null);

  // Dedicated Aim-to-Shoot Analogue Stick refs
  const fireTouchId = useRef<number | null>(null);
  const fireLastPos = useRef<{ x: number; y: number } | null>(null);
  const fireStartPos = useRef<{ x: number; y: number } | null>(null);
  const fireKnobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTouch = () => {
      const touchSupported = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setIsTouch(touchSupported);
    };
    checkTouch();
    window.addEventListener("resize", checkTouch);
    return () => window.removeEventListener("resize", checkTouch);
  }, []);

  // Left side: Virtual Joystick for Movement
  const handleMoveStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!engine) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (moveTouchId.current === null && t.clientX < window.innerWidth * 0.5) {
        moveTouchId.current = t.identifier;
        joystickStartPos.current = { x: t.clientX, y: t.clientY };
        setJoystickActive(true);
        // Position base directly
        requestAnimationFrame(() => {
          if (joystickBaseRef.current) {
            joystickBaseRef.current.style.left = `${t.clientX}px`;
            joystickBaseRef.current.style.top = `${t.clientY}px`;
          }
          if (joystickKnobRef.current) {
            joystickKnobRef.current.style.transform = "translate3d(0, 0, 0)";
          }
        });
        break;
      }
    }
  };

  const handleMoveChange = useCallback((e: TouchEvent) => {
    if (!engine || moveTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === moveTouchId.current) {
        const dx = t.clientX - joystickStartPos.current.x;
        const dy = t.clientY - joystickStartPos.current.y;
        const maxDist = 48;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        const offX = Math.cos(angle) * clampedDist;
        const offY = Math.sin(angle) * clampedDist;

        // Direct hardware-accelerated transform avoids React re-render lag
        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = `translate3d(${offX}px, ${offY}px, 0)`;
        }

        const normX = clampedDist > 5 ? offX / maxDist : 0;
        const normY = clampedDist > 5 ? offY / maxDist : 0;

        // In game: forward is -Y, strafe is +X
        engine.mobileMove(-normY, normX);
        break;
      }
    }
  }, [engine]);

  const handleMoveEnd = useCallback((e: TouchEvent) => {
    if (!engine || moveTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === moveTouchId.current) {
        moveTouchId.current = null;
        setJoystickActive(false);
        engine.mobileMove(0, 0);
        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = "translate3d(0, 0, 0)";
        }
        break;
      }
    }
  }, [engine]);

  // Right side: Swipe to Look / Camera pan (when not touching action buttons)
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!engine) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (lookTouchId.current === null && t.identifier !== fireTouchId.current && t.clientX >= window.innerWidth * 0.45) {
        lookTouchId.current = t.identifier;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        break;
      }
    }
  };

  const handleLookChange = useCallback((e: TouchEvent) => {
    if (!engine || lookTouchId.current === null || !lastLookPos.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };

        // Scale touch sensitivity smoothly
        engine.mobileLook(dx * 1.35, dy * 1.35);
        break;
      }
    }
  }, [engine]);

  const handleLookEnd = useCallback((e: TouchEvent) => {
    if (!engine || lookTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        lookTouchId.current = null;
        lastLookPos.current = null;
        break;
      }
    }
  }, [engine]);

  // AIM-TO-FIRE Analogue Touch Stick Handler
  const handleFireStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!engine) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (fireTouchId.current === null) {
        fireTouchId.current = t.identifier;
        fireStartPos.current = { x: t.clientX, y: t.clientY };
        fireLastPos.current = { x: t.clientX, y: t.clientY };
        setFiring(true);
        if (fireKnobRef.current) {
          fireKnobRef.current.style.transform = "translate3d(0, 0, 0)";
        }
        engine.setMobileFire(true);
        break;
      }
    }
  };

  const handleFireMove = useCallback((e: TouchEvent) => {
    if (!engine || fireTouchId.current === null || !fireLastPos.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === fireTouchId.current) {
        const dx = t.clientX - fireLastPos.current.x;
        const dy = t.clientY - fireLastPos.current.y;
        fireLastPos.current = { x: t.clientX, y: t.clientY };

        // Steer camera aim while shooting with smooth mobile sensitivity
        engine.mobileLook(dx * 1.35, dy * 1.35);

        // Update visual analogue stick knob clamped to max radius 32px directly via DOM ref
        if (fireStartPos.current && fireKnobRef.current) {
          const totalDx = t.clientX - fireStartPos.current.x;
          const totalDy = t.clientY - fireStartPos.current.y;
          const dist = Math.hypot(totalDx, totalDy);
          const maxDist = 32;
          const angle = Math.atan2(totalDy, totalDx);
          const clamped = Math.min(dist, maxDist);
          const offX = Math.cos(angle) * clamped;
          const offY = Math.sin(angle) * clamped;
          fireKnobRef.current.style.transform = `translate3d(${offX}px, ${offY}px, 0)`;
        }
        break;
      }
    }
  }, [engine]);

  const handleFireEnd = useCallback((e: TouchEvent) => {
    if (!engine || fireTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === fireTouchId.current) {
        fireTouchId.current = null;
        fireLastPos.current = null;
        fireStartPos.current = null;
        setFiring(false);
        if (fireKnobRef.current) {
          fireKnobRef.current.style.transform = "translate3d(0, 0, 0)";
        }
        engine.setMobileFire(false);
        break;
      }
    }
  }, [engine]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("touchmove", handleMoveChange, { passive: false });
    window.addEventListener("touchend", handleMoveEnd);
    window.addEventListener("touchcancel", handleMoveEnd);
    window.addEventListener("touchmove", handleLookChange, { passive: false });
    window.addEventListener("touchend", handleLookEnd);
    window.addEventListener("touchcancel", handleLookEnd);
    window.addEventListener("touchmove", handleFireMove, { passive: false });
    window.addEventListener("touchend", handleFireEnd);
    window.addEventListener("touchcancel", handleFireEnd);
    return () => {
      window.removeEventListener("touchmove", handleMoveChange);
      window.removeEventListener("touchend", handleMoveEnd);
      window.removeEventListener("touchcancel", handleMoveEnd);
      window.removeEventListener("touchmove", handleLookChange);
      window.removeEventListener("touchend", handleLookEnd);
      window.removeEventListener("touchcancel", handleLookEnd);
      window.removeEventListener("touchmove", handleFireMove);
      window.removeEventListener("touchend", handleFireEnd);
      window.removeEventListener("touchcancel", handleFireEnd);
    };
  }, [active, handleMoveChange, handleMoveEnd, handleLookChange, handleLookEnd, handleFireMove, handleFireEnd]);

  if (!isTouch || !active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-10 select-none touch-none">
      {/* Left movement touch capture zone */}
      <div
        className="absolute inset-y-0 left-0 w-1/2 pointer-events-auto"
        onTouchStart={handleMoveStart}
      >
        {joystickActive && (
          <div
            ref={joystickBaseRef}
            className="absolute rounded-full border-2 border-neutral-700/60 bg-black/10 backdrop-blur-xs flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[110px] h-[110px]"
          >
            <div
              ref={joystickKnobRef}
              className="w-12 h-12 rounded-full border border-black bg-neutral-900/80 shadow-md flex items-center justify-center pointer-events-none"
            >
              <div className="w-4 h-4 rounded-full bg-neutral-500/50" />
            </div>
          </div>
        )}
      </div>

      {/* Right look touch capture zone (general swipe) */}
      <div
        className="absolute inset-y-0 right-0 w-1/2 pointer-events-auto"
        onTouchStart={handleLookStart}
      />

      {/* Touch Action Buttons (Right Corner) */}
      <div className="absolute right-4 bottom-6 flex flex-col items-end gap-3 pointer-events-auto">
        {/* Top utility row: Reload, Swap, Use */}
        <div className="flex gap-2">
          <button
            type="button"
            className="w-12 h-12 rounded-full border border-neutral-800/80 bg-neutral-900/80 text-white font-mono text-xs font-bold shadow-lg backdrop-blur-xs active:bg-neutral-700 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.cycleWeapon(); }}
          >
            SWAP
          </button>
          <button
            type="button"
            className="w-12 h-12 rounded-full border border-neutral-800/80 bg-neutral-900/80 text-white font-mono text-xs font-bold shadow-lg backdrop-blur-xs active:bg-neutral-700 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.mobileReload(); }}
          >
            RELOAD
          </button>
          <button
            type="button"
            className="w-12 h-12 rounded-full border border-neutral-800/80 bg-neutral-900/80 text-white font-mono text-xs font-bold shadow-lg backdrop-blur-xs active:bg-neutral-700 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.mobileInteract(); }}
          >
            USE
          </button>
        </div>

        {/* Lower row: Aim, Jump, Analogue AIM-TO-FIRE Stick */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`w-14 h-14 rounded-full border-2 font-mono text-xs font-bold shadow-xl backdrop-blur-xs flex items-center justify-center transition-colors ${
              aiming ? "border-amber-400 bg-amber-500 text-black font-black" : "border-neutral-700 bg-neutral-900/80 text-white active:bg-neutral-700"
            }`}
            onTouchStart={(e) => {
              e.stopPropagation();
              const next = !aiming;
              setAiming(next);
              engine?.setMobileAim(next);
            }}
          >
            ADS
          </button>

          <button
            type="button"
            className="w-14 h-14 rounded-full border-2 border-neutral-700 bg-neutral-900/80 text-white font-mono text-xs font-bold shadow-xl backdrop-blur-xs active:bg-neutral-700 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.mobileJump(); }}
          >
            JUMP
          </button>

          {/* Precision Analogue AIM-TO-FIRE Stick */}
          <div
            className={`relative w-24 h-24 rounded-full border-3 flex items-center justify-center cursor-pointer shadow-2xl transition-all ${
              firing
                ? "border-red-500 bg-red-950/70 shadow-red-500/50 scale-105"
                : "border-neutral-500/80 bg-neutral-950/80 shadow-black/80 hover:border-red-400"
            }`}
            onTouchStart={handleFireStart}
          >
            {/* Outer wireframe crosshair marks */}
            <div className="absolute inset-0 rounded-full border border-dashed border-red-500/40 pointer-events-none" />
            <div className="absolute top-1 w-2 h-0.5 bg-red-400/70 pointer-events-none" />
            <div className="absolute bottom-1 w-2 h-0.5 bg-red-400/70 pointer-events-none" />
            <div className="absolute left-1 h-2 w-0.5 bg-red-400/70 pointer-events-none" />
            <div className="absolute right-1 h-2 w-0.5 bg-red-400/70 pointer-events-none" />

            {/* Dynamic Analogue Thumb Knob / Reticle (Hardware accelerated transform) */}
            <div
              ref={fireKnobRef}
              className={`rounded-full flex flex-col items-center justify-center pointer-events-none shadow-lg ${
                firing
                  ? "w-14 h-14 bg-red-600 border-2 border-white text-white font-black"
                  : "w-12 h-12 bg-neutral-800/90 border border-neutral-400 text-neutral-200 font-bold"
              }`}
            >
              <span className="text-[11px] tracking-wider leading-none">
                {firing ? "AIM" : "FIRE"}
              </span>
              <span className="text-[8px] opacity-75 leading-tight font-sans">
                {firing ? "DRAG" : "STICK"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
