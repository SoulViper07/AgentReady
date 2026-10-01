'use client';

import React from 'react';
import Link from 'next/link';
import {
  History,
  ShieldCheck,
  ArrowLeft,
  Terminal,
  Database,
  Lock,
  Sparkles,
} from 'lucide-react';
import { AuditFeed } from '../../components/AuditFeed';
import ResetSandboxButton from '../../components/ResetSandboxButton';

export default function LedgerPage() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] flex-1 bg-[#0E0F12] text-stone-100 font-sans selection:bg-purple-500/30 selection:text-purple-200 flex flex-col">
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 sm:gap-8 flex-1">
        {/* Ledger Header & Navigation Breadcrumb */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#181A20] via-[#141519] to-[#0E0F12] border border-white/[0.08] p-5 sm:p-7 shadow-2xl shadow-black/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 via-stone-800 to-[#181A20] border border-purple-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <History className="w-6 h-6 sm:w-7 sm:h-7 text-purple-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-200 via-stone-100 to-stone-400 bg-clip-text text-transparent">
                  System Audit Ledger
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300">
                  <Lock className="w-3 h-3 text-purple-400" />
                  <span>IMMUTABLE LOGS</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-400 max-w-2xl leading-relaxed">
                Cryptographic audit trail tracking all ingestion events, invariant checks, merchant score evaluations, and autonomous AI transaction proposals.
              </p>
              <div className="flex items-center gap-4 text-xs text-stone-500 mt-1 flex-wrap font-mono">
                <span>Merchant: Sweet Crumbs</span>
                <span>•</span>
                <span>Audit Store: SQLite</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
            </div>
          </div>

          {/* Action Strip: Back to Dashboard & Reset Sandbox */}
          <div className="flex items-center gap-3 self-start md:self-center shrink-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-400 hover:text-stone-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <ResetSandboxButton />
          </div>
        </section>

        {/* Audit Feed Table Container */}
        <section className="w-full">
          <AuditFeed merchantSlug="sweet-crumbs" />
        </section>
      </main>
    </div>
  );
}
