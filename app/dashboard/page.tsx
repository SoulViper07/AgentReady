'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Store,
  MapPin,
  Phone,
  Layers,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  FileCheck2,
  ShieldCheck,
  ShieldAlert,
  ShoppingBag,
  Binary,
  ArrowRight,
  Truck,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { IssueCard } from '../../components/IssueCard';
import { AuditFeed } from '../../components/AuditFeed';
import { Navbar } from '../../components/Navbar';
import { AuthorityTag } from '../../components/AuthorityTag';
import { PipelineRail } from '../../components/PipelineRail';
import { motion, useSpring } from 'framer-motion';
import { Spotlight } from '../../components/ui/Spotlight';

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
  description?: string | null;
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

function AnimatedScoreText({ value }: { value: number }) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    return spring.on('change', (latest) => {
      setDisplayValue(Math.round(latest));
    });
  }, [spring]);

  return <>{displayValue}</>;
}

function ReadinessRing({ score }: { score: number }) {
  const radius = 44;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (circumference * Math.min(100, Math.max(0, score))) / 100;

  const strokeColor =
    score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e';

  const isPassing = score >= 80;

  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center">
      {/* Invariant bloom: smooth emerald pulsing ring when score >= 80 */}
      {isPassing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: [0, 0.55, 0],
            scale: [0.95, 1.15, 1.25],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatDelay: 1.5,
            ease: 'easeOut',
          }}
          className="absolute inset-0 rounded-full bg-emerald-500/25 blur-md pointer-events-none"
        />
      )}
      <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 110 110">
        {/* Background track */}
        <circle
          cx="55"
          cy="55"
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800/90 fill-transparent"
        />
        {/* Progress bar */}
        <circle
          cx="55"
          cy="55"
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="fill-transparent transition-all duration-700 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
        <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          <AnimatedScoreText value={score} />
        </span>
        <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
          / 100
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'merchant' | 'inspector'>('merchant');
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [quickVerifying, setQuickVerifying] = useState(false);

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

  const handleQuickVerifyAll = async () => {
    setQuickVerifying(true);
    setStatusMessage(null);
    try {
      // 1. Fetch current live merchant state, products, and issues
      const readRes = await fetch(
        `/api/readiness?slug=${merchant?.slug || 'sweet-crumbs'}`
      );
      const readData = await readRes.json();

      // 2. Authorise and verify each product
      for (const p of readData.products || []) {
        await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'VERIFY_PRODUCT',
            productId: p.id,
            price: p.price ?? 220,
            inventory: p.inventory ?? 10,
            merchantSlug: merchant?.slug || 'sweet-crumbs',
          }),
        });
      }

      // 3. Approve refund policy
      const policyIssue = readData.issues?.find(
        (i: { category: string; resolved: boolean }) =>
          i.category === 'POLICY' && !i.resolved
      );
      await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE_POLICY',
          merchantSlug: merchant?.slug || 'sweet-crumbs',
          policyId: readData.policies?.[0]?.id,
          type: 'REFUND',
          content:
            'Due to the fresh, perishable nature of our artisan baked goods, all sales are final upon dispatch. If an item arrives damaged, notify us within 2 hours with photos for a full replacement or refund.',
        }),
      });

      // 4. Resolve price consistency conflict with authoritative 250
      const conflictIssue = readData.issues?.find(
        (i: { category: string; title?: string; resolved: boolean }) =>
          (i.category === 'CONSISTENCY' ||
            i.title?.toLowerCase().includes('conflict')) &&
          !i.resolved
      );
      const signatureProduct = readData.products?.find(
        (p: { name?: string }) => p.name?.toLowerCase().includes('signature')
      );

      await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESOLVE_CONFLICT',
          issueId: conflictIssue?.id,
          productId: signatureProduct?.id,
          authoritativePrice: 250,
          merchantSlug: merchant?.slug || 'sweet-crumbs',
        }),
      });

      await fetchReadiness();
      setStatusMessage(
        'All catalog items, policies, and prices verified successfully!'
      );
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      console.error('Quick verify error:', err);
      const msg = err instanceof Error ? err.message : 'Quick verify failed';
      setStatusMessage(msg);
    } finally {
      setQuickVerifying(false);
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
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-breathe" />
            <span>Transactable by AI Buyers</span>
          </div>
        );
      case 'CONDITIONALLY_READY':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-breathe" />
            <span>Conditionally Ready</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-breathe" />
            <span>Blocked from AI Orders</span>
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
      <div className="min-h-screen bg-[#0E0F12] text-stone-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span>Loading Merchant Readiness Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0F12] text-stone-100 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navbar */}
      <Navbar
        merchantStatus={merchant?.transactionStatus}
        merchantScore={merchant?.readinessScore}
        onReset={fetchReadiness}
        onRefresh={fetchReadiness}
        statusMessage={statusMessage}
      />

      {/* Main Responsive Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        {/* Top Hero & Readiness Header */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#181A20] via-[#141519] to-[#0E0F12] border border-white/[0.08] p-5 sm:p-7 shadow-2xl shadow-black/30 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <Spotlight status={merchant?.transactionStatus || 'NOT_READY'} />

          {/* Brand & Store Info */}
          <div className="relative z-10 flex items-start gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-stone-800 to-[#181A20] border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Store className="w-6 h-6 sm:w-8 sm:h-8 text-amber-300" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-100 via-stone-100 to-stone-400 bg-clip-text text-transparent">
                  {merchant?.name || 'Sweet Crumbs'}
                </h1>
                {getStatusBadge(merchant?.transactionStatus)}
              </div>
              {/* Clean, wrap-friendly horizontal metadata strip with micro-icons and stone-400 typography */}
              <div className="flex items-center gap-x-4 gap-y-1.5 text-xs text-stone-400 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{merchant?.location || 'Chandannagar & Chuchura'}</span>
                </span>
                <span className="hidden xs:inline text-stone-700">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{merchant?.contactPhone || '+91 8697774043'}</span>
                </span>
                <span className="hidden xs:inline text-stone-700">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{products.length} Products Cataloged</span>
                </span>
                <span className="hidden xs:inline text-stone-700">•</span>
                <Link
                  href="/ingest"
                  className="inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Ingest Studio</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Readiness Ring & Status Message (Elevated glassmorphic surface) */}
          {(() => {
            const verifiedProductsCount = products.filter(
              (p) => p.priceVerified && p.inventoryVerified
            ).length;
            const isZeroState =
              (!merchant?.readinessScore || merchant.readinessScore === 0) &&
              verifiedProductsCount === 0;

            return (
              <div className="relative z-10 flex items-center gap-4 sm:gap-5 bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-inner">
                <ReadinessRing score={merchant?.readinessScore || 0} />
                <div className="flex flex-col gap-1 max-w-xs">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-400">
                    AI Commerce Readiness
                  </span>
                  <p className="text-xs text-stone-300 leading-relaxed font-medium">
                    {isZeroState
                      ? 'Readiness Inactive: Awaiting data ingestion or verification'
                      : unresolvedIssues.length > 0
                      ? `Resolve ${unresolvedIssues.length} item${
                          unresolvedIssues.length === 1 ? '' : 's'
                        } below to unlock autonomous orders via Razorpay.`
                      : 'All catalog items & policies verified. Live and discoverable by autonomous AI buyers.'}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400 font-mono">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        verifiedProductsCount > 0
                          ? 'bg-emerald-400'
                          : 'bg-stone-600'
                      }`}
                    />
                    <span>
                      {verifiedProductsCount} of {products.length} Products Verified
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Dual-View Mode Switcher Banner (iOS Segmented Pill Control) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span className="font-semibold text-stone-200">Active View:</span>
            <span className="text-stone-400 hidden xs:inline">
              {viewMode === 'merchant'
                ? 'Human-centric commerce feed • Zero code syntax'
                : 'Judges instrumentation • Zod provenance, AST invariants & audit ledger'}
            </span>
          </div>

          {/* iOS-Style Native Segmented Control with Framer Motion Sliding Pill */}
          <div className="w-full sm:w-auto sm:min-w-[320px] grid grid-cols-2 p-1 bg-[#181A20] border border-white/[0.08] rounded-2xl shadow-lg shadow-black/20 relative">
            <button
              type="button"
              onClick={() => setViewMode('merchant')}
              className={`relative py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] tactile-btn ${
                viewMode === 'merchant'
                  ? 'text-amber-300'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {viewMode === 'merchant' && (
                <motion.div
                  layoutId="activeDashboardViewTab"
                  className="absolute inset-0 bg-amber-500/15 border border-amber-500/30 rounded-xl shadow-sm"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>Merchant View</span>
                {unresolvedIssues.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono">
                    {unresolvedIssues.length}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('inspector')}
              className={`relative py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] tactile-btn ${
                viewMode === 'inspector'
                  ? 'text-stone-200'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {viewMode === 'inspector' && (
                <motion.div
                  layoutId="activeDashboardViewTab"
                  className="absolute inset-0 bg-stone-700/40 border border-white/[0.1] rounded-xl shadow-sm"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Binary className="w-3.5 h-3.5 shrink-0" />
                <span>Inspector (Judges)</span>
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: MERCHANT VIEW (Human-Centric Commerce Feed)       */}
        {/* ========================================================= */}
        {viewMode === 'merchant' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Main Column: Action Required Feed (7 or 8 Cols) */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#F8F9FA] flex items-center gap-2.5">
                    <ShoppingBag className="w-5 h-5 text-emerald-400" />
                    Resolve to Sell
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Authorise catalog ground truth to permit autonomous AI buyers
                    to place instant verified orders.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {unresolvedIssues.length > 0 && (
                    <button
                      type="button"
                      onClick={handleQuickVerifyAll}
                      disabled={quickVerifying}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 border border-emerald-500/30 transition-all cursor-pointer"
                    >
                      {quickVerifying ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                      )}
                      <span>Quick Verify All (Demo)</span>
                    </button>
                  )}
                  <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#181A20] border border-white/[0.08] text-stone-300">
                    {unresolvedIssues.length} Action Items
                  </span>
                </div>
              </div>

              {/* Celebration Card when All Resolved */}
              {unresolvedIssues.length === 0 ? (
                <div className="rounded-3xl bg-gradient-to-b from-[#181A20] to-[#121316] border border-emerald-500/30 p-8 sm:p-10 flex flex-col items-center justify-center text-center gap-4 shadow-xl shadow-black/20">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#F8F9FA]">
                      All Catalog Items &amp; Policies Verified!
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-400 max-w-md mt-1 leading-relaxed">
                      Your store has passed all deterministic readiness gates.
                      Autonomous AI buyers can now discover your products and
                      execute instant orders via Razorpay.
                    </p>
                  </div>
                  <Link
                    href="/agent-demo"
                    className="mt-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                  >
                    <span>Launch AI Buyer Simulator</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                /* Sleek Action Items */
                <div className="flex flex-col gap-4">
                  {unresolvedIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      products={products}
                      onResolve={handleResolveAction}
                      isResolving={actionLoading}
                      mode="merchant"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right / Secondary Column: Live Catalog Snapshot & Logistics (5 or 4 Cols) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
              {/* Live Catalog Snapshot Card (Stripe / Shopify Commerce Polish) */}
              <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#F8F9FA]">
                        Live Catalog Snapshot
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        {products.length} cataloged product{products.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/ingest"
                    className="min-h-[30px] px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>+ Ingest Studio</span>
                  </Link>
                </div>

                <div className="flex flex-col gap-3">
                  {products.map((p) => {
                    const isVerified = p.priceVerified && p.inventoryVerified;
                    return (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-xl bg-[#121316] border border-white/[0.06] hover:border-stone-700/80 transition-all flex flex-col gap-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#181A20] to-[#141519] border border-white/[0.08] flex items-center justify-center shrink-0 text-base shadow-inner">
                              {p.name.toLowerCase().includes('choco') || p.name.toLowerCase().includes('cookie')
                                ? '🍪'
                                : p.name.toLowerCase().includes('croissant')
                                ? '🥐'
                                : p.name.toLowerCase().includes('sourdough') || p.name.toLowerCase().includes('bread')
                                ? '🥖'
                                : p.name.toLowerCase().includes('brew') || p.name.toLowerCase().includes('latte') || p.name.toLowerCase().includes('coffee')
                                ? '☕'
                                : '✨'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-bold text-[#F8F9FA] tracking-tight">
                                  {p.name}
                                </h4>
                                {p.isEggless && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                    Eggless
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">
                                {p.description || 'Artisan baked specialty'}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold">
                                <AlertTriangle className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Commerce Metrics Strip: Price Badge & Stock Counter */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-stone-500 text-[11px]">Price:</span>
                            {p.price !== null ? (
                              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                ₹{p.price}
                              </span>
                            ) : (
                              <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 text-[11px] font-semibold">
                                Unstated (Null)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-stone-500 text-[11px]">Inventory:</span>
                            {p.inventory !== null ? (
                              <span className="font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                {p.inventory} in stock
                              </span>
                            ) : (
                              <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 text-[11px] font-semibold">
                                Unverified Stock
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Logistics & Operations Card */}
              <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4">
                <div className="flex items-center gap-2 pb-3 border-b border-white/[0.08]">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-[#F8F9FA]">
                    Logistics &amp; Fulfillment
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121316] border border-white/[0.06]">
                    <span className="text-stone-400">Delivery Territory</span>
                    <span className="text-[#F8F9FA] font-medium">
                      Chandannagar &amp; Chuchura
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121316] border border-white/[0.06]">
                    <span className="text-stone-400">Merchant Contact</span>
                    <span className="text-[#F8F9FA] font-medium">
                      +91 8697774043
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121316] border border-white/[0.06]">
                    <span className="text-stone-400">Payment Gateway</span>
                    <span className="text-emerald-400 font-medium">
                      Razorpay UPI &amp; Cards (Active)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#121316] border border-white/[0.06]">
                    <span className="text-stone-400">Cart Reservation</span>
                    <span className="text-amber-300 font-medium">
                      10-Minute Inventory Hold
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Buyer Simulator CTA */}
              <div className="rounded-2xl bg-gradient-to-br from-[#181A20] via-[#141519] to-[#0E0F12] border border-amber-500/25 p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Test Store with AI Buyers</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Experience how autonomous LLM agents discover your verified
                  products, parse dietary preferences, and propose orders.
                </p>
                <Link
                  href="/agent-demo"
                  className="w-full mt-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <span>Launch AI Buyer Playground</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Immutable Audit Ledger in Merchant View */}
        {viewMode === 'merchant' && (
          <div id="audit-ledger" className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-stone-400" />
                <div>
                  <h3 className="text-sm font-semibold text-[#F8F9FA]">
                    Immutable System Audit Ledger
                  </h3>
                  <p className="text-xs text-stone-400">
                    Cryptographic ledger recording all verification, score
                    evaluations, and Razorpay transactions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditDrawer(!showAuditDrawer)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#121316] hover:bg-[#141519] text-stone-200 text-xs font-semibold flex items-center gap-2 border border-white/[0.08] transition-colors cursor-pointer"
              >
                <span>
                  {showAuditDrawer ? 'Hide Audit Ledger' : 'View Audit Ledger'}
                </span>
                {showAuditDrawer ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {showAuditDrawer && (
              <div className="pt-4 border-t border-slate-800/80 animate-in fade-in duration-300">
                <AuditFeed merchantSlug={merchant?.slug || 'sweet-crumbs'} />
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: INSPECTOR MODE (Judges Technical Instrumentation)  */}
        {/* ========================================================= */}
        {viewMode === 'inspector' && (
          <div className="flex flex-col gap-8">
            {/* Top Pipeline Rail Tracker */}
            <PipelineRail
              merchantStatus={merchant?.transactionStatus || 'NOT_READY'}
              readinessScore={merchant?.readinessScore || 0}
              unresolvedIssuesCount={unresolvedIssues.length}
              verifiedProductsCount={
                products.filter((p) => p.priceVerified && p.inventoryVerified)
                  .length
              }
              totalProductsCount={products.length}
            />

            {/* Technical Readiness Overview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Score Card: 4 Cols */}
              <div className="lg:col-span-4 rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-6 flex flex-col justify-between shadow-xl shadow-black/20">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Readiness Index
                    </span>
                    <span className="text-xs font-mono text-stone-400">
                      Deterministic v1.0
                    </span>
                  </div>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span
                      className={`text-6xl font-extrabold tracking-tight ${
                        getScoreColor(merchant?.readinessScore || 0).split(' ')[0]
                      }`}
                    >
                      {merchant?.readinessScore || 0}
                    </span>
                    <span className="text-2xl font-medium text-stone-400">
                      / 100
                    </span>
                  </div>

                  <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                    {merchant?.transactionStatus === 'READY'
                      ? 'Autonomous AI buyers are unlocked to place instant, verified cart transactions.'
                      : merchant?.transactionStatus === 'CONDITIONALLY_READY'
                      ? 'Orders permitted with manual escrow holds or conditional review.'
                      : 'Catalog invariant gates failed. AI buyer carts will be actively blocked at checkout.'}
                  </p>
                </div>

                {/* Invariant Hard Gates */}
                <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                      Invariant Hard Gates
                    </span>
                    <AuthorityTag
                      type="FINTECH_GATE"
                      compact
                      customLabel="Zero-LLM Hard Gates"
                    />
                  </div>

                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#121316] border border-white/[0.06]">
                      <span className="flex items-center gap-2 text-stone-300">
                        <Lock className="w-3.5 h-3.5 text-stone-400" />
                        Verified Price (&gt; 0)
                      </span>
                      {products.some(
                        (p) => p.priceVerified && p.price && p.price > 0
                      ) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#121316] border border-white/[0.06]">
                      <span className="flex items-center gap-2 text-stone-300">
                        <Lock className="w-3.5 h-3.5 text-stone-400" />
                        Verified Inventory (&gt; 0)
                      </span>
                      {products.some(
                        (p) =>
                          p.inventoryVerified && p.inventory && p.inventory > 0
                      ) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#121316] border border-white/[0.06]">
                      <span className="flex items-center gap-2 text-stone-300">
                        <FileCheck2 className="w-3.5 h-3.5 text-stone-400" />
                        Verified Policy
                      </span>
                      {policies.some((p) => p.isVerified) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#121316] border border-white/[0.06]">
                      <span className="flex items-center gap-2 text-stone-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
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

                  {invariants &&
                    !invariants.passed &&
                    invariants.failures.length > 0 && (
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
              <div className="lg:col-span-8 rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-6 shadow-xl shadow-black/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                        Deterministic Score Model Breakdown
                      </h3>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        100-point index calculated across 5 strict categories (20 pts
                        max each)
                      </p>
                    </div>
                    <AuthorityTag
                      type="DETERMINISTIC"
                      compact
                      customLabel="Zero-LLM Math Rules"
                      tooltip="Calculated using strict mathematical formulas. Zero LLM scoring bias."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {/* 1. Product Data */}
                    <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06] flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-300 font-medium">
                          Product Data
                        </span>
                        <AuthorityTag
                          type="DETERMINISTIC"
                          compact
                          tooltip="Calculated using strict mathematical formulas. Zero LLM scoring bias."
                        />
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[11px] text-stone-400 font-mono">
                          Weight (20%)
                        </span>
                        <span className="font-mono font-bold text-stone-100">
                          {scoreBreakdown?.productData || 0} / 20
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#181A20] overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${((scoreBreakdown?.productData || 0) / 20) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {scoreBreakdown?.productData === 20
                          ? 'All catalog items fully structured.'
                          : 'Items missing title, description or dietary flags.'}
                      </span>
                    </div>

                    {/* 2. Price Reliability */}
                    <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06] flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-300 font-medium">
                          Price Reliability
                        </span>
                        <AuthorityTag
                          type="DETERMINISTIC"
                          compact
                          tooltip="Calculated using strict mathematical formulas. Zero LLM scoring bias."
                        />
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[11px] text-stone-400 font-mono">
                          Weight (20%)
                        </span>
                        <span className="font-mono font-bold text-stone-100">
                          {scoreBreakdown?.priceReliability || 0} / 20
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#181A20] overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((scoreBreakdown?.priceReliability || 0) / 20) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {scoreBreakdown?.priceReliability === 20
                          ? '100% prices verified ground truth.'
                          : 'Contains unverified or conflicting pricing.'}
                      </span>
                    </div>

                    {/* 3. Inventory Confidence */}
                    <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06] flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-300 font-medium">
                          Inventory Confidence
                        </span>
                        <AuthorityTag
                          type="DETERMINISTIC"
                          compact
                          tooltip="Calculated using strict mathematical formulas. Zero LLM scoring bias."
                        />
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[11px] text-stone-400 font-mono">
                          Weight (20%)
                        </span>
                        <span className="font-mono font-bold text-stone-100">
                          {scoreBreakdown?.inventoryConfidence || 0} / 20
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#181A20] overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((scoreBreakdown?.inventoryConfidence || 0) / 20) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {scoreBreakdown?.inventoryConfidence === 20
                          ? 'All products have confirmed positive stock.'
                          : 'Missing explicit stock counts.'}
                      </span>
                    </div>

                    {/* 4. Policy Readiness */}
                    <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06] flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-300 font-medium">
                          Policy Readiness
                        </span>
                        <AuthorityTag
                          type="DETERMINISTIC"
                          compact
                          tooltip="Calculated using strict mathematical formulas. Zero LLM scoring bias."
                        />
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[11px] text-stone-400 font-mono">
                          Weight (20%)
                        </span>
                        <span className="font-mono font-bold text-stone-100">
                          {scoreBreakdown?.policyReadiness || 0} / 20
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#181A20] overflow-hidden">
                        <div
                          className="h-full bg-stone-400 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((scoreBreakdown?.policyReadiness || 0) / 20) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-stone-400">
                        Verified refund terms (10 pts) + delivery coverage (10 pts)
                      </span>
                    </div>

                    {/* 5. Data Consistency */}
                    <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06] flex flex-col gap-2 sm:col-span-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-stone-300 font-medium">
                          Data Consistency
                        </span>
                        <AuthorityTag
                          type="DETERMINISTIC"
                          compact
                          tooltip="Calculated using strict mathematical formulas. Zero LLM scoring bias."
                        />
                      </div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-[11px] text-stone-400 font-mono">
                          Weight (20%)
                        </span>
                        <span className="font-mono font-bold text-stone-100">
                          {scoreBreakdown?.dataConsistency || 0} / 20
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#181A20] overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              ((scoreBreakdown?.dataConsistency || 0) / 20) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-stone-400">
                        Starts at 20; -10 deduction per unresolved consistency
                        discrepancy
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Policies Quick Verification Bar */}
            <section className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-6 flex flex-col gap-4 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#F8F9FA] flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-amber-400" />
                    Operational Policies &amp; Legal Disclaimers
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    AI buyers require verified refund and delivery terms to
                    execute automated transactions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {policies.map((pol) => (
                  <div
                    key={pol.id}
                    className="p-4 rounded-xl bg-[#121316] border border-white/[0.06] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#181A20] text-stone-300 border border-white/[0.06]">
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

                    <p className="text-xs text-stone-300 leading-relaxed italic">
                      &ldquo;{pol.content}&rdquo;
                    </p>

                    {!pol.isVerified && (
                      <div className="flex justify-end pt-2 border-t border-white/[0.06]">
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
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-all shadow-md shadow-amber-950 disabled:opacity-50 cursor-pointer"
                        >
                          Approve &amp; Verify Policy
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Actionable Remediation Feed in Inspector Mode */}
            <section className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#F8F9FA] flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    Actionable Remediation Feed (AST Provenance)
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Human-in-the-loop verification. Review AI explanations, raw
                    trace lines, and authorize ground truth.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-stone-400">
                  <span className="px-2 py-1 rounded bg-[#121316] border border-white/[0.08]">
                    {unresolvedIssues.length} Pending
                  </span>
                  <span className="px-2 py-1 rounded bg-[#121316] border border-white/[0.08] text-emerald-400">
                    {issues.length - unresolvedIssues.length} Resolved
                  </span>
                </div>
              </div>

              {unresolvedIssues.length === 0 ? (
                <div className="rounded-2xl bg-[#181A20]/90 border border-emerald-500/20 p-10 flex flex-col items-center justify-center text-center gap-3 shadow-xl shadow-black/20">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                  <h3 className="text-base font-semibold text-[#F8F9FA]">
                    All Readiness Issues Resolved!
                  </h3>
                  <p className="text-xs text-stone-400 max-w-md">
                    Catalog data is completely verified, operational policies
                    are active, and zero discrepancies remain.
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
                            mode="inspector"
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
                            mode="inspector"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medium Issues */}
                  {mediumIssues.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
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
                            mode="inspector"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Live Catalog Table (Raw Inspector View) */}
            <section className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-6 flex flex-col gap-4 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#F8F9FA] flex items-center gap-2">
                    <Store className="w-5 h-5 text-emerald-400" />
                    Live Merchant Products Catalog Table
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Current catalog records reflecting real-time human
                    verification.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-[#121316] text-stone-400 font-mono uppercase tracking-wider border-b border-white/[0.08]">
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
                  <tbody className="divide-y divide-white/[0.04]">
                    {products.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-[#141519] transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-[#F8F9FA]">
                          {p.name}
                          {p.isEggless && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Eggless
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {p.price !== null ? (
                            `₹${p.price}`
                          ) : (
                            <span className="text-rose-400">null</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.priceVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-stone-400">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {p.inventory !== null ? (
                            `${p.inventory} boxes`
                          ) : (
                            <span className="text-rose-400">null</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {p.inventoryVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-stone-400">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.status === 'VERIFIED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-[#181A20] text-stone-400 border border-white/[0.06]'
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
                              className="px-2.5 py-1 rounded bg-[#181A20] hover:bg-emerald-600 hover:text-white text-stone-300 text-[11px] font-medium border border-white/[0.08] transition-all disabled:opacity-50 cursor-pointer"
                            >
                              Verify Product
                            </button>
                          ) : (
                            <span className="text-[11px] text-stone-400 font-mono">
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

            {/* Immutable System Audit Ledger (Full in Inspector View) */}
            <section id="audit-ledger" className="w-full">
              <AuditFeed merchantSlug={merchant?.slug || 'sweet-crumbs'} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
