'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Store,
  MapPin,
  Phone,
  Layers,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileCheck2,
  Loader2,
  Lock,
  Bot,
  ExternalLink,
  History,
  Code,
} from 'lucide-react';
import { IssueCard } from '../../components/IssueCard';
import { AuditFeed } from '../../components/AuditFeed';

interface MerchantData {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  contactPhone: string | null;
  readinessScore: number;
  transactionStatus: 'READY' | 'CONDITIONALLY_READY' | 'NOT_READY';
}

interface ScoreBreakdown {
  productData: number;
  priceReliability: number;
  inventoryConfidence: number;
  policyReadiness: number;
  dataConsistency: number;
}

interface InvariantResult {
  passed: boolean;
  failures: string[];
}

interface ProductItem {
  id: string;
  name: string;
  price: number | null;
  currency: string;
  priceVerified: boolean;
  inventory: number | null;
  inventoryVerified: boolean;
  isEggless: boolean | null;
  status: string;
}

interface PolicyItem {
  id: string;
  type: string;
  content: string | null;
  isVerified: boolean;
}

interface IssueItem {
  id: string;
  merchantId: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  remediationSuggestion?: string | null;
  resolved: boolean;
  advice?: {
    explanation: string;
    suggestedAction: string;
    draftContent?: string;
  };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(
    null
  );
  const [invariants, setInvariants] = useState<InvariantResult | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    try {
      const res = await fetch('/api/readiness?slug=sweet-crumbs');
      if (!res.ok) throw new Error('Failed to load readiness data');
      const data = await res.json();

      setMerchant(data.merchant);
      setScoreBreakdown(data.scoreBreakdown);
      setInvariants(data.invariants);
      setProducts(data.products || []);
      setPolicies(data.policies || []);
      setIssues(data.issues || []);
    } catch (err: unknown) {
      console.error(err);
      setStatusMessage('Error loading readiness data');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      try {
        const res = await fetch('/api/readiness?slug=sweet-crumbs');
        if (!res.ok) throw new Error('Failed to load readiness data');
        const data = await res.json();
        if (!isMounted) return;
        setMerchant(data.merchant);
        setScoreBreakdown(data.scoreBreakdown);
        setInvariants(data.invariants);
        setProducts(data.products || []);
        setPolicies(data.policies || []);
        setIssues(data.issues || []);
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error(err);
        setStatusMessage('Error loading readiness data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleResolveAction = async (payload: {
    action: string;
    issueId?: string;
    productId?: string;
    authoritativePrice?: number;
    price?: number;
    inventory?: number;
    policyId?: string;
    merchantId?: string;
    type?: string;
    content?: string;
  }) => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          merchantId: merchant?.id,
          merchantSlug: merchant?.slug,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Resolution action failed');
      }

      const result = await res.json();

      // Real-time update state from verification response
      if (merchant) {
        setMerchant({
          ...merchant,
          readinessScore: result.readinessScore,
          transactionStatus: result.transactionStatus,
        });
      }
      setScoreBreakdown(result.scoreBreakdown);
      setInvariants(result.invariants);

      // Refresh full dataset to update issue resolved statuses & policy/product flags
      await fetchReadiness();

