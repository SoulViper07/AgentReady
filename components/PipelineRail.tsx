'use client';

import React from 'react';
import {
  FileCode,
  Sparkles,
  Scale,
  UserCheck,
  Bot,
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';

export interface PipelineRailProps {
  merchantStatus: 'READY' | 'CONDITIONALLY_READY' | 'NOT_READY' | string;
  readinessScore: number;
  unresolvedIssuesCount: number;
  verifiedProductsCount: number;
  totalProductsCount: number;
  hasSettledOrders?: boolean;
}

export const PipelineRail: React.FC<PipelineRailProps> = ({
  merchantStatus,
  readinessScore,
  unresolvedIssuesCount,
  verifiedProductsCount,
  totalProductsCount,
  hasSettledOrders = false,
}) => {
  const isIngested = totalProductsCount > 0;
  const isExtracted = totalProductsCount > 0;
  const isGatePassed = merchantStatus === 'READY' || readinessScore >= 80;
  const isHITLCompleted = unresolvedIssuesCount === 0;
  const isCatalogLive = merchantStatus !== 'NOT_READY';
  const isSettlementReady = isCatalogLive && isGatePassed;

  const steps = [
    {
      id: 1,
      name: 'Ingestion',
      subtext: 'WhatsApp, CSV, Text',
      icon: FileCode,
      status: isIngested ? 'completed' : 'active',
      authority: 'RAW DATA',
      badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    },
    {
      id: 2,
      name: 'AI Extraction',
      subtext: 'Provenance & Nulls',
      icon: Sparkles,
      status: isExtracted ? 'completed' : 'pending',
      authority: 'PROBABILISTIC AI',
      badgeClass: 'bg-violet-950/50 text-violet-300 border-violet-500/30',
    },
    {
      id: 3,
      name: 'Deterministic Gate',
      subtext: '0–100 Quality Index',
      icon: Scale,
      status: isGatePassed ? 'completed' : 'active',
      authority: 'ZERO-LLM RULES',
      badgeClass: 'bg-amber-950/50 text-amber-300 border-amber-500/30',
    },
    {
      id: 4,
      name: 'HITL Approval',
      subtext: isHITLCompleted
        ? `${verifiedProductsCount}/${totalProductsCount} Verified`
        : `${unresolvedIssuesCount} Issues (${verifiedProductsCount} Ver.)`,
      icon: UserCheck,
      status: isHITLCompleted ? 'completed' : 'active',
      authority: 'HUMAN GROUND TRUTH',
      badgeClass: 'bg-sky-950/50 text-sky-300 border-sky-500/30',
    },
    {
      id: 5,
      name: 'Agent Catalog',
      subtext: isCatalogLive ? 'GET /api/catalog (Live)' : 'Catalog Blocked',
      icon: Bot,
      status: isCatalogLive ? 'completed' : 'pending',
      authority: 'MACHINE DISCOVERY',
      badgeClass: 'bg-indigo-950/50 text-indigo-300 border-indigo-500/30',
    },
    {
      id: 6,
      name: 'Razorpay Rails',
      subtext: hasSettledOrders ? 'HMAC Verified' : 'Paise Settlement',
      icon: CreditCard,
      status: hasSettledOrders ? 'completed' : isSettlementReady ? 'active' : 'pending',
      authority: 'FINTECH BOUNDARY',
      badgeClass: 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30',
    },
  ];

  return (
    <div className="w-full rounded-2xl bg-zinc-900/90 border border-zinc-800/80 p-5 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-800/70">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">
            End-to-End Commerce Pipeline Tracker
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 hidden sm:inline">
            Separation of Authority Architecture
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-500">Live Status:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
              merchantStatus === 'READY'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            {merchantStatus} ({readinessScore}/100)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 relative">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'active';

          return (
            <div
              key={step.id}
              className={`relative rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300 border ${
                isCompleted
                  ? 'bg-zinc-950/90 border-emerald-500/30 shadow-sm shadow-emerald-950/20'
                  : isActive
                  ? 'bg-zinc-950/90 border-amber-500/40 shadow-md shadow-amber-950/30 ring-1 ring-amber-500/30'
                  : 'bg-zinc-950/40 border-zinc-800/60 opacity-60'
              }`}
            >
              {/* Connector line on desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                </div>
              )}

              {/* Step Header */}
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-mono text-zinc-500 font-semibold">
                  0{step.id}
                </span>
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${step.badgeClass}`}
                >
                  {step.authority}
                </span>
              </div>

              {/* Icon & Title */}
              <div className="flex items-center gap-2.5 my-1">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isCompleted
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                      : isActive
                      ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <StepIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 tracking-tight leading-snug">
                    {step.name}
                  </h4>
                  <p className="text-[10px] font-mono text-zinc-400 truncate max-w-[110px]">
                    {step.subtext}
                  </p>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono">
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : isActive ? (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                    <Clock className="w-3 h-3 animate-spin" /> In Progress
                  </span>
                ) : (
                  <span className="text-zinc-600">Pending Gate</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
