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
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-2xl shadow-emerald-950/50 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">
                AgentReady
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                Fintech Orchestration
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">
              {subtitle ||
                (pathname === '/agent-demo'
                  ? 'Autonomous Buyer Simulator & Invariant Gate'
                  : 'Merchant Remediation & Verification Console')}
            </p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-6">
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

      <div className="flex items-center gap-2.5">
        {statusMessage && (
          <span className="text-xs font-mono text-emerald-400 hidden lg:inline animate-fade-in">
            {statusMessage}
          </span>
        )}

        {/* Merchant Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono">
          <span className="text-zinc-400 hidden sm:inline">Sweet Crumbs:</span>
          {merchantStatus === 'READY' ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              READY ({merchantScore})
            </span>
          ) : (
            <span className="text-rose-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              {merchantStatus} ({merchantScore})
            </span>
          )}
        </div>

        {/* Subtle Reset Button next to merchant status badge */}
        <button
          onClick={handleReset}
          disabled={resetting}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-rose-300 border border-zinc-800 hover:border-zinc-700 text-xs font-mono transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
          title="Reset demo to unverified baseline"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${
              resetting ? 'animate-spin text-rose-400' : 'text-zinc-400'
            }`}
          />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Optional refresh button */}
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh status"
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
