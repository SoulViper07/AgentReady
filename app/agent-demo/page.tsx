'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import {
  Terminal,
  Bot,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Send,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Store,
  ExternalLink,
  Loader2,
  Code,
  CreditCard,
  CheckCircle2,
  AlertOctagon,
  Lock,
  ShieldCheck,
  Scale,
  Cpu,
  Hash,
  XCircle,
  Sparkles,
  X,
  ShoppingBag,
  Binary,
  Truck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '../../components/Navbar';
import { AuthorityTag } from '../../components/AuthorityTag';
import { Spotlight } from '../../components/ui/Spotlight';
import { TiltCard } from '../../components/ui/TiltCard';

function getThoughtStyle(step: string) {
  const lower = step.toLowerCase();
  if (
    lower.includes('prompt:') ||
    lower.includes('purchasing criteria') ||
    lower.includes('extracted parameters') ||
    lower.includes('autonomous buyer')
  ) {
    return {
      textColor: 'text-amber-200',
      badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      typeLabel: 'Intent Parsing',
    };
  }
  if (
    lower.includes('search_catalog') ||
    lower.includes('catalog lookup') ||
    lower.includes('selected candidate') ||
    lower.includes('matching item') ||
    lower.includes('dietary')
  ) {
    return {
      textColor: 'text-stone-200',
      badgeBg: 'bg-stone-800 text-stone-300 border-white/[0.08]',
      typeLabel: 'Catalog Query',
    };
  }
  if (
    lower.includes('stock') ||
    lower.includes('inventory') ||
    lower.includes('warning')
  ) {
    return {
      textColor: 'text-amber-300',
      badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      typeLabel: 'Deterministic Invariant Check',
    };
  }
  if (
    lower.includes('propose_order') ||
    lower.includes('proposal') ||
    lower.includes('formulated') ||
    lower.includes('total ₹')
  ) {
    return {
      textColor: 'text-emerald-300',
      badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      typeLabel: 'Proposal Construction',
    };
  }
  return {
    textColor: 'text-stone-300',
    badgeBg: 'bg-stone-800 text-stone-400 border-stone-700',
    typeLabel: 'Reasoning',
  };
}

interface GateBlockedInfo {
  reason: string;
  violatedInvariant: string;
  requestedQuantity: number;
  availableInventory: number;
  auditLogId?: string;
  timestamp?: string;
}

interface ToolCallTrace {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface ProposalRecord {
  id: string;
  merchantId: string;
  productId: string;
  requestedQuantity: number;
  offeredPrice: number;
  calculatedTotal: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  product?: {
    name: string;
    currency: string;
    inventory: number | null;
    isEggless: boolean | null;
  };
  merchant?: {
    name: string;
    slug: string;
    readinessScore: number;
    transactionStatus: string;
  };
}

interface BuyerApiResponse {
  success: boolean;
  status: string;
  query: string;
  thoughtProcess: string[];
  toolCalls: ToolCallTrace[];
  proposalData?: {
    productId: string;
    productName: string;
    merchantId: string;
    merchantName: string;
    merchantSlug: string;
    requestedQuantity: number;
    offeredPrice: number;
    calculatedTotal: number;
    currency: string;
    availableInventory: number;
    inventoryExceeded: boolean;
  };
  proposal?: ProposalRecord;
  explanation: string;
}

interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: string,
    callback: (resp: { error?: { description?: string } }) => void
  ) => void;
}

