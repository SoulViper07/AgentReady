'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export interface SpotlightProps {
  status?: 'READY' | 'CONDITIONALLY_READY' | 'NOT_READY' | string;
  className?: string;
  size?: number;
}

function subscribeHover(callback: () => void) {
  const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getHoverSnapshot() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function getHoverServerSnapshot() {
  return false;
}

export const Spotlight: React.FC<SpotlightProps> = ({
  status = 'NOT_READY',
  className = '',
  size = 600,
}) => {
  const canHover = useSyncExternalStore(
    subscribeHover,
    getHoverSnapshot,
    getHoverServerSnapshot
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 200 };
  const smoothX = useSpring(rawX, springConfig);
  const smoothY = useSpring(rawY, springConfig);

  useEffect(() => {
    if (!canHover) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      rawX.set(e.clientX - rect.left);
      rawY.set(e.clientY - rect.top);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [canHover, rawX, rawY]);

  // Color selection based on merchant transaction status
  const isReady = status === 'READY';
  const isConditional = status === 'CONDITIONALLY_READY';

  const primaryGlow = isReady
    ? 'rgba(16, 185, 129, 0.16)' // botanical emerald
    : isConditional
    ? 'rgba(245, 158, 11, 0.14)' // warm amber
    : 'rgba(244, 63, 94, 0.14)'; // terracotta / rose

  const secondaryGlow = isReady
    ? 'rgba(16, 185, 129, 0.05)' // botanical emerald undertone
    : isConditional
    ? 'rgba(217, 119, 6, 0.06)' // warm champagne undertone
    : 'rgba(120, 113, 108, 0.06)'; // warm stone undertone

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {canHover ? (
        <motion.div
          style={{
            x: smoothX,
            y: smoothY,
            translateX: -size / 2,
            translateY: -size / 2,
            width: size,
            height: size,
            background: `radial-gradient(circle, ${primaryGlow} 0%, ${secondaryGlow} 50%, transparent 80%)`,
          }}
          className="pointer-events-none absolute rounded-full will-change-transform blur-3xl opacity-90 transition-colors duration-700"
        />
      ) : (
        /* Mobile fallback with static CSS radial gradient (zero mousemove listeners, 60fps) */
        <div
          style={{
            background: `radial-gradient(circle at 50% 30%, ${primaryGlow} 0%, ${secondaryGlow} 45%, transparent 75%)`,
          }}
          className="pointer-events-none absolute inset-0 will-change-transform blur-2xl opacity-75 transition-colors duration-700"
        />
      )}
    </div>
  );
};
