'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
  UploadCloud,
  ShieldCheck,
} from 'lucide-react';

const navLinks = [
  {
    href: '/ingest',
    label: 'Store Ingest',
    shortTag: 'ING',
    icon: UploadCloud,
  },
  {
    href: '/dashboard',
    label: 'Readiness & Verification',
    shortTag: 'RDY',
    icon: ShieldCheck,
  },
  {
    href: '/agent-demo',
    label: 'AI Buyer Terminal',
    shortTag: 'AGT',
    icon: Bot,
  },
  {
    href: '/dashboard#audit-ledger',
    label: 'Audit Ledger',
    shortTag: 'LOG',
    icon: History,
  },
];

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
    <header className="sticky top-0 z-40 bg-[#0E0F12]/90 backdrop-blur-xl border-b border-white/[0.08]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 sm:right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#181A20] border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-black/20 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-[#F8F9FA]">
                  AgentReady
                </span>
                <span className="hidden md:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-stone-400 border border-white/[0.06]">
                  Fintech Orchestration
                </span>
              </div>
              <p className="hidden sm:inline text-xs text-stone-400 font-medium">
                {subtitle ||
                  (pathname === '/agent-demo'
                    ? 'Autonomous Buyer Simulator & Invariant Gate'
                    : 'Merchant Remediation & Verification Console')}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Pills with Smooth Sliding Active Pill Indicator */}
          <nav className="hidden sm:flex items-center gap-1 border-l border-white/[0.08] pl-4 sm:pl-5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 active:scale-[0.97] tactile-btn ${
                    isActive
                      ? 'text-emerald-400'
                      : 'text-stone-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navbarActiveTab"
                      className="absolute inset-0 bg-[#181A20] border border-emerald-500/20 rounded-lg -z-10 shadow-sm"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-emerald-400' : 'text-stone-400'
                    }`}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusMessage && (
            <span className="text-xs font-mono text-emerald-400 hidden lg:inline animate-fade-in">
              {statusMessage}
            </span>
          )}

          {/* Compact Status Pill with Slow Rhythmic Breathe Animation */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-mono shadow-sm">
            {merchantStatus === 'READY' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-breathe" />
                <span>READY</span>
                {merchantScore !== undefined && (
                  <span className="text-emerald-400/70 font-normal font-mono">({merchantScore})</span>
                )}
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-breathe" />
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
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 tactile-btn text-stone-400 hover:text-rose-400 border border-white/[0.08] transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
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
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 tactile-btn text-stone-400 hover:text-white border border-white/[0.08] transition-all flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
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
      </div>

      {/* Dedicated Mobile Navigation Strip: Touch-Friendly min 44x44px Tap Targets */}
      <div className="flex sm:hidden items-center justify-between gap-1.5 px-3 py-2 bg-[#0E0F12]/95 border-t border-white/[0.06] backdrop-blur-md no-scrollbar">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              title={link.label}
              className={`relative min-h-[44px] min-w-[44px] flex-1 p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium active:scale-[0.95] transition-all duration-100 ease-out cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : 'bg-white/[0.03] text-stone-400 border border-white/[0.05] hover:text-white hover:border-white/20'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-mono font-semibold tracking-wider">
                {link.shortTag}
              </span>
            </Link>
          );
        })}
      </div>
    </header>
  );
};
