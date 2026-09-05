'use client';

import React from 'react';

export interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glareOpacity?: number;
  disabled?: boolean;
}

/**
 * Grounded luxury card surface with clean border radius and soft backdrop blur.
 * Stripped of floating 3D perspective and mouse skew effects for Stripe/Apple-grade tactile feel.
 */
export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`rounded-2xl bg-[#181A20]/90 backdrop-blur-md border border-white/[0.08] shadow-xl shadow-black/20 transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
};

