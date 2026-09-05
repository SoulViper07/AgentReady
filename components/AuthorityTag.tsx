'use client';

import React from 'react';
import {
  Sparkles,
  UserCheck,
  Scale,
  ShieldCheck,
} from 'lucide-react';

export type AuthorityType =
  | 'AI_INFERRED'
  | 'HUMAN_VERIFIED'
  | 'DETERMINISTIC'
  | 'FINTECH_GATE';

export interface AuthorityTagProps {
  type: AuthorityType;
  customLabel?: string;
  tooltip?: string;
  compact?: boolean;
  pulse?: boolean;
  className?: string;
}

export const AuthorityTag: React.FC<AuthorityTagProps> = ({
  type,
  customLabel,
  tooltip,
  compact = false,
  pulse = false,
  className = '',
}) => {
  const config = {
    AI_INFERRED: {
      label: 'AI Extracted (Probabilistic)',
      icon: Sparkles,
      classes:
        'bg-[#23211B] border-amber-500/20 text-amber-200 shadow-sm shadow-black/20',
      dotColor: 'bg-amber-300',
    },
    HUMAN_VERIFIED: {
      label: 'Merchant Verified Ground Truth',
      icon: UserCheck,
      classes:
        'bg-[#1D2228] border-stone-400/20 text-stone-200 shadow-sm shadow-black/20',
      dotColor: 'bg-stone-300',
    },
    DETERMINISTIC: {
      label: 'Deterministic Engine (No LLM)',
      icon: Scale,
      classes:
        'bg-amber-500/10 border-amber-500/25 text-amber-300 shadow-sm shadow-black/20',
      dotColor: 'bg-amber-400',
    },
    FINTECH_GATE: {
      label: 'Cryptographic / Razorpay Invariant',
      icon: ShieldCheck,
      classes:
        'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 shadow-sm shadow-black/20',
      dotColor: 'bg-emerald-400',
    },
  }[type];

  const Icon = config.icon;
  const labelText = customLabel || config.label;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-wider rounded-full border shadow-sm transition-all select-none ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${config.classes} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dotColor}`}
          />
        </span>
      )}
      <Icon className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0`} />
      <span className="font-semibold truncate">{labelText}</span>
    </span>
  );
};
