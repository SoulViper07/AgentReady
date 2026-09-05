'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sparkles,
  Store,
  Bot,
  Code,
  ExternalLink,
  History,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export interface NavbarProps {
  merchantStatus?: string;
  merchantScore?: number;
  onReset?: () => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  subtitle?: string;
  statusMessage?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  merchantStatus = 'NOT_READY',
  merchantScore = 0,
  onReset,
  onRefresh,
  subtitle,
  statusMessage,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const res = await fetch('/api/seed/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');

      if (onReset) {
        await onReset();
      }
      router.refresh();

      setToastMessage('Demo state reset to unverified');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Reset error:', err);
      setToastMessage('Failed to reset demo state');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setResetting(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B0F17]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-2xl shadow-emerald-950/50 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center gap-4 sm:gap-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                AgentReady
              </span>
              <span className="hidden md:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-white/[0.06]">
                Fintech Orchestration
              </span>
            </div>
            <p className="hidden sm:inline text-xs text-zinc-400 font-medium">
              {subtitle ||
                (pathname === '/agent-demo'
                  ? 'Autonomous Buyer Simulator & Invariant Gate'
                  : 'Merchant Remediation & Verification Console')}
            </p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 border-l border-white/[0.08] pl-5">
          <Link
            href="/dashboard"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              pathname === '/dashboard'
                ? 'bg-zinc-800/80 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Store
              className={`w-3.5 h-3.5 ${
                pathname === '/dashboard' ? 'text-emerald-400' : 'text-zinc-400'
              }`}
            />
            Remediation Dashboard
          </Link>
          <Link
            href="/agent-demo"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
              pathname === '/agent-demo'
                ? 'bg-zinc-800/80 text-emerald-400 border border-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Bot
              className={`w-3.5 h-3.5 ${
                pathname === '/agent-demo'
                  ? 'text-emerald-400'
                  : 'text-zinc-400'
              }`}
            />
            AI Buyer Playground
          </Link>
          <Link
            href="/dashboard#audit-ledger"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-2"
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            Audit Ledger
          </Link>
          <Link
            href="/api/catalog"
            target="_blank"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
          >
            <Code className="w-3.5 h-3.5 text-zinc-400" />
            Catalog API
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {statusMessage && (
          <span className="text-xs font-mono text-emerald-400 hidden lg:inline animate-fade-in">
            {statusMessage}
          </span>
        )}

        {/* Compact Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono">
          {merchantStatus === 'READY' ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>READY</span>
              {merchantScore !== undefined && (
                <span className="text-emerald-400/70 font-normal font-mono">({merchantScore})</span>
              )}
            </span>
          ) : (
            <span className="text-rose-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span>{merchantStatus === 'NOT_READY' ? 'NOT READY' : merchantStatus}</span>
              {merchantScore !== undefined && (
                <span className="text-rose-400/70 font-normal font-mono">({merchantScore})</span>
              )}
            </span>
          )}
        </div>

        {/* Subtle Circular Reset Button */}
        <button
          onClick={handleReset}
          disabled={resetting}
          className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 text-zinc-400 hover:text-rose-400 border border-white/[0.08] transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
          title="Reset demo to unverified baseline"
          aria-label="Reset demo to unverified baseline"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${
              resetting ? 'animate-spin text-rose-400' : ''
            }`}
          />
        </button>

        {/* Optional refresh button */}
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 text-zinc-400 hover:text-white border border-white/[0.08] transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
            title="Refresh status"
            aria-label="Refresh status"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                refreshing ? 'animate-spin text-emerald-400' : ''
              }`}
            />
          </button>
        )}
      </div>
    </header>
  );
};
