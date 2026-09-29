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
  const [joystickPos, setJoystickPos] = useState({ startX: 0, startY: 0, currX: 0, currY: 0 });
  const [aiming, setAiming] = useState(false);
  const [firing, setFiring] = useState(false);

  const moveTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number } | null>(null);

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
        setJoystickActive(true);
        setJoystickPos({
          startX: t.clientX,
          startY: t.clientY,
          currX: t.clientX,
          currY: t.clientY,
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
        const dx = t.clientX - joystickPos.startX;
        const dy = t.clientY - joystickPos.startY;
        const maxDist = 48;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        
        const knobX = joystickPos.startX + Math.cos(angle) * clampedDist;
        const knobY = joystickPos.startY + Math.sin(angle) * clampedDist;
        setJoystickPos(prev => ({ ...prev, currX: knobX, currY: knobY }));

        const normX = clampedDist > 5 ? (Math.cos(angle) * clampedDist) / maxDist : 0;
        const normY = clampedDist > 5 ? (Math.sin(angle) * clampedDist) / maxDist : 0;

        // In game: forward is -Y, strafe is +X
        engine.mobileMove(-normY, normX);
        break;
      }
    }
  }, [engine, joystickPos.startX, joystickPos.startY]);

  const handleMoveEnd = useCallback((e: TouchEvent) => {
    if (!engine || moveTouchId.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === moveTouchId.current) {
        moveTouchId.current = null;
        setJoystickActive(false);
        engine.mobileMove(0, 0);
        break;
      }
    }
  }, [engine]);

  // Right side: Swipe to Look / Aim
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!engine) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (lookTouchId.current === null && t.clientX >= window.innerWidth * 0.45) {
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
        
        // Scale touch sensitivity
        engine.mobileLook(dx * 1.3, dy * 1.3);
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

  useEffect(() => {
    if (!active) return;
    window.addEventListener("touchmove", handleMoveChange, { passive: false });
    window.addEventListener("touchend", handleMoveEnd);
    window.addEventListener("touchcancel", handleMoveEnd);
    window.addEventListener("touchmove", handleLookChange, { passive: false });
    window.addEventListener("touchend", handleLookEnd);
    window.addEventListener("touchcancel", handleLookEnd);
    return () => {
      window.removeEventListener("touchmove", handleMoveChange);
      window.removeEventListener("touchend", handleMoveEnd);
      window.removeEventListener("touchcancel", handleMoveEnd);
      window.removeEventListener("touchmove", handleLookChange);
      window.removeEventListener("touchend", handleLookEnd);
      window.removeEventListener("touchcancel", handleLookEnd);
    };
  }, [active, handleMoveChange, handleMoveEnd, handleLookChange, handleLookEnd]);

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
            className="absolute rounded-full border-2 border-neutral-700/60 bg-black/10 backdrop-blur-xs flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: joystickPos.startX,
              top: joystickPos.startY,
              width: 110,
              height: 110,
            }}
          >
            <div
              className="absolute rounded-full border border-black bg-neutral-900/80 shadow-md -translate-x-1/2 -translate-y-1/2"
              style={{
                left: joystickPos.currX - joystickPos.startX + 55,
                top: joystickPos.currY - joystickPos.startY + 55,
                width: 48,
                height: 48,
              }}
            />
          </div>
        )}
      </div>

      {/* Right look touch capture zone */}
      <div
        className="absolute inset-y-0 right-0 w-1/2 pointer-events-auto"
        onTouchStart={handleLookStart}
      />

      {/* Touch Action Buttons (Right Corner) */}
      <div className="absolute right-5 bottom-8 flex flex-col items-end gap-3 pointer-events-auto">
        {/* Top utility row: Reload & Swap */}
        <div className="flex gap-2">
          <button
            type="button"
            className="w-12 h-12 rounded-full border-2 border-neutral-800 bg-white/90 text-neutral-900 font-mono text-xs font-bold shadow-md active:bg-neutral-300 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.cycleWeapon(); }}
          >
            SWAP
          </button>
          <button
            type="button"
            className="w-12 h-12 rounded-full border-2 border-neutral-800 bg-white/90 text-neutral-900 font-mono text-xs font-bold shadow-md active:bg-neutral-300 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.mobileReload(); }}
          >
            REL
          </button>
          <button
            type="button"
            className="w-12 h-12 rounded-full border-2 border-neutral-800 bg-white/90 text-neutral-900 font-mono text-xs font-bold shadow-md active:bg-neutral-300 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.mobileInteract(); }}
          >
            USE
          </button>
        </div>

        {/* Lower row: Aim, Jump, Fire */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`w-14 h-14 rounded-full border-2 border-neutral-800 font-mono text-xs font-bold shadow-md flex items-center justify-center transition-colors ${
              aiming ? "bg-red-600 text-white" : "bg-white/90 text-neutral-900 active:bg-neutral-300"
            }`}
            onTouchStart={(e) => {
              e.stopPropagation();
              const next = !aiming;
              setAiming(next);
              engine?.setMobileAim(next);
            }}
          >
            AIM
          </button>

          <button
            type="button"
            className="w-14 h-14 rounded-full border-2 border-neutral-800 bg-white/90 text-neutral-900 font-mono text-xs font-bold shadow-md active:bg-neutral-300 flex items-center justify-center"
            onTouchStart={(e) => { e.stopPropagation(); engine?.mobileJump(); }}
          >
            JUMP
          </button>

          {/* Large FIRE Button */}
          <button
            type="button"
            className={`w-20 h-20 rounded-full border-3 border-neutral-900 font-mono text-sm font-black tracking-widest shadow-xl flex items-center justify-center transition-transform active:scale-95 ${
              firing ? "bg-red-700 text-white" : "bg-neutral-900 text-white active:bg-red-600"
            }`}
            onTouchStart={(e) => {
              e.stopPropagation();
              setFiring(true);
              engine?.setMobileFire(true);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              setFiring(false);
              engine?.setMobileFire(false);
            }}
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
}