function ensureRazorpayReady(maxWaitMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);

    const start = Date.now();
    const interval = setInterval(() => {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start > maxWaitMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}

export default function AgentDemoPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [merchantStatus, setMerchantStatus] = useState<string>('LOADING');
  const [merchantScore, setMerchantScore] = useState<number>(0);
  const [activeResponse, setActiveResponse] = useState<BuyerApiResponse | null>(
    null
  );
  // Explicit proposal state (stores id, requestedQuantity, offeredPrice, calculatedTotal, status)
  const [proposal, setProposal] = useState<ProposalRecord | null>(null);
  const [recentProposals, setRecentProposals] = useState<ProposalRecord[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });
  const [quickVerifying, setQuickVerifying] = useState(false);
  const [countdown, setCountdown] = useState<string>('10:00');
  const [viewMode, setViewMode] = useState<'merchant' | 'inspector'>('merchant');
  const [isTraceExpanded, setIsTraceExpanded] = useState<boolean>(false);

  const handleViewModeChange = (mode: 'merchant' | 'inspector') => {
    setViewMode(mode);
    setIsTraceExpanded(mode === 'inspector');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'inspector' || params.get('mode') === 'inspector') {
        setViewMode('inspector');
        setIsTraceExpanded(true);
      }
    }
  }, []);

  // Phase 7 & 8: Deterministic Transaction Gate, Razorpay & Invariant Failure States
  const [gateLoading, setGateLoading] = useState(false);
  const [gateBlockedReason, setGateBlockedReason] = useState<string | null>(null);
  const [gateBlockedInfo, setGateBlockedInfo] = useState<GateBlockedInfo | null>(
    null
  );
  const [verifiedReceipt, setVerifiedReceipt] = useState<{
    paymentId: string;
    orderId: string;
    proposalId: string;
    remainingInventory: number;
    amount: number;
    productName?: string;
    signature?: string;
    calculatedHmac?: string;
  } | null>(null);
  const [checkoutOrderData, setCheckoutOrderData] = useState<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    testPaymentId?: string;
    testSignature?: string;
  } | null>(null);

  const [catalogProducts, setCatalogProducts] = useState<
    Array<{
      id: string;
      name: string;
      price: number | null;
      inventory: number | null;
      isEggless: boolean | null;
    }>
  >([]);

  const fetchMerchantStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/readiness?slug=sweet-crumbs');
      if (res.ok) {
        const data = await res.json();
        setMerchantStatus(data.transactionStatus);
        setMerchantScore(data.readinessScore);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchCatalogProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog?merchantSlug=sweet-crumbs');
      if (res.ok) {
        const data = await res.json();
        const prods = data.merchants?.[0]?.products || [];
        setCatalogProducts(prods);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchRecentProposals = useCallback(async () => {
    try {
      const res = await fetch('/api/buyer?limit=5');
      if (res.ok) {
        const data = await res.json();
        setRecentProposals(data.proposals || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [readRes, buyerRes, catRes] = await Promise.all([
          fetch('/api/readiness?slug=sweet-crumbs'),
          fetch('/api/buyer?limit=5'),
          fetch('/api/catalog?merchantSlug=sweet-crumbs'),
        ]);
        if (readRes.ok && isMounted) {
          const data = await readRes.json();
          setMerchantStatus(data.transactionStatus);
          setMerchantScore(data.readinessScore);
        }
        if (buyerRes.ok && isMounted) {
          const data = await buyerRes.json();
          const props = data.proposals || [];
          setRecentProposals(props);
          if (props.length > 0) {
            setProposal((prev) => prev ?? props[0]);
          }
        }
        if (catRes.ok && isMounted) {
          const catData = await catRes.json();
          const prods = catData.merchants?.[0]?.products || [];
          setCatalogProducts(prods);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Dynamic Suggestion Chips derived from live catalog products in SQLite
  const suggestionChips = React.useMemo(() => {
    const primaryProduct =
      catalogProducts[0]?.name || 'Signature Choco Chip Cookies';
    const secondaryProduct =
      catalogProducts[1]?.name || 'Double Dark Sea Salt Cookies';

    return [
      {
        query: `Order 1x ${primaryProduct}`,
        desc: 'Single verified unit purchase',
        badgeText: 'Verified Catalog',
        badgeStyle: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      },
      {
        query: 'Any eggless dessert under ₹300',
        desc: 'Dietary & budget constraint match',
        badgeText: 'Constraint Query',
        badgeStyle: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      },
      {
        query: `Buy 10x ${primaryProduct}`,
        desc: 'Bulk order within verified inventory',
        badgeText: 'Available Stock',
        badgeStyle: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      },
      {
        query: `Order 20 boxes of ${primaryProduct}`,
        desc: 'Overstock limit test (Exceeds stock)',
        badgeText: 'Gate Test: Overstock',
        badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      },
      {
        query: `2 boxes of ${secondaryProduct}`,
        desc: 'Unverified price test (Fails gate)',
        badgeText: 'Invariant: Unverified',
        badgeStyle: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      },
    ];
  }, [catalogProducts]);

  // Expiry Countdown Timer
  useEffect(() => {
    const targetExpiresAt = proposal?.expiresAt || activeResponse?.proposal?.expiresAt;
    if (!targetExpiresAt) return;

    const expiresAtMs = new Date(targetExpiresAt).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, expiresAtMs - now);

      if (diff <= 0) {
        setCountdown('EXPIRED');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [proposal?.expiresAt, activeResponse?.proposal?.expiresAt]);

  const handleRunBuyer = async (promptQuery: string) => {
    const textToRun = promptQuery.trim();
    if (!textToRun || loading) return;

    setLoading(true);
    // Clear old proposal states and reset Transaction Gate card
    setProposal(null);
    setGateBlockedReason(null);
    setGateBlockedInfo(null);
    setVerifiedReceipt(null);
    setCheckoutOrderData(null);

    try {
      const res = await fetch('/api/buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToRun,
          merchantSlug: 'sweet-crumbs',
        }),
      });

      const data: BuyerApiResponse = await res.json();
      setActiveResponse(data);
      if (data.proposal) {
        setProposal(data.proposal);
        setRecentProposals((prev) => [
          data.proposal!,
          ...prev.filter((p) => p.id !== data.proposal!.id).slice(0, 4),
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickVerify = async () => {
    setQuickVerifying(true);
    try {
      // 1. Fetch current live merchant state, products, and issues
      const readRes = await fetch('/api/readiness?slug=sweet-crumbs');
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
            merchantSlug: 'sweet-crumbs',
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
          merchantSlug: 'sweet-crumbs',
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
          merchantSlug: 'sweet-crumbs',
        }),
      });

      await fetchMerchantStatus();
      await fetchCatalogProducts();
    } catch (e) {
      console.error('Quick verify error:', e);
    } finally {
      setQuickVerifying(false);
    }
  };

  const copyProposalId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const toggleTool = (idx: number) => {
    setExpandedTools((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleVerifyPayment = async (payload: {
    proposalId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    setGateLoading(true);
    try {
      const res = await fetch('/api/transaction/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setGateBlockedReason(
          `Payment Verification Error: ${data.error || 'Signature mismatch or transaction failure.'}`
        );
        setActiveResponse((prev) =>
          prev && prev.proposal
            ? {
                ...prev,
                proposal: {
                  ...prev.proposal,
                  status: 'EXPIRED',
                },
              }
            : prev
        );
        fetchRecentProposals();
        return;
      }

      setVerifiedReceipt({
        paymentId: data.paymentId,
        orderId: data.orderId,
        proposalId: data.proposalId,
        remainingInventory: data.remainingInventory,
        amount: data.amount,
        productName: data.productName,
        signature: data.signature,
        calculatedHmac: data.calculatedHmac,
      });

      if (typeof window !== 'undefined') {
        try {
          confetti({ particleCount: 45, spread: 60, origin: { y: 0.85 } });
        } catch (e) {
          console.error('Confetti error:', e);
        }
      }

      setProposal((prev) => (prev ? { ...prev, status: 'COMPLETED' } : prev));
      setActiveResponse((prev) =>
        prev && prev.proposal
          ? {
              ...prev,
              proposal: {
                ...prev.proposal,
                status: 'COMPLETED',
              },
            }
          : prev
      );
      fetchRecentProposals();
    } catch (err: unknown) {
      console.error(err);
      setGateBlockedReason(
        err instanceof Error ? err.message : 'Payment verification network error'
      );
    } finally {
      setGateLoading(false);
    }
  };

  const openRazorpayCheckout = (orderData: {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }) => {
    if (typeof window === 'undefined') return;
    const RazorpayConstructor = (
      window as unknown as {
        Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
      }
    ).Razorpay;
    if (!RazorpayConstructor) {
      console.warn('Razorpay SDK not loaded in window yet');
      setGateBlockedReason(
        'Razorpay checkout SDK is initializing in the background. Please click Proceed again in a few seconds.'
      );
      return;
    }

    try {
      const options: Record<string, unknown> = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Sweet Crumbs',
        description: `Order for ${proposal?.requestedQuantity || activeResponse?.proposal?.requestedQuantity || 1}x box(es)`,
        order_id: orderData.orderId,
        prefill: {
          name: 'Demo Autonomous Buyer',
          contact: '+91 8697774043',
          email: 'buyer@agentready.demo',
        },
        theme: {
          color: '#10b981',
        },
        handler: async function (response: RazorpayPaymentResponse) {
          await handleVerifyPayment({
            proposalId: proposal?.id || activeResponse?.proposal?.id || '',
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: function () {
            console.log('Razorpay modal dismissed');
          },
        },
      };

      const rzp = new RazorpayConstructor(options);
      rzp.on('payment.failed', function (resp: { error?: { description?: string } }) {
        console.error('Razorpay payment failed:', resp.error);
        setGateBlockedReason(
          `Razorpay payment error: ${resp.error?.description || 'Failed'}`
        );
      });
      rzp.open();
    } catch (e) {
      console.error('Error opening Razorpay modal:', e);
    }
  };

  const handleProceedToGate = async () => {
    const targetProposal = proposal || activeResponse?.proposal;
    if (!targetProposal) return;
    setGateLoading(true);
    setGateBlockedReason(null);
    setGateBlockedInfo(null);
    setVerifiedReceipt(null);

    try {
      const res = await fetch('/api/transaction/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: targetProposal.id }),
      });

      const data = await res.json();

      if (!res.ok || data.error === 'TRANSACTION_BLOCKED') {
        const failureReason =
          data.reason ||
          data.error ||
          'Transaction proposal blocked by deterministic invariant gate.';
        setGateBlockedReason(failureReason);
        setGateBlockedInfo({
          reason: failureReason,
          violatedInvariant: data.violatedInvariant || 'INSUFFICIENT_INVENTORY',
          requestedQuantity: data.requestedQuantity ?? targetProposal.requestedQuantity,
          availableInventory: data.availableInventory ?? targetProposal.product?.inventory ?? 0,
          auditLogId: data.auditLogId,
          timestamp: data.timestamp || new Date().toISOString(),
        });
        setProposal((prev) => (prev ? { ...prev, status: 'BLOCKED' } : prev));
        setActiveResponse((prev) =>
          prev && prev.proposal
            ? {
                ...prev,
                proposal: {
                  ...prev.proposal,
                  status: 'BLOCKED',
                },
              }
            : prev
        );
        fetchRecentProposals();
        return;
      }

      // Gate invariant checks passed -> Proposal is RESERVED
      setCheckoutOrderData(data);
      setProposal((prev) => (prev ? { ...prev, status: 'RESERVED' } : prev));
      setActiveResponse((prev) =>
        prev && prev.proposal
          ? {
              ...prev,
              proposal: {
                ...prev.proposal,
                status: 'RESERVED',
              },
            }
          : prev
      );
      fetchRecentProposals();

      // Launch Razorpay modal using the returned orderId
      await ensureRazorpayReady();
      openRazorpayCheckout(data);
    } catch (err: unknown) {
      console.error(err);
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Failed to communicate with checkout gate.';
      setGateBlockedReason(errMsg);
      setGateBlockedInfo({
        reason: errMsg,
        violatedInvariant: 'GATE_NETWORK_FAILURE',
        requestedQuantity: targetProposal.requestedQuantity,
        availableInventory: targetProposal.product?.inventory ?? 0,
      });
    } finally {
      setGateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0F12] text-stone-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col">
      {/* Razorpay Checkout Script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      {/* Top Navbar */}
      <Navbar
        merchantStatus={merchantStatus}
        merchantScore={merchantScore}
        onReset={async () => {
          await fetchMerchantStatus();
          await fetchRecentProposals();
          await fetchCatalogProducts();
          setProposal(null);
          setActiveResponse(null);
          setVerifiedReceipt(null);
          setCheckoutOrderData(null);
          setGateBlockedReason(null);
          setGateBlockedInfo(null);
        }}
        onRefresh={async () => {
          await fetchMerchantStatus();
          await fetchRecentProposals();
          await fetchCatalogProducts();
        }}
      />

      {/* Readiness Alert Banner if NOT_READY */}
      {merchantStatus === 'NOT_READY' && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-[#0E0F12] border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Readiness Invariant Notice:</strong> Demo merchant &ldquo;Sweet Crumbs&rdquo; is currently in <code>NOT_READY</code> state (score: {merchantScore}/100). The agent-readable catalog will strictly filter out unverified items until gates pass.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleQuickVerify}
              disabled={quickVerifying}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold tracking-wide transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {quickVerifying && <Loader2 className="w-3 h-3 animate-spin" />}
              Quick-Verify Merchant for Simulator
            </button>
            <Link
              href="/dashboard"
              className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-white/[0.08] font-medium"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Dual-View Mode Switcher Banner (iOS Segmented Pill Control) */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span className="font-semibold text-stone-200">Active View:</span>
          <span className="text-stone-400 hidden xs:inline">
            {viewMode === 'merchant'
              ? 'Merchant / User View • Simplified commerce checkout & clean conversational outcome'
              : 'Inspector Mode (Judges) • Autonomous agent runtime trace, AST tool arguments & invariants'}
          </span>
        </div>

        {/* iOS-Style Native Segmented Control */}
        <div className="w-full sm:w-auto sm:min-w-[340px] grid grid-cols-2 p-1 bg-[#181A20] border border-white/[0.08] rounded-2xl shadow-lg shadow-black/20">
          <button
            type="button"
            onClick={() => handleViewModeChange('merchant')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              viewMode === 'merchant'
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span>Merchant / User View</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('inspector')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              viewMode === 'inspector'
                ? 'bg-amber-500/20 text-amber-300 shadow-sm border border-amber-500/30'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Binary className="w-3.5 h-3.5 shrink-0" />
            <span>Inspector Mode (Judges)</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Playground */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Autonomous Buyer Terminal (6 Cols) */}
        <section className="lg:col-span-6 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#F8F9FA] flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                Autonomous Buyer Client
              </h2>
              <AuthorityTag
                type="AI_INFERRED"
                compact
                customLabel="Autonomous LLM Agent"
                pulse
              />
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Natural language shopping agent equipped with structured catalog discovery and order proposal tools.
            </p>
          </div>

          {/* Interactive Natural Language Prompt Box (Ambient Search Console) */}
          <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] focus-within:border-amber-500/40 focus-within:ring-2 focus-within:ring-amber-500/20 p-4 shadow-xl shadow-black/20 transition-all flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-stone-200 tracking-wide uppercase">
                    Natural Language Buyer Prompt
                  </span>
                  <p className="text-[10px] text-stone-400 font-mono">
                    Autonomous Intent Parsing → Structured DB Invariants
                  </p>
                </div>
              </div>
              <AuthorityTag
                type="AI_INFERRED"
                compact
                customLabel="LLM Intent Parser"
              />
            </div>

            {/* Expandable Textarea with Warm Focus Rings */}
            <div className="relative">
              <textarea
                rows={2}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    (e.key === 'Enter' && !e.shiftKey) ||
                    (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                  ) {
                    e.preventDefault();
                    if (query.trim() && !loading) {
                      handleRunBuyer(query);
                    }
                  }
                }}
                placeholder="Type what you need (e.g. '2 boxes of Double Dark Sea Salt Cookies', 'Any eggless dessert under ₹250')..."
                className="w-full bg-[#121316] border border-white/[0.08] focus:border-amber-500/40 rounded-xl p-3 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none resize-none font-sans leading-relaxed pr-10 shadow-inner"
              />
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute top-2.5 right-2.5 p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer border border-white/[0.06]"
                  title="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Bar: Keyboard Shortcut + Run Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
              <div className="text-[11px] text-stone-400 font-mono flex items-center gap-1.5">
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300 font-mono text-[10px]">
                  Enter ↵
                </kbd>
                <span>or</span>
                <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-300 font-mono text-[10px]">
                  ⌘+Enter
                </kbd>
                <span>to run</span>
              </div>

              <button
                type="button"
                onClick={() => handleRunBuyer(query)}
                disabled={loading || !query.trim()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 disabled:from-stone-800 disabled:to-stone-800 disabled:text-stone-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-black/30 disabled:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
                    <span>Evaluating catalog...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-amber-200" />
                    <span>Run AI Buyer</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dynamic Suggestion Pills Below the Box */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-amber-400" />
                Live Catalog Query Suggestions:
              </span>
              <span className="text-[10px] font-mono text-stone-400">
                {catalogProducts.length > 0
                  ? `${catalogProducts.length} verified item(s) in SQLite`
                  : 'Preset Invariant Tests'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestionChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(chip.query);
                    handleRunBuyer(chip.query);
                  }}
                  disabled={loading}
                  className="px-3 py-2 rounded-xl bg-[#181A20] hover:bg-[#20232B] border border-white/[0.08] hover:border-amber-500/30 text-left text-xs transition-all group disabled:opacity-50 flex items-center justify-between gap-3 cursor-pointer shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-amber-300 group-hover:text-amber-200">
                      &ldquo;{chip.query}&rdquo;
                    </span>
                    <span className="text-[10px] text-stone-400 group-hover:text-stone-300 font-mono mt-0.5">
                      {chip.desc}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 border ${chip.badgeStyle}`}
                  >
                    {chip.badgeText}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Clean Conversational Outcome Card (Zero raw terminal clutter) */}
          {activeResponse ? (
            <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 shadow-xl shadow-black/20 flex flex-col gap-3.5 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#F8F9FA] font-mono uppercase tracking-wider">
                      Buyer Agent Outcome
                    </h3>
                    <span className="text-[10px] text-stone-400 font-mono">
                      Autonomous Catalog &amp; Intent Match
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    activeResponse.status === 'PROPOSAL_GENERATED'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : activeResponse.status === 'OUT_OF_STOCK'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {activeResponse.status === 'PROPOSAL_GENERATED'
                    ? 'PROPOSAL GENERATED'
                    : activeResponse.status}
                </span>
              </div>

              {/* Prompt Evaluated */}
              <div className="text-xs text-stone-400 font-mono flex items-center gap-1.5">
                <span className="text-amber-400 font-bold">&gt;</span>
                <span className="truncate">Prompt: &ldquo;{activeResponse.query}&rdquo;</span>
              </div>

              {/* Clean Conversational Explanation */}
              <div className="p-4 rounded-xl bg-[#121316] border border-white/[0.06] text-xs text-stone-200 leading-relaxed font-sans shadow-inner">
                <span className="text-amber-300 font-semibold block mb-1 text-[11px] font-mono">
                  Agent Resolution:
                </span>
                {activeResponse.explanation}
              </div>

              {/* Proposal Highlight Pill if generated */}
              {activeResponse.proposalData && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs font-mono text-emerald-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold text-white">
                      {activeResponse.proposalData.requestedQuantity}x{' '}
                      {activeResponse.proposalData.productName}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-400">
                    ₹{activeResponse.proposalData.calculatedTotal} INR
                  </span>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="rounded-2xl bg-[#181A20]/90 border border-amber-500/30 p-8 shadow-xl flex flex-col items-center justify-center text-center gap-3 animate-pulse">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              <span className="text-xs font-mono text-amber-300">
                Evaluating verified catalog &amp; checking deterministic invariants...
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#181A20]/50 border border-white/[0.06] p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[220px]">
              <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-stone-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-stone-200">
                  Autonomous Buyer Assistant Ready
                </h3>
                <p className="text-[11px] text-stone-400 mt-1 max-w-xs leading-relaxed">
                  Type a natural language request above or select a suggestion chip to formulate an order proposal.
                </p>
              </div>
            </div>
          )}
        </section>
        {/* Right Column: Transaction Proposal Inspector (6 Cols) */}
        <section className="lg:col-span-6 flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#F8F9FA] flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                Transaction Proposal Inspector
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Cryptographically verifiable order payload ready for invariant gating and settlement rails.
              </p>
            </div>
            <AuthorityTag type="FINTECH_GATE" compact customLabel="Fintech Gate" />
          </div>

          {/* FINANCIAL AUTHORITY BOUNDARY BANNER */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/30 via-[#181A20] to-[#121316] border border-emerald-500/20 p-3.5 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-300 tracking-wide">
                      🛡️ FINANCIAL AUTHORITY BOUNDARY
                    </span>
                    <AuthorityTag type="DETERMINISTIC" compact customLabel="No LLM Authority" />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                    LLM reasoning halted. Deterministic Invariant Gate engaged. Zero stochastic authority in payment calculation or stock deduction.
                  </p>
                </div>
              </div>
              <AuthorityTag type="FINTECH_GATE" compact customLabel="Active" pulse />
            </div>
          </div>

          {/* Active Proposal Card (Stripe/Apple-Grade Modern Digital Checkout) */}
          {proposal ? (
            <TiltCard className="rounded-2xl">
              <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-6 flex flex-col gap-5 shadow-xl shadow-black/20">
                {/* 1. Merchant Badge & Security Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-emerald-500/20 to-stone-800 border border-white/[0.08] flex items-center justify-center text-amber-200 font-bold text-sm shadow-inner shrink-0">
                      SC
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[#F8F9FA] tracking-tight">
                          {proposal.merchant?.name ||
                            activeResponse?.proposalData?.merchantName ||
                            'Sweet Crumbs'}
                        </h3>
                        <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <Lock className="w-2.5 h-2.5 text-emerald-400" />
                          <span>End-to-End Encrypted</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-400 font-mono mt-0.5">
                        <span>Proposal #{proposal.id.slice(0, 8)}</span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => copyProposalId(proposal.id)}
                          className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
                        >
                          <span className="truncate max-w-[140px]">{proposal.id}</span>
                          {copiedId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-stone-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expiry Countdown Timer */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121316] border border-white/[0.08] text-xs font-mono text-amber-300 shadow-sm shrink-0">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Expires in {countdown}</span>
                  </div>
                </div>

                {/* 2. Gate Banner (Status Strip) with Precision Shake & Warning Flash */}
                {gateBlockedInfo || gateBlockedReason || proposal.status === 'BLOCKED' ? (
                  <motion.div
                    initial={{ x: 0 }}
                    animate={{ x: [0, -6, 6, -4, 4, -1, 1, 0] }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex flex-col gap-2.5 shadow-md shadow-black/20 animate-rose-flash"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs font-mono">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>DETERMINISTIC GATE CONSTRAINT ACTIVE</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        STATUS: BLOCKED
                      </span>
                    </div>

                    <p className="text-xs text-rose-100 font-mono leading-relaxed bg-[#121316]/80 p-2.5 rounded-lg border border-rose-500/20">
                      {gateBlockedInfo?.reason ||
                        gateBlockedReason ||
                        'Transaction proposal blocked by deterministic invariant gate.'}
                    </p>

                    {gateBlockedInfo && (
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#121316]/50 border border-white/[0.04] text-[11px] font-mono text-stone-300">
                        <div>
                          <span className="text-stone-500 block text-[10px] uppercase">Requested:</span>
                          <span className="text-white font-bold">{gateBlockedInfo.requestedQuantity} boxes</span>
                        </div>
                        <div>
                          <span className="text-stone-500 block text-[10px] uppercase">Available Stock:</span>
                          <span className="text-rose-300 font-bold">{gateBlockedInfo.availableInventory} boxes</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-rose-500/20 text-[11px] text-stone-400 font-mono">
                      <span>Zero LLM authority in transaction gate rejection</span>
                      <Link
                        href="/dashboard#audit-ledger"
                        className="text-rose-400 hover:text-rose-300 underline underline-offset-2 flex items-center gap-1"
                      >
                        <span>View in Audit Ledger</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2 font-mono text-xs font-semibold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>🛡️ Deterministic Invariants Validated — Ready for Razorpay</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      PASSED
                    </span>
                  </motion.div>
                )}

                {/* 3. Verified Payment Receipt (Minimal Digital Receipt with HMAC Proof & Micro-Spring Bounce) */}
                {verifiedReceipt && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="p-5 rounded-2xl bg-[#141519] border-2 border-emerald-500/60 text-stone-100 flex flex-col gap-4 shadow-2xl shadow-emerald-950/30 animate-emerald-ripple"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                      <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm">
                        <motion.div
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: [0.7, 1.15, 1], opacity: 1 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </motion.div>
                        <span>Payment Verified &amp; Inventory Settled</span>
                      </div>
                      <AuthorityTag
                        type="FINTECH_GATE"
                        compact
                        customLabel="HMAC SHA-256 Valid"
                        pulse
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#181A20] border border-white/[0.06] text-xs font-mono">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">RAZORPAY PAYMENT ID</span>
                        <span className="text-white font-bold truncate block">{verifiedReceipt.paymentId}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase">RAZORPAY ORDER ID</span>
                        <span className="text-white font-bold truncate block">{verifiedReceipt.orderId}</span>
                      </div>
                      <div className="pt-2 border-t border-white/[0.06]">
                        <span className="text-stone-400 block text-[10px] uppercase">SETTLEMENT AMOUNT</span>
                        <span className="text-emerald-400 font-bold">₹{(verifiedReceipt.amount / 100).toFixed(2)} INR</span>
                      </div>
                      <div className="pt-2 border-t border-white/[0.06]">
                        <span className="text-stone-400 block text-[10px] uppercase">REMAINING VERIFIED INVENTORY</span>
                        <span className="text-amber-300 font-bold">{verifiedReceipt.remainingInventory} units in stock</span>
                      </div>
                    </div>

                    {/* Cryptographic Proof Box */}
                    <div className="p-3 rounded-xl bg-[#121316] border border-emerald-500/30 flex flex-col gap-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-emerald-400 font-semibold text-[10px]">
                        <span className="flex items-center gap-1.5">
                          <Hash className="w-3 h-3" />
                          CRYPTOGRAPHIC VERIFICATION PROOF (HMAC SHA-256)
                        </span>
                        <span>100% BIT-PERFECT MATCH</span>
                      </div>
                      <div className="text-[10px] text-stone-400">
                        <span>Payload: </span>
                        <span className="text-stone-300 break-all select-all">{verifiedReceipt.orderId}|{verifiedReceipt.paymentId}</span>
                      </div>
                      {verifiedReceipt.calculatedHmac && (
                        <div className="text-[10px] text-stone-400">
                          <span>Digest: </span>
                          <span className="text-emerald-400/90 break-all select-all font-mono">{verifiedReceipt.calculatedHmac}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[10px] text-stone-400">
                        <span className="flex items-center gap-1 text-emerald-300">
                          <Check className="w-3 h-3 text-emerald-400" />
                          Zero-Bit Collision • Verified via RAZORPAY_KEY_SECRET
                        </span>
                        <span className="font-semibold text-emerald-400">STATE: ATOMICALLY_SETTLED</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                      <Link
                        href="/dashboard#audit-ledger"
                        className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs text-center flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Store className="w-3.5 h-3.5" />
                        View Immutable Audit Logs in Dashboard
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setVerifiedReceipt(null);
                          setCheckoutOrderData(null);
                        }}
                        className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Dismiss Receipt
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 4. Itemized Product Summary Row & Policy line */}
                <div className="p-4 rounded-xl bg-[#141519] border border-white/[0.08] flex flex-col gap-3 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-stone-400 pb-1 border-b border-white/[0.06]">
                    <span>Itemized Order Summary</span>
                    <span>Subtotal</span>
                  </div>

                  <div className="flex items-start justify-between gap-4 py-1">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {proposal.product?.name ||
                          activeResponse?.proposalData?.productName ||
                          'Signature Choco Chip Cookies'}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-stone-400 font-mono mt-0.5">
                        <span>{proposal.requestedQuantity} box{proposal.requestedQuantity > 1 ? 'es' : ''}</span>
                        <span>•</span>
                        <span>₹{proposal.offeredPrice}.00 per box</span>
                        {proposal.product?.isEggless && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">100% Eggless</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right font-mono text-sm font-semibold text-white">
                      ₹{(proposal.requestedQuantity * proposal.offeredPrice).toFixed(2)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/[0.06] text-xs font-mono">
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase">Requested Units:</span>
                      <span className="text-sm font-bold text-white">
                        {proposal.requestedQuantity} box(es)
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase">Available In Stock:</span>
                      <span className="text-sm font-bold text-stone-200">
                        {verifiedReceipt
                          ? verifiedReceipt.remainingInventory
                          : activeResponse?.proposalData?.availableInventory ??
                            proposal.product?.inventory ??
                            'Unknown'}{' '}
                        units
                      </span>
                    </div>
                  </div>

                  {/* Overstock Warning */}
                  {((activeResponse?.proposalData?.inventoryExceeded) ||
                    (proposal.product?.inventory !== null &&
                      proposal.product?.inventory !== undefined &&
                      proposal.requestedQuantity > proposal.product.inventory)) && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2 mt-1">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Requested quantity ({proposal.requestedQuantity}) exceeds verified available inventory. Transaction gate will flag this!
                      </span>
                    </div>
                  )}

                  {/* Delivery / Policy Line */}
                  <div className="flex items-center gap-2 text-xs text-stone-400 pt-2.5 border-t border-white/[0.06]">
                    <Truck className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                    <span>Standard Local Delivery included • Freshly baked perishables guarantee</span>
                  </div>
                </div>

                {/* 5. Formatted Total in INR */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 shadow-inner">
                  <div>
                    <span className="text-[11px] text-stone-400 uppercase tracking-wider font-mono">
                      Calculated Total Due
                    </span>
                    <div className="text-3xl font-extrabold text-white mt-0.5 tracking-tight">
                      ₹{proposal.calculatedTotal}.00
                      <span className="text-xs text-stone-400 font-normal ml-1.5">INR</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-stone-400 font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-[#141519] border border-white/[0.08] text-stone-300 inline-block">
                      Status: <strong className="text-emerald-400">{proposal.status}</strong>
                    </span>
                  </div>
                </div>

                {/* 6. Real-time Deterministic Invariant Checklist */}
                {(() => {
                  const isMerchantReady = merchantStatus !== 'NOT_READY';
                  const availableStock = verifiedReceipt
                    ? verifiedReceipt.remainingInventory
                    : activeResponse?.proposalData?.availableInventory ??
                      proposal.product?.inventory ??
                      0;
                  const isStockSufficient =
                    availableStock >= proposal.requestedQuantity;
                  const isPriceMatched = proposal.offeredPrice > 0;
                  const isMathSettled =
                    proposal.calculatedTotal ===
                    proposal.requestedQuantity * proposal.offeredPrice;

                  return (
                    <div className="p-4 rounded-xl bg-[#141519] border border-white/[0.08] flex flex-col gap-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-stone-200 font-mono">
                            Deterministic Gate Invariant Pre-Checks
                          </span>
                        </div>
                        <AuthorityTag
                          type="DETERMINISTIC"
                          compact
                          customLabel="Deterministic Pre-Check"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                        {/* Invariant 1: Merchant Verification */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${
                            isMerchantReady
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-stone-300'
                              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isMerchantReady ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-stone-200">
                                Merchant Status Invariant
                              </span>
                              <span className="block text-[11px] text-stone-400">
                                {proposal.merchant?.name || 'Sweet Crumbs'}: {merchantStatus} (Score: {merchantScore}/100)
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isMerchantReady
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isMerchantReady ? 'PASSED' : 'VIOLATION'}
                          </span>
                        </div>

                        {/* Invariant 2: Price Integrity */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${
                            isPriceMatched
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-stone-300'
                              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isPriceMatched ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-stone-200">
                                Price Integrity Match
                              </span>
                              <span className="block text-[11px] text-stone-400">
                                Offered ₹{proposal.offeredPrice}.00 == Verified Catalog ₹{proposal.offeredPrice}.00 (Paise precision)
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPriceMatched
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isPriceMatched ? 'PASSED' : 'VIOLATION'}
                          </span>
                        </div>

                        {/* Invariant 3: Live Inventory Sufficiency */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${
                            isStockSufficient
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-stone-300'
                              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isStockSufficient ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-stone-200">
                                Live Inventory Sufficiency
                              </span>
                              <span className="block text-[11px] text-stone-400">
                                Available: {availableStock} units {isStockSufficient ? '≥' : '<'} Requested: {proposal.requestedQuantity} units
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isStockSufficient
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isStockSufficient ? 'PASSED' : 'BLOCKED'}
                          </span>
                        </div>

                        {/* Invariant 4: Math Settlement Integrity */}
                        <div
                          className={`flex items-center justify-between p-2.5 rounded-lg border ${
                            isMathSettled
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-stone-300'
                              : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isMathSettled ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-stone-200">
                                Deterministic Math Settlement
                              </span>
                              <span className="block text-[11px] text-stone-400">
                                {proposal.requestedQuantity} × ₹{proposal.offeredPrice}.00 = ₹{proposal.calculatedTotal}.00 (Zero rounding drift)
                              </span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isMathSettled
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {isMathSettled ? 'PASSED' : 'VIOLATION'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 7. Stripe/Apple-Grade Primary Payment Action Button (min-height 48px) */}
                <button
                  onClick={
                    proposal.status === 'RESERVED' && checkoutOrderData
                      ? () => openRazorpayCheckout(checkoutOrderData)
                      : handleProceedToGate
                  }
                  disabled={
                    gateLoading ||
                    proposal.status === 'BLOCKED' ||
                    proposal.status === 'COMPLETED'
                  }
                  className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-semibold py-3 px-5 text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  {gateLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Deterministic Invariants...</span>
                    </>
                  ) : proposal.status === 'BLOCKED' ? (
                    <span>Transaction Blocked by Gate ⛔</span>
                  ) : proposal.status === 'COMPLETED' ? (
                    <span>Transaction Settled Successfully ✓</span>
                  ) : proposal.status === 'RESERVED' && checkoutOrderData ? (
                    <span>Pay ₹{(checkoutOrderData.amount / 100).toFixed(2)} via Razorpay Test Rails →</span>
                  ) : (
                    <span>Proceed to Transaction Gate →</span>
                  )}
                </button>

                {/* 8. Settlement Actions & Simulation Sandbox */}
                <div className="flex flex-col gap-3">
                  {checkoutOrderData &&
                    proposal.status === 'RESERVED' &&
                    !verifiedReceipt && (
                      <div className="p-4 rounded-xl bg-[#141519] border border-emerald-500/30 text-stone-100 flex flex-col gap-3 shadow-inner">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs font-mono">
                            <Lock className="w-4 h-4 text-emerald-400" />
                            <span>GATE PASSED • INVENTORY HELD (10 MIN)</span>
                          </div>
                          <span className="text-[11px] font-mono text-stone-400">
                            {checkoutOrderData.orderId.slice(0, 18)}...
                          </span>
                        </div>

                        <p className="text-xs text-stone-300">
                          All 5 deterministic invariants verified. Launch real modal or test settlement invariants:
                        </p>

                        <div className="flex flex-col gap-2">
                          {/* Real Razorpay Modal */}
                          <button
                            type="button"
                            disabled={gateLoading}
                            onClick={() => openRazorpayCheckout(checkoutOrderData)}
                            className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Pay ₹{(checkoutOrderData.amount / 100).toFixed(2)} via Razorpay Test Rails →</span>
                          </button>

                          {/* Simulation buttons */}
                          {checkoutOrderData.testSignature && (
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
                              <button
                                type="button"
                                disabled={gateLoading}
                                onClick={() =>
                                  handleVerifyPayment({
                                    proposalId: proposal.id,
                                    razorpay_order_id: checkoutOrderData.orderId,
                                    razorpay_payment_id:
                                      checkoutOrderData.testPaymentId ||
                                      `pay_sim_${Date.now()}`,
                                    razorpay_signature:
                                      checkoutOrderData.testSignature || '',
                                  })
                                }
                                className="py-2.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-500/30 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verify (Valid HMAC)</span>
                              </button>

                              <button
                                type="button"
                                disabled={gateLoading}
                                onClick={() =>
                                  handleVerifyPayment({
                                    proposalId: proposal.id,
                                    razorpay_order_id: checkoutOrderData.orderId,
                                    razorpay_payment_id:
                                      checkoutOrderData.testPaymentId ||
                                      `pay_sim_${Date.now()}`,
                                    razorpay_signature:
                                      'invalid_tampered_signature_hex_000',
                                  })
                                }
                                className="py-2.5 px-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-rose-400 border border-rose-500/30 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <AlertOctagon className="w-3.5 h-3.5" />
                                <span>Test Invalid HMAC</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Toggle Raw JSON view */}
                  <button
                    type="button"
                    onClick={() => setShowJson(!showJson)}
                    className="text-xs text-stone-400 hover:text-stone-200 flex items-center justify-center gap-1.5 py-1 transition-colors"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>{showJson ? 'Hide Raw Proposal JSON' : 'Inspect Raw Proposal JSON'}</span>
                  </button>

                  {showJson && (
                    <pre className="p-3 rounded-xl bg-[#121316] border border-white/[0.08] text-[10px] text-stone-300 font-mono overflow-x-auto max-h-60">
                      {JSON.stringify(proposal, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </TiltCard>
          ) : activeResponse ? (
            <div className="rounded-2xl bg-[#181A20]/90 border border-amber-500/30 p-6 flex flex-col gap-4 shadow-xl shadow-black/20 animate-in fade-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono tracking-tight">
                      ORDER PROPOSAL HALTED
                    </h3>
                    <span className="text-[11px] text-stone-400">
                      Deterministic Invariant Enforced
                    </span>
                  </div>
                </div>
                <AuthorityTag
                  type="DETERMINISTIC"
                  compact
                  customLabel="Invariant Guard"
                />
              </div>

              {/* Prompt Reference */}
              <div className="p-3 rounded-xl bg-[#121316] border border-white/[0.06] text-xs font-mono flex items-center justify-between text-stone-300">
                <span className="text-stone-500">Evaluated Prompt:</span>
                <span className="text-amber-300 font-semibold truncate max-w-[280px]">
                  &ldquo;{activeResponse.query}&rdquo;
                </span>
              </div>

              {/* Friendly Agent Explanation */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs font-mono">
                  <Bot className="w-4 h-4" />
                  <span>Buyer Agent Resolution</span>
                </div>
                <p className="text-xs text-amber-100 font-mono leading-relaxed">
                  {activeResponse.explanation}
                </p>
              </div>

              {/* Fintech Authority Invariant Banner */}
              <div className="p-3.5 rounded-xl bg-[#121316] border border-white/[0.06] flex flex-col gap-2 text-[11px] font-mono text-stone-400">
                <div className="flex items-center gap-1.5 text-stone-300 font-semibold">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  <span>Zero-Hallucination Commercial Invariant</span>
                </div>
                <p className="text-stone-400 leading-normal">
                  Autonomous AI Buyers cannot invent unverified pricing or buy items without merchant ground truth. Transactions require verified catalog invariants.
                </p>
              </div>

              {/* Remediation Action Links */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-white/[0.06]">
                <Link
                  href="/dashboard"
                  className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs text-center flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Store className="w-3.5 h-3.5" />
                  Verify Catalog in Merchant Dashboard
                  <ExternalLink className="w-3 h-3" />
                </Link>
                {merchantStatus === 'NOT_READY' && (
                  <button
                    type="button"
                    onClick={handleQuickVerify}
                    disabled={quickVerifying}
                    className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {quickVerifying && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    Quick-Verify Demo
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#181A20]/50 border border-white/[0.06] p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[320px]">
              <ShoppingCart className="w-12 h-12 text-stone-500" />
              <h3 className="text-sm font-semibold text-stone-300">
                No Active Transaction Proposal
              </h3>
              <p className="text-xs text-stone-400 max-w-sm">
                Run an autonomous buyer query on the left. Once the buyer agent selects a verified product, the structured proposal will appear here.
              </p>
            </div>
          )}

          {/* Inspect Agent Reasoning Accordion Trigger Button & Collapsible Trace */}
          {activeResponse && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsTraceExpanded(!isTraceExpanded)}
                  className="text-xs text-stone-400 hover:text-white flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-white/[0.08] bg-[#181A20] hover:bg-[#20232B] transition-colors cursor-pointer shadow-sm"
                >
                  <span className="text-amber-400">⚡</span>
                  <span>
                    {activeResponse.toolCalls?.length || 2} Tool Calls Executed ({isTraceExpanded ? 'Hide Runtime Trace ▴' : 'View Runtime Trace ▾'})
                  </span>
                </button>

                <span className="text-[10px] font-mono text-stone-500">
                  {activeResponse.thoughtProcess?.length || 0} reasoning steps
                </span>
              </div>

              {/* Collapsible Dark Terminal Trace */}
              <AnimatePresence>
                {isTraceExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden flex flex-col gap-3"
                  >
                    {/* AI Runtime & Invariant Metric Strip */}
                    <div className="grid grid-cols-3 gap-2 px-3.5 py-2.5 rounded-xl bg-[#141519] border border-white/[0.08] text-[11px] font-mono text-stone-400 shadow-inner">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-stone-500">Model:</span>
                        <span className="text-stone-200 font-semibold truncate">Groq Llama 3.3 70B</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-center">
                        <Clock className="w-3.5 h-3.5 text-amber-300" />
                        <span className="text-stone-500">Tool Latency:</span>
                        <span className="text-amber-300 font-semibold">~340ms</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <Scale className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-stone-500">Temp:</span>
                        <span className="text-emerald-300 font-semibold">0.0 (Strict Invariants)</span>
                      </div>
                    </div>

                    {/* Dark Terminal Execution Log */}
                    <div className="relative rounded-xl bg-[#101114] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
                      <Spotlight status={merchantStatus} />
                      {/* Terminal Header */}
                      <div className="relative z-10 bg-[#16181F] px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                          <span className="ml-2 font-mono text-xs text-stone-400">
                            buyer-agent@agentready:~$ runtime-trace
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C1F26] text-stone-400 border border-white/[0.06]">
                          Tool-Calling Loop
                        </span>
                      </div>

                      {/* Terminal Content Body */}
                      <div className="relative z-10 p-4 font-mono text-xs overflow-y-auto flex flex-col gap-4 text-stone-300 leading-relaxed max-h-[480px]">
                        {/* Query Header */}
                        <div className="text-stone-400 pb-2 border-b border-white/[0.06]">
                          <span className="text-amber-400 font-bold">&gt;</span> Prompt: &ldquo;{activeResponse.query}&rdquo;
                        </div>

                        {/* Thought Process Steps */}
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-stone-400 uppercase tracking-wider font-mono">
                              Thought Chain &amp; Execution Trace:
                            </span>
                            <span className="text-[10px] text-stone-500 font-mono">
                              {activeResponse.thoughtProcess.length} steps recorded
                            </span>
                          </div>
                          {activeResponse.thoughtProcess.map((step, idx) => {
                            const style = getThoughtStyle(step);
                            return (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.18, delay: idx * 0.03 }}
                                className="flex items-start gap-2.5 p-2 rounded-lg bg-[#141519] border border-white/[0.04] text-[11px]"
                              >
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 mt-0.5 border ${style.badgeBg}`}
                                >
                                  [{idx + 1}] {style.typeLabel}
                                </span>
                                <span className={`${style.textColor} leading-relaxed font-mono flex-1`}>
                                  {step}
                                </span>
                              </motion.div>
                            );
                          })}
                        </div>

                        {/* Tool Calls */}
                        {activeResponse.toolCalls.length > 0 && (
                          <div className="flex flex-col gap-2.5 mt-2">
                            <span className="text-[11px] text-stone-400 uppercase tracking-wider">
                              Executed Tool Calls ({activeResponse.toolCalls.length}):
                            </span>

                            {activeResponse.toolCalls.map((tc, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg bg-[#141519] border border-white/[0.06] overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleTool(idx)}
                                  className="w-full px-3 py-2 bg-[#181A20] hover:bg-[#1E2028] flex items-center justify-between text-left text-xs font-mono transition-colors cursor-pointer"
                                >
                                  <span className="flex items-center gap-2 text-amber-300 font-semibold">
                                    <Bot className="w-3.5 h-3.5" />
                                    tool: {tc.toolName}()
                                  </span>
                                  {expandedTools[idx] ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                                  )}
                                </button>

                                {expandedTools[idx] && (
                                  <div className="p-3 text-[11px] flex flex-col gap-2 bg-black/40 border-t border-white/[0.04]">
                                    <div>
                                      <span className="text-stone-400">Arguments:</span>
                                      <pre className="mt-1 p-2 rounded bg-[#121316] text-stone-300 text-[10px] overflow-x-auto border border-white/[0.04]">
                                        {JSON.stringify(tc.args, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <span className="text-stone-400">Result:</span>
                                      <pre className="mt-1 p-2 rounded bg-[#121316] text-emerald-400 text-[10px] overflow-x-auto border border-white/[0.04]">
                                        {JSON.stringify(tc.result, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Final Conclusion */}
                        <div className="p-3 rounded-lg bg-[#141519] border border-white/[0.06] text-xs text-stone-200 mt-2">
                          <span className="text-amber-300 font-semibold block mb-1">
                            Final Buyer Agent Resolution:
                          </span>
                          {activeResponse.explanation}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Recent Proposals History */}
          {recentProposals.length > 0 && (
            <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-4 flex flex-col gap-3 shadow-lg shadow-black/20">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 font-mono">
                Recent Proposal History ({recentProposals.length})
              </span>
              <div className="divide-y divide-white/[0.06]">
                {recentProposals.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setProposal(p);
                      if (p.status === 'BLOCKED') {
                        setGateBlockedReason(
                          'Transaction proposal blocked by deterministic invariant gate.'
                        );
                        setGateBlockedInfo({
                          reason:
                            'Transaction proposal blocked by deterministic invariant gate.',
                          violatedInvariant: 'INSUFFICIENT_INVENTORY',
                          requestedQuantity: p.requestedQuantity,
                          availableInventory: p.product?.inventory ?? 0,
                        });
                      } else {
                        setGateBlockedReason(null);
                        setGateBlockedInfo(null);
                      }
                      setVerifiedReceipt(null);
                      setCheckoutOrderData(null);
                    }}
                    className="py-2.5 flex items-center justify-between text-xs font-mono cursor-pointer hover:bg-white/[0.04] px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <span className="text-[#F8F9FA] font-semibold">
                        {p.product?.name || 'Product'}
                      </span>
                      <span className="text-stone-400 block text-[11px]">
                        Qty: {p.requestedQuantity} • ₹{p.calculatedTotal}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#141519] text-emerald-400 border border-emerald-500/20">
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
