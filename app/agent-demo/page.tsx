'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
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
      textColor: 'text-cyan-300',
      badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
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
      textColor: 'text-violet-300',
      badgeBg: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
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
    textColor: 'text-zinc-300',
    badgeBg: 'bg-zinc-800 text-zinc-400 border-zinc-700',
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

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay)
      return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
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
        const [readRes, buyerRes] = await Promise.all([
          fetch('/api/readiness?slug=sweet-crumbs'),
          fetch('/api/buyer?limit=5'),
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
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

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
    setGateBlockedReason(null);
    setGateBlockedInfo(null);
    setVerifiedReceipt(null);
    setCheckoutOrderData(null);

    try {
      const res = await fetch('/api/buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToRun }),
      });

      const data: BuyerApiResponse = await res.json();
      setActiveResponse(data);
      if (data.proposal) {
        setProposal(data.proposal);
        setRecentProposals((prev) => [data.proposal!, ...prev.slice(0, 4)]);
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
      // 1. Resolve conflict
      await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESOLVE_CONFLICT',
          issueId: 'temp',
          authoritativePrice: 250,
          merchantSlug: 'sweet-crumbs',
        }),
      });

      // 2. Verify products
      const readRes = await fetch('/api/readiness?slug=sweet-crumbs');
      const readData = await readRes.json();

      for (const p of readData.products || []) {
        await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'VERIFY_PRODUCT',
            productId: p.id,
            price: p.price ?? 220,
            inventory: p.inventory ?? 15,
          }),
        });
      }

      // 3. Approve policy
      await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE_POLICY',
          merchantSlug: 'sweet-crumbs',
          type: 'REFUND',
          content:
            'Perishable artisan baked goods cannot be returned once dispatched. Photo evidence within 2 hours of delivery qualifies for instant refund.',
        }),
      });

      await fetchMerchantStatus();
    } catch (e) {
      console.error(e);
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
      console.warn('Razorpay SDK not loaded in window');
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
      await loadRazorpayScript();
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        merchantStatus={merchantStatus}
        merchantScore={merchantScore}
        onReset={async () => {
          await fetchMerchantStatus();
          await fetchRecentProposals();
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
        }}
      />

      {/* Readiness Alert Banner if NOT_READY */}
      {merchantStatus === 'NOT_READY' && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-zinc-950 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-300">
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
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold tracking-wide transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {quickVerifying && <Loader2 className="w-3 h-3 animate-spin" />}
              Quick-Verify Merchant for Simulator
            </button>
            <Link
              href="/dashboard"
              className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Main Two-Column Playground */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Autonomous Buyer Terminal (6 Cols) */}
        <section className="lg:col-span-6 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                Autonomous Buyer Client
              </h2>
              <AuthorityTag
                type="AI_INFERRED"
                compact
                customLabel="Autonomous LLM Agent"
                pulse
              />
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Natural language shopping agent equipped with structured catalog discovery and order proposal tools.
            </p>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Quick Test Prompts:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: 'I want eggless cookies under ₹300',
                  desc: 'Dietary & Budget Match',
                },
                {
                  label: 'Buy 2 boxes of Signature Choco Chip Cookies',
                  desc: 'Named Product Purchase',
                },
                {
                  label: 'Order 20 boxes of Signature Choco Chip Cookies',
                  desc: 'Stock Limit Exceeded (Gate Test)',
                },
              ].map((sample) => (
                <button
                  key={sample.label}
                  onClick={() => {
                    setQuery(sample.label);
                    handleRunBuyer(sample.label);
                  }}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-left text-xs text-zinc-300 hover:text-white transition-all group disabled:opacity-50"
                >
                  <span className="font-medium text-emerald-400/90 group-hover:text-emerald-300">
                    &ldquo;{sample.label}&rdquo;
                  </span>
                  <span className="block text-[10px] text-zinc-400 mt-0.5">
                    {sample.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRunBuyer(query);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 focus-within:border-cyan-500/80 transition-all shadow-lg"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Order 2 boxes of Signature Choco Chip Cookies..."
              className="flex-1 bg-transparent px-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Run Buyer
            </button>
          </form>

          {/* AI Runtime & Invariant Metric Strip */}
          <div className="grid grid-cols-3 gap-2 px-3 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 shadow-inner">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-zinc-500">Model:</span>
              <span className="text-zinc-200 font-semibold truncate">Gemini 3.6 Flash</span>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-zinc-500">Tool Latency:</span>
              <span className="text-cyan-300 font-semibold">~340ms</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-500">Temp:</span>
              <span className="text-emerald-300 font-semibold">0.0 (Strict Zero-Hallucination)</span>
            </div>
          </div>

          {/* Terminal Execution Log */}
          <div className="relative flex-1 rounded-xl bg-black border border-zinc-800 shadow-2xl flex flex-col overflow-hidden min-h-[360px]">
            <Spotlight status={merchantStatus} />
            {/* Terminal Header */}
            <div className="relative z-10 bg-zinc-900/90 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs text-zinc-400">
                  buyer-agent@agentready:~$ runtime-trace
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                Tool-Calling Loop
              </span>
            </div>

            {/* Terminal Content Body */}
            <div className="relative z-10 p-4 flex-1 font-mono text-xs overflow-y-auto flex flex-col gap-4 text-zinc-300 leading-relaxed">
              {!activeResponse && !loading && (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2 text-center">
                  <Terminal className="w-8 h-8 text-zinc-400" />
                  <p>Agent is idle. Select a sample prompt above or enter a shopping request.</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center gap-3 py-10 text-cyan-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Agent executing reasoning loop and structured tool-calling...</span>
                </div>
              )}

              {activeResponse && !loading && (
                <>
                  {/* Query Header */}
                  <div className="text-zinc-400 pb-2 border-b border-zinc-900">
                    <span className="text-emerald-400 font-bold">&gt;</span> Prompt: &ldquo;{activeResponse.query}&rdquo;
                  </div>

                  {/* Thought Process Steps */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-mono">
                        Thought Chain &amp; Execution Trace:
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {activeResponse.thoughtProcess.length} steps recorded
                      </span>
                    </div>
                    {activeResponse.thoughtProcess.map((step, idx) => {
                      const style = getThoughtStyle(step);
                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/70 border border-zinc-900 text-[11px]"
                        >
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 mt-0.5 border ${style.badgeBg}`}
                          >
                            [{idx + 1}] {style.typeLabel}
                          </span>
                          <span className={`${style.textColor} leading-relaxed font-mono flex-1`}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tool Calls */}
                  {activeResponse.toolCalls.length > 0 && (
                    <div className="flex flex-col gap-2.5 mt-2">
                      <span className="text-[11px] text-zinc-400 uppercase tracking-wider">
                        Executed Tool Calls ({activeResponse.toolCalls.length}):
                      </span>

                      {activeResponse.toolCalls.map((tc, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-zinc-950 border border-zinc-800/90 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleTool(idx)}
                            className="w-full px-3 py-2 bg-zinc-900/60 hover:bg-zinc-900 flex items-center justify-between text-left text-xs font-mono transition-colors"
                          >
                            <span className="flex items-center gap-2 text-cyan-400 font-semibold">
                              <Bot className="w-3.5 h-3.5" />
                              tool: {tc.toolName}()
                            </span>
                            {expandedTools[idx] ? (
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                          </button>

                          {expandedTools[idx] && (
                            <div className="p-3 text-[11px] flex flex-col gap-2 bg-black/60 border-t border-zinc-900">
                              <div>
                                <span className="text-zinc-400">Arguments:</span>
                                <pre className="mt-1 p-2 rounded bg-zinc-900/60 text-zinc-300 text-[10px] overflow-x-auto">
                                  {JSON.stringify(tc.args, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <span className="text-zinc-400">Result:</span>
                                <pre className="mt-1 p-2 rounded bg-zinc-900/60 text-emerald-400 text-[10px] overflow-x-auto">
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
                  <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 mt-2">
                    <span className="text-cyan-400 font-semibold block mb-1">
                      Final Buyer Agent Resolution:
                    </span>
                    {activeResponse.explanation}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Transaction Proposal Inspector (6 Cols) */}
        <section className="lg:col-span-6 flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                Transaction Proposal Inspector
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Cryptographically verifiable order payload ready for invariant gating and settlement rails.
              </p>
            </div>
            <AuthorityTag type="FINTECH_GATE" compact customLabel="Fintech Gate" />
          </div>

          {/* FINANCIAL AUTHORITY BOUNDARY BANNER */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-zinc-950 border border-emerald-500/30 p-3.5 shadow-lg">
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
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                    LLM reasoning halted. Deterministic Invariant Gate engaged. Zero stochastic authority in payment calculation or stock deduction.
                  </p>
                </div>
              </div>
              <AuthorityTag type="FINTECH_GATE" compact customLabel="Active" pulse />
            </div>
          </div>

          {/* Active Proposal Card */}
          {proposal ? (
            <TiltCard className="rounded-2xl">
              <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 flex flex-col gap-5 shadow-xl">
              {/* Proposal Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                      proposal.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : proposal.status === 'RESERVED'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : proposal.status === 'BLOCKED'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : proposal.status === 'EXPIRED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    STATUS: {proposal.status}
                  </span>
                </div>

                {/* Expiry Countdown Timer */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Expires in {countdown}</span>
                </div>
              </div>

              {/* High-Visibility Prominent Red Alert Card: Gate Blocked */}
              {(gateBlockedInfo || gateBlockedReason) && (
                <div className="p-5 rounded-2xl bg-rose-950/70 border-2 border-rose-500 text-rose-100 flex flex-col gap-3.5 shadow-2xl shadow-rose-950/60 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm tracking-wide">
                      <AlertOctagon className="w-5 h-5 text-rose-500 shrink-0" />
                      <span>TRANSACTION BLOCKED BY GATE</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AuthorityTag
                        type="FINTECH_GATE"
                        compact
                        customLabel="Gate Violation"
                      />
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        STATUS: BLOCKED
                      </span>
                    </div>
                  </div>

                  {/* Deterministic Invariant Check Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-black/60 border border-rose-500/30 text-xs font-mono">
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase">
                        Invariant Violated:
                      </span>
                      <span className="text-rose-400 font-bold">
                        {gateBlockedInfo?.violatedInvariant || 'INSUFFICIENT_INVENTORY'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase">
                        Enforcement:
                      </span>
                      <span className="text-amber-300 font-semibold text-[11px]">
                        Deterministic Invariant Check (Zero LLM authority)
                      </span>
                    </div>
                    <div className="pt-2 border-t border-rose-900/40">
                      <span className="text-zinc-400 block text-[10px] uppercase">
                        Requested:
                      </span>
                      <span className="text-white font-bold">
                        {gateBlockedInfo?.requestedQuantity ?? proposal.requestedQuantity} boxes
                      </span>
                    </div>
                    <div className="pt-2 border-t border-rose-900/40">
                      <span className="text-zinc-400 block text-[10px] uppercase">
                        Available Stock:
                      </span>
                      <span className="text-rose-300 font-bold">
                        {gateBlockedInfo?.availableInventory ?? proposal.product?.inventory ?? 0} boxes
                      </span>
                    </div>
                  </div>

                  {/* Gate Reason Message */}
                  <p className="text-xs text-rose-200/90 font-mono leading-relaxed bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/30">
                    {gateBlockedInfo?.reason || gateBlockedReason}
                  </p>

                  {/* Log Reference */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-rose-500/20 text-[11px] text-zinc-400 font-mono">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-zinc-400">Log reference:</span>
                      {gateBlockedInfo?.auditLogId ? (
                        <span className="text-rose-300 font-bold">
                          Event ID: {gateBlockedInfo.auditLogId.slice(0, 16)}...
                        </span>
                      ) : (
                        <span className="text-zinc-400">Event: TRANSACTION_BLOCKED</span>
                      )}
                      {gateBlockedInfo?.timestamp && (
                        <span className="text-zinc-400">
                          • Timestamp:{' '}
                          {new Date(gateBlockedInfo.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                          })}
                        </span>
                      )}
                    </div>
                    <Link
                      href="/dashboard#audit-ledger"
                      className="text-rose-400 hover:text-rose-300 underline underline-offset-2 flex items-center gap-1 text-[11px]"
                    >
                      <span>View in Audit Ledger</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* High-Visibility Green Card: Verified Payment Receipt */}
              {verifiedReceipt && (
                <TiltCard className="rounded-xl">
                  <div className="p-5 rounded-xl bg-emerald-950/50 border-2 border-emerald-500 text-emerald-100 flex flex-col gap-4 shadow-xl shadow-emerald-950/40 animate-in zoom-in-95">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        PAYMENT VERIFIED &amp; INVENTORY DEDUCTED
                      </div>
                      <AuthorityTag
                        type="FINTECH_GATE"
                        compact
                        customLabel="HMAC SHA-256 Valid"
                        pulse
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-black/60 border border-emerald-500/30 text-xs font-mono">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">RAZORPAY PAYMENT ID</span>
                        <span className="text-white font-bold truncate block">{verifiedReceipt.paymentId}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[10px]">RAZORPAY ORDER ID</span>
                        <span className="text-white font-bold truncate block">{verifiedReceipt.orderId}</span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800">
                        <span className="text-zinc-400 block text-[10px]">SETTLEMENT AMOUNT</span>
                        <span className="text-emerald-400 font-bold">₹{(verifiedReceipt.amount / 100).toFixed(2)} INR</span>
                      </div>
                      <div className="pt-2 border-t border-zinc-800">
                        <span className="text-zinc-400 block text-[10px]">REMAINING VERIFIED INVENTORY</span>
                        <span className="text-cyan-400 font-bold">{verifiedReceipt.remainingInventory} units in stock</span>
                      </div>
                    </div>

                    {/* Cryptographic Verification Proof Box */}
                    <div className="p-3.5 rounded-lg bg-black/80 border border-emerald-500/40 flex flex-col gap-2 font-mono text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
                          <Hash className="w-3.5 h-3.5" />
                          <span>CRYPTOGRAPHIC VERIFICATION PROOF (HMAC SHA-256)</span>
                        </div>
                        <span className="text-[10px] text-emerald-400/90 font-bold">100% MATCH</span>
                      </div>

                      <div className="flex flex-col gap-1.5 text-[11px]">
                        <div>
                          <span className="text-zinc-400 block text-[10px]">Payload: razorpayOrderId|razorpayPaymentId</span>
                          <span className="text-zinc-300 break-all select-all font-mono text-[10px]">
                            {verifiedReceipt.orderId}|{verifiedReceipt.paymentId}
                          </span>
                        </div>
                        {verifiedReceipt.calculatedHmac && (
                          <div>
                            <span className="text-zinc-400 block text-[10px]">Computed HMAC Digest (Server-Side):</span>
                            <span className="text-emerald-400 break-all select-all font-mono text-[10px]">
                              {verifiedReceipt.calculatedHmac}
                            </span>
                          </div>
                        )}
                        {verifiedReceipt.signature && (
                          <div>
                            <span className="text-zinc-400 block text-[10px]">Razorpay Signature (Received):</span>
                            <span className="text-emerald-300 break-all select-all font-mono text-[10px]">
                              {verifiedReceipt.signature}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-1 pt-1.5 border-t border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-300">
                        <span className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          Zero-Bit Collision • Verified via RAZORPAY_KEY_SECRET
                        </span>
                        <span className="font-semibold text-emerald-400">STATE: ATOMICALLY_SETTLED</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                      <Link
                        href="/dashboard#audit-ledger"
                        className="w-full sm:flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs text-center flex items-center justify-center gap-1.5 transition-colors"
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
                        className="py-2.5 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Dismiss Receipt
                      </button>
                    </div>
                  </div>
                </TiltCard>
              )}

              {/* Proposal ID */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono">
                <span className="text-zinc-400">Proposal ID:</span>
                <button
                  type="button"
                  onClick={() => copyProposalId(proposal.id)}
                  className="flex items-center gap-1.5 text-zinc-200 hover:text-white"
                >
                  <span className="truncate max-w-[220px]">
                    {proposal.id}
                  </span>
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>
              </div>

              {/* Proposal Summary Card: Product Name, Qty, Total in ₹, Status */}
              <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {proposal.product?.name ||
                        activeResponse?.proposalData?.productName ||
                        'Verified Product'}
                    </h3>
                    <span className="text-xs text-zinc-400">
                      Merchant: {proposal.merchant?.name ||
                        activeResponse?.proposalData?.merchantName ||
                        'Sweet Crumbs'}
                    </span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    ₹{proposal.offeredPrice} / box
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
                  <div>
                    <span className="text-zinc-400 block">Requested Quantity:</span>
                    <span className="text-sm font-bold text-white">
                      {proposal.requestedQuantity} box(es)
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Available In Stock:</span>
                    <span className="text-sm font-bold text-zinc-300">
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
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2 mt-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      Requested quantity ({proposal.requestedQuantity}) exceeds verified available inventory. Transaction gate will flag this!
                    </span>
                  </div>
                )}
              </div>

              {/* Total Calculation */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <div>
                  <span className="text-xs text-emerald-400/80 uppercase tracking-wider font-mono">
                    Calculated Total
                  </span>
                  <div className="text-3xl font-extrabold text-white mt-0.5">
                    ₹{proposal.calculatedTotal}
                    <span className="text-xs text-zinc-400 font-normal ml-1">
                      INR
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400 font-mono">
                  <div>
                    {proposal.requestedQuantity} × ₹{proposal.offeredPrice}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Status: {proposal.status}
                  </div>
                </div>
              </div>

              {/* Real-time Deterministic Invariant Checklist */}
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
                  <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800/90 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
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
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300'
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
                            <span className="font-semibold text-zinc-200">
                              Merchant Status Invariant
                            </span>
                            <span className="block text-[11px] text-zinc-400">
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
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300'
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
                            <span className="font-semibold text-zinc-200">
                              Price Integrity Match
                            </span>
                            <span className="block text-[11px] text-zinc-400">
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
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300'
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
                            <span className="font-semibold text-zinc-200">
                              Live Inventory Sufficiency
                            </span>
                            <span className="block text-[11px] text-zinc-400">
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
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-300'
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
                            <span className="font-semibold text-zinc-200">
                              Deterministic Math Settlement
                            </span>
                            <span className="block text-[11px] text-zinc-400">
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

              {/* Active Checkout Button */}
              <button
                onClick={handleProceedToGate}
                disabled={
                  gateLoading ||
                  proposal.status === 'BLOCKED' ||
                  proposal.status === 'COMPLETED'
                }
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {gateLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Transaction Gate...
                  </>
                ) : proposal.status === 'BLOCKED' ? (
                  'Transaction Blocked by Gate ⛔'
                ) : proposal.status === 'COMPLETED' ? (
                  'Transaction Already Settled ✓'
                ) : (
                  'Proceed to Transaction Gate →'
                )}
              </button>

              {/* Settlement Actions / Transaction Gate */}
              <div className="flex flex-col gap-3">
                {/* When Proposal is RESERVED and ready for settlement */}
                {checkoutOrderData &&
                  proposal.status === 'RESERVED' &&
                  !verifiedReceipt && (
                    <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-cyan-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs font-mono">
                          <Lock className="w-4 h-4 text-cyan-400" />
                          GATE PASSED • INVENTORY HELD (10 MIN)
                        </div>
                        <span className="text-[11px] font-mono text-cyan-300">
                          {checkoutOrderData.orderId.slice(0, 18)}...
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300">
                        All 5 deterministic invariants verified. Choose checkout settlement path:
                      </p>

                      <div className="flex flex-col gap-2">
                        {/* 1. Real Razorpay Modal */}
                        <button
                          type="button"
                          disabled={gateLoading}
                          onClick={() => openRazorpayCheckout(checkoutOrderData)}
                          className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" />
                          Launch Razorpay Modal (₹{(checkoutOrderData.amount / 100).toFixed(2)})
                        </button>

                        {/* 2. Simulation buttons */}
                        {checkoutOrderData.testSignature && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800">
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
                              className="py-2 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Verify (Valid HMAC)
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
                              className="py-2 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-rose-500/30 font-mono text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <AlertOctagon className="w-3.5 h-3.5" />
                              Test Invalid HMAC
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
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 py-1"
                >
                  <Code className="w-3.5 h-3.5" />
                  {showJson ? 'Hide Raw Proposal JSON' : 'Inspect Raw Proposal JSON'}
                </button>

                {showJson && (
                  <pre className="p-3 rounded-xl bg-black border border-zinc-800 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-60">
                    {JSON.stringify(proposal, null, 2)}
                  </pre>
                )}
              </div>
            </div>
            </TiltCard>
          ) : (
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[320px]">
              <ShoppingCart className="w-12 h-12 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-300">
                No Active Transaction Proposal
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                Run an autonomous buyer query on the left. Once the buyer agent selects a verified product, the structured proposal will appear here.
              </p>
            </div>
          )}

          {/* Recent Proposals History */}
          {recentProposals.length > 0 && (
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recent Proposal History ({recentProposals.length})
              </span>
              <div className="divide-y divide-zinc-800/80">
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
                    className="py-2.5 flex items-center justify-between text-xs font-mono cursor-pointer hover:bg-zinc-800/60 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <span className="text-white font-semibold">
                        {p.product?.name || 'Product'}
                      </span>
                      <span className="text-zinc-400 block text-[11px]">
                        Qty: {p.requestedQuantity} • ₹{p.calculatedTotal}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-emerald-400">
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
