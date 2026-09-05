'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

export interface IngestProgressBarProps {
  progress: number; // 0 to 100
  stageText: string;
  providerUsed?: 'gemini' | 'groq' | 'deterministic' | 'openai' | null;
  isFallbackTriggered?: boolean;
  elapsedSeconds: number;
  itemsCount?: number;
  isComplete?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
}

export function IngestProgressBar({
  progress,
  stageText,
  providerUsed,
  isFallbackTriggered = false,
  elapsedSeconds,
  itemsCount,
  isComplete = false,
  onContinue,
  continueLabel = 'Proceed to Verification Queue',
}: IngestProgressBarProps) {
  const showReassurance = elapsedSeconds >= 10 && !isComplete;

  return (
    <div className="w-full rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4">
      {/* Top Header: Title, Progress %, and Provider Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            {isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Layers className="w-5 h-5 text-amber-400 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#F8F9FA] font-mono tracking-tight">
                {isComplete ? 'INGESTION COMPLETED' : 'INGESTION PIPELINE ACTIVE'}
              </h3>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                {Math.round(progress)}%
              </span>
            </div>
            <p className="text-[11px] text-stone-400 font-mono mt-0.5">
              Dual-Provider Engine (Gemini 3.6 Flash ⇄ Groq Fallback)
            </p>
          </div>
        </div>

        {/* Provider Badge */}
        <div className="flex items-center gap-2">
          {providerUsed === 'groq' || isFallbackTriggered ? (
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm shadow-amber-950/40 animate-in fade-in">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              ⚡ Groq Llama 3.2 Vision (High-Speed Fallback)
            </span>
          ) : providerUsed === 'deterministic' ? (
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#121316] text-stone-300 border border-white/[0.08] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-stone-400" />
              🛡️ Deterministic Fallback Engine
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-200 border border-amber-500/30 flex items-center gap-1.5 shadow-sm shadow-black/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              ⚡ Powered by Gemini 3.6 Flash
            </span>
          )}
        </div>
      </div>

      {/* Animated Smooth Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="h-3 w-full bg-black/60 rounded-full border border-white/[0.08] overflow-hidden p-0.5">
          <motion.div
            className={`h-full rounded-full transition-colors ${
              isComplete
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/30'
                : isFallbackTriggered
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400'
            }`}
            initial={{ width: '5%' }}
            animate={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        {/* Status text & Elapsed Time */}
        <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 px-1">
          <span className="truncate pr-2 text-stone-300">
            {stageText}
          </span>
          <span className="shrink-0 flex items-center gap-1 text-stone-400">
            <Clock className="w-3 h-3 text-amber-400" />
            {elapsedSeconds.toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Terminal Trace Box */}
      <div className="rounded-xl bg-[#121316] border border-white/[0.06] p-3.5 font-mono text-xs text-stone-300 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] text-stone-400 uppercase tracking-wider pb-1.5 border-b border-white/[0.06]">
          <span>Pipeline Stage Telemetry</span>
          <span className="text-amber-400 font-bold">
            {progress < 25
              ? 'Stage 1/4: Encoding'
              : progress < 65
              ? 'Stage 2/4: Vision OCR'
              : progress < 90
              ? 'Stage 3/4: Schema Invariants'
              : 'Stage 4/4: Persistence'}
          </span>
        </div>

        <div className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-300">
          <span className="text-emerald-400 font-bold">&gt;</span>
          <span className="font-mono">
            {stageText}
          </span>
        </div>

        {isFallbackTriggered && (
          <div className="flex items-center gap-2 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Failover engaged: Gemini 12s latency threshold reached. Fallback to Groq executed seamlessly.</span>
          </div>
        )}
      </div>

      {/* Reassurance note if duration exceeds 10s (Requirement 3) */}
      {showReassurance && (
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2.5 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span className="font-mono leading-relaxed">
            Analyzing dense menu items and reading price coordinates...
          </span>
        </div>
      )}

      {/* Completion Action */}
      {isComplete && onContinue && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
          >
            <span>{continueLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