      setStatusMessage('Action applied and readiness score recalculated.');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setStatusMessage(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (resetting) return;
    setResetting(true);
    setStatusMessage('Resetting demo to unverified baseline...');
    try {
      const res = await fetch('/api/seed/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      await fetchReadiness();
      setStatusMessage('Demo baseline restored (36/100, NOT_READY).');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setStatusMessage(msg);
    } finally {
      setResetting(false);
    }
  };

  const unresolvedIssues = issues.filter((i) => !i.resolved);
  const criticalIssues = unresolvedIssues.filter(
    (i) => i.severity === 'CRITICAL'
  );
  const highIssues = unresolvedIssues.filter((i) => i.severity === 'HIGH');
  const mediumIssues = unresolvedIssues.filter((i) => i.severity === 'MEDIUM');

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'READY':
        return (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            READY FOR TRANSACTIONS
          </div>
        );
      case 'CONDITIONALLY_READY':
        return (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            CONDITIONALLY READY
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            NOT READY (BLOCKED)
          </div>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30';
    if (score >= 60) return 'text-amber-400 border-amber-500/30';
    return 'text-rose-400 border-rose-500/30';
  };

  if (loading && !merchant) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span>Loading Merchant Readiness Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
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
                Merchant Remediation & Verification Console
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-6">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 text-emerald-400 border border-emerald-500/20 flex items-center gap-2"
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              Remediation Dashboard
            </Link>
            <Link
              href="/agent-demo"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-2"
            >
              <Bot className="w-3.5 h-3.5 text-zinc-400" />
              AI Buyer Playground
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
            <a
              href="#audit-ledger"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-2"
            >
              <History className="w-3.5 h-3.5 text-zinc-400" />
              Audit Ledger
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {statusMessage && (
            <span className="text-xs font-mono text-emerald-400 animate-fade-in">
              {statusMessage}
            </span>
          )}
          <button
            onClick={handleResetDemo}
            disabled={resetting || actionLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-medium transition-all disabled:opacity-50"
            title="Reset demo baseline"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`}
            />
            Reset Demo Baseline
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Merchant Header Card */}
        <section className="rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900/60 border border-zinc-800 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 shadow-inner">
              <Store className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {merchant?.name || 'Sweet Crumbs'}
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                  slug: {merchant?.slug}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap mt-0.5">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  {merchant?.location || 'Chandannagar & Chuchura'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  {merchant?.contactPhone || '+91 8697774043'}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-zinc-400">
                  <Layers className="w-3.5 h-3.5" />
                  {products.length} Products Cataloged
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {getStatusBadge(merchant?.transactionStatus)}
          </div>
        </section>

        {/* Readiness Overview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Score Card: 4 Cols */}
          <div className="lg:col-span-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Readiness Index
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  Deterministic v1.0
                </span>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span
                  className={`text-6xl font-extrabold tracking-tight ${getScoreColor(
                    merchant?.readinessScore || 0
                  ).split(' ')[0]}`}
                >
                  {merchant?.readinessScore || 0}
                </span>
                <span className="text-2xl font-medium text-zinc-400">/ 100</span>
              </div>

              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                {merchant?.transactionStatus === 'READY'
                  ? 'Autonomous AI buyers are unlocked to place instant, verified cart transactions.'
                  : merchant?.transactionStatus === 'CONDITIONALLY_READY'
                  ? 'Orders permitted with manual escrow holds or conditional review.'
                  : 'Catalog invariant gates failed. AI buyer carts will be actively blocked at checkout.'}
              </p>
            </div>

            {/* Invariant Hard Gates */}
            <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Invariant Hard Gates
              </span>

              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    Verified Price (&gt; 0)
                  </span>
                  {products.some((p) => p.priceVerified && p.price && p.price > 0) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <Lock className="w-3.5 h-3.5 text-zinc-400" />
                    Verified Inventory (&gt; 0)
                  </span>
                  {products.some(
                    (p) => p.inventoryVerified && p.inventory && p.inventory > 0
                  ) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <FileCheck2 className="w-3.5 h-3.5 text-zinc-400" />
                    Verified Policy
                  </span>
                  {policies.some((p) => p.isVerified) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-zinc-800">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                    Zero Critical Issues
                  </span>
                  {criticalIssues.length === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span className="text-rose-400 font-mono font-semibold">
                      {criticalIssues.length} Unresolved
                    </span>
                  )}
                </div>
              </div>

              {invariants && !invariants.passed && invariants.failures.length > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex flex-col gap-1">
                  <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Blocking Invariants ({invariants.failures.length}):
                  </span>
                  {invariants.failures.map((f, i) => (
                    <span key={i} className="leading-snug text-rose-300/80">
                      • {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category Breakdown Bars: 8 Cols */}
          <div className="lg:col-span-8 rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Deterministic Score Model Breakdown
                </h3>
                <span className="text-xs font-mono text-zinc-400">
                  5 Categories × 20 pts Max
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {/* 1. Product Data */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">Product Data</span>
                    <span className="font-mono font-bold text-zinc-100">
                      {scoreBreakdown?.productData || 0} / 20
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${((scoreBreakdown?.productData || 0) / 20) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Completeness of descriptions, clean names & dietary flags
                  </span>
                </div>

                {/* 2. Price Reliability */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">
                      Price Reliability
                    </span>
                    <span className="font-mono font-bold text-zinc-100">
                      {scoreBreakdown?.priceReliability || 0} / 20
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${(Math.max(0, scoreBreakdown?.priceReliability || 0) / 20) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Verified prices; penalty applied if any prices are null
                  </span>
                </div>

                {/* 3. Inventory Confidence */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">
                      Inventory Confidence
                    </span>
                    <span className="font-mono font-bold text-zinc-100">
                      {scoreBreakdown?.inventoryConfidence || 0} / 20
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${(Math.max(0, scoreBreakdown?.inventoryConfidence || 0) / 20) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Explicit stock counts; penalty if stock counts are null
                  </span>
                </div>

                {/* 4. Policy Readiness */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">
                      Policy Readiness
                    </span>
                    <span className="font-mono font-bold text-zinc-100">
                      {scoreBreakdown?.policyReadiness || 0} / 20
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${((scoreBreakdown?.policyReadiness || 0) / 20) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Verified refund terms (10 pts) + delivery coverage (10 pts)
                  </span>
                </div>

                {/* 5. Data Consistency */}
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col gap-2 sm:col-span-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">
                      Data Consistency
                    </span>
                    <span className="font-mono font-bold text-zinc-100">
                      {scoreBreakdown?.dataConsistency || 0} / 20
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${((scoreBreakdown?.dataConsistency || 0) / 20) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Starts at 20; -10 deduction per unresolved consistency discrepancy
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Policies Quick Verification Bar */}
        <section className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-purple-400" />
                Operational Policies & Legal Disclaimers
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                AI buyers require verified refund and delivery terms to execute
                automated transactions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map((pol) => (
              <div
                key={pol.id}
                className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {pol.type} Policy
                  </span>
                  {pol.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Draft / Unverified
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed italic">
                  &ldquo;{pol.content}&rdquo;
                </p>

                {!pol.isVerified && (
                  <div className="flex justify-end pt-2 border-t border-zinc-800/80">
                    <button
                      onClick={() =>
                        handleResolveAction({
                          action: 'APPROVE_POLICY',
                          policyId: pol.id,
                          merchantId: merchant?.id,
                          type: pol.type,
                          content: pol.content || '',
                        })
                      }
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all shadow-md shadow-purple-950 disabled:opacity-50"
                    >
                      Approve & Verify Policy
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Actionable Issues Feed */}
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Actionable Remediation Feed
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Human-in-the-loop verification. Review AI explanations and authorize
                data points to unlock readiness gates.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
              <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
                {unresolvedIssues.length} Pending
              </span>
              <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-emerald-400">
                {issues.length - unresolvedIssues.length} Resolved
              </span>
            </div>
          </div>

          {unresolvedIssues.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900/40 border border-emerald-500/20 p-10 flex flex-col items-center justify-center text-center gap-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">
                All Readiness Issues Resolved!
              </h3>
              <p className="text-xs text-zinc-400 max-w-md">
                Catalog data is completely verified, operational policies are active,
                and zero discrepancies remain.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Critical Issues */}
              {criticalIssues.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
                      Critical Invariant Blockers ({criticalIssues.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {criticalIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        products={products}
                        onResolve={handleResolveAction}
                        isResolving={actionLoading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* High Issues */}
              {highIssues.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                      High Priority Issues ({highIssues.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {highIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        products={products}
                        onResolve={handleResolveAction}
                        isResolving={actionLoading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Medium Issues */}
              {mediumIssues.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400 font-mono">
                      Medium Improvements ({mediumIssues.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {mediumIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        products={products}
                        onResolve={handleResolveAction}
                        isResolving={actionLoading}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Live Catalog Table */}
        <section className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-6 flex flex-col gap-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-400" />
                Live Merchant Products Catalog
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Current catalog records reflecting real-time human verification.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 text-zinc-400 font-mono uppercase tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Price Verified</th>
                  <th className="py-3 px-4">Inventory</th>
                  <th className="py-3 px-4">Inv Verified</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">
                      {p.name}
                      {p.isEggless && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Eggless
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {p.price !== null ? `₹${p.price}` : (
                        <span className="text-rose-400">null</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {p.priceVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-zinc-400">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {p.inventory !== null ? `${p.inventory} boxes` : (
                        <span className="text-rose-400">null</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {p.inventoryVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-zinc-400">No</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.status !== 'VERIFIED' ? (
                        <button
                          onClick={() =>
                            handleResolveAction({
                              action: 'VERIFY_PRODUCT',
                              productId: p.id,
                              price: p.price ?? 200,
                              inventory: p.inventory ?? 10,
                            })
                          }
                          disabled={actionLoading}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-emerald-600 hover:text-white text-zinc-300 text-[11px] font-medium transition-all disabled:opacity-50"
                        >
                          Verify Product
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-mono">
                          Locked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Immutable System Audit Ledger */}
        <section id="audit-ledger" className="w-full">
          <AuditFeed merchantSlug={merchant?.slug || 'sweet-crumbs'} />
        </section>
      </main>
    </div>
  );
}
