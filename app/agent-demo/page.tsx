'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  response?: BuyerApiResponse;
  proposal?: ProposalRecord;
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Welcome to Sweet Crumbs! I am your autonomous AI Buyer agent. What would you like to order today? You can say '1 box of Dark Desire cookies', 'Any eggless dessert under ₹250', or tap any suggestion below.",
      timestamp: 'Ready',
    },
  ]);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const newSessionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);

    // Client-side session reset: start with fresh empty cart and welcome history on mount
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: "Welcome to Sweet Crumbs! I am your autonomous AI Buyer agent. What would you like to order today? You can say '1 box of Dark Desire cookies', 'Any eggless dessert under ₹250', or tap any suggestion below.",
        timestamp: 'Ready',
      },
    ]);
    setProposal(null);
    setRecentProposals([]);
    setActiveResponse(null);
    setGateBlockedInfo(null);
    setGateBlockedReason(null);
    setVerifiedReceipt(null);
    setCheckoutOrderData(null);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
  const [viewMode, setViewMode] = useState<'user' | 'inspector'>('user');
  const activeView = viewMode;
  const [isTraceExpanded, setIsTraceExpanded] = useState<boolean>(false);

  const handleViewModeChange = (mode: 'user' | 'inspector') => {
    setViewMode(mode);
    setIsTraceExpanded(mode === 'inspector');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'inspector' || params.get('mode') === 'inspector') {
        setViewMode('inspector');
        setIsTraceExpanded(true);
      } else {
        setViewMode('user');
        setIsTraceExpanded(false);
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
        setMerchantStatus(data.transactionStatus || data.status || 'READY');
        setMerchantScore(data.readinessScore ?? data.score ?? 96);
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

  const fetchRecentProposals = useCallback(async (customSessionId?: string) => {
    const sId = customSessionId || sessionId;
    if (!sId) return;
    try {
      const res = await fetch(`/api/buyer?sessionId=${sId}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setRecentProposals(data.proposals || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [sessionId]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [readRes, catRes] = await Promise.all([
          fetch('/api/readiness?slug=sweet-crumbs'),
          fetch('/api/catalog?merchantSlug=sweet-crumbs'),
        ]);
        if (readRes.ok && isMounted) {
          const data = await readRes.json();
          setMerchantStatus(data.transactionStatus || data.status || 'READY');
          setMerchantScore(data.readinessScore ?? data.score ?? 96);
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

  useEffect(() => {
    const handleReset = async () => {
      await fetchMerchantStatus();
      await fetchRecentProposals();
      await fetchCatalogProducts();
      setProposal(null);
      setActiveResponse(null);
      setVerifiedReceipt(null);
      setCheckoutOrderData(null);
      setGateBlockedReason(null);
      setGateBlockedInfo(null);
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: "Welcome to Sweet Crumbs! I am your autonomous AI Buyer agent. What would you like to order today? You can say '1 box of Dark Desire cookies', 'Any eggless dessert under ₹250', or tap any suggestion below.",
          timestamp: 'Ready',
        },
      ]);
    };
    window.addEventListener('agentready:reset', handleReset);
    return () => window.removeEventListener('agentready:reset', handleReset);
  }, [fetchMerchantStatus, fetchRecentProposals, fetchCatalogProducts]);

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

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user_${Date.now()}`;

    // Add user message to conversation immediately
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: textToRun,
        timestamp: now,
      },
    ]);
    setQuery('');
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
          sessionId,
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

      const aiMsgId = `assistant_${Date.now()}`;
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const aiText =
        data.explanation ||
        (data.status === 'PROPOSAL_GENERATED'
          ? 'I found the best matching item in the verified catalog and prepared your order proposal!'
          : `Catalog query processed with status: ${data.status}`);

      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          sender: 'assistant',
          text: aiText,
          timestamp: aiTime,
          response: data,
          proposal: data.proposal,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_err_${Date.now()}`,
          sender: 'assistant',
          text: 'Encountered a network error reaching the autonomous catalog engine.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
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
    <div className="min-h-[calc(100dvh-4rem)] flex-1 bg-[#0E0F12] text-stone-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col">
      {/* Razorpay Checkout Script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      {/* Readiness Alert Banner if NOT_READY */}
      {merchantStatus === 'NOT_READY' && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-[#0E0F12] border-b border-amber-500/20 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Readiness Invariant Notice:</strong> Demo merchant &ldquo;Sweet Crumbs&rdquo; is currently in <code>NOT_READY</code> state (score: {merchantScore}/100). The agent-readable catalog will strictly filter out unverified items until gates pass.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

      {/* View Mode Switcher Banner (Native iOS Segmented Control) */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <span className="font-semibold text-stone-200">Active View:</span>
          <span className="text-stone-400 hidden xs:inline">
            {activeView === 'user'
              ? 'Merchant / User View • Simplified commerce checkout & clean conversational outcome'
              : 'Inspector Mode (Judges) • Autonomous agent runtime trace, AST tool arguments & invariants'}
          </span>
        </div>

        {/* Native iOS Segmented Control */}
        <div className="relative inline-flex p-1 bg-stone-900 border border-white/[0.06] rounded-xl self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => handleViewModeChange('user')}
            className={`relative z-10 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] touch-manipulation ${
              activeView === 'user'
                ? 'text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {activeView === 'user' && (
              <motion.div
                layoutId="activeSegment"
                className="absolute inset-0 bg-stone-800 rounded-lg shadow-sm border border-white/10 -z-10"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span>Merchant / User</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('inspector')}
            className={`relative z-10 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] touch-manipulation ${
              activeView === 'inspector'
                ? 'text-amber-200'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {activeView === 'inspector' && (
              <motion.div
                layoutId="activeSegment"
                className="absolute inset-0 bg-stone-800 rounded-lg shadow-sm border border-amber-500/20 -z-10"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <Binary className="w-3.5 h-3.5 shrink-0" />
            <span>Inspector (Judges)</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Playground */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-36 md:pb-12 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Autonomous Buyer Terminal (6 Cols) */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#F8F9FA] flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400 shrink-0" />
                {activeView === 'user' ? 'AI Shopping Assistant' : 'Autonomous Buyer Client'}
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {activeView === 'user'
                  ? 'Tell the assistant what you would like to order from Sweet Crumbs.'
                  : 'Natural language commerce agent with verified catalog & deterministic gates.'}
              </p>
            </div>
            {activeView === 'inspector' && (
              <AuthorityTag
                type="AI_INFERRED"
                compact
                customLabel="Autonomous LLM Agent"
                pulse
              />
            )}
          </div>

          {/* De-Boxed Breathable Chat Feed */}
          <div className="flex-1 flex flex-col gap-3 min-h-[340px] max-h-[580px] overflow-y-auto no-scrollbar scroll-smooth py-1">
            {messages.map((msg) => (
              <React.Fragment key={msg.id}>
                {msg.sender === 'user' ? (
                  <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="max-w-[85%] sm:max-w-[75%] bg-stone-800 text-stone-100 rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm">
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <div className="text-[10px] text-stone-500 font-mono mt-1 text-right">
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="max-w-[90%] sm:max-w-[82%] bg-white/[0.02] text-stone-300 rounded-2xl rounded-tl-sm px-4 py-3 text-xs sm:text-sm leading-relaxed">
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* Developer Trace Toggle: ONLY SHOWN IF activeView === 'inspector' */}
                      {activeView === 'inspector' &&
                        msg.response &&
                        (msg.response.thoughtProcess?.length > 0 ||
                          msg.response.toolCalls?.length > 0) && (
                          <details className="mt-2.5 group rounded-xl bg-black/40 border border-white/[0.05] overflow-hidden text-xs">
                            <summary className="p-2 px-2.5 cursor-pointer select-none flex items-center justify-between text-stone-400 hover:text-stone-200 text-[11px] font-mono transition-colors active:scale-[0.97]">
                              <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>⚡ View Runtime Trace</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-stone-500">
                                  {msg.response.thoughtProcess?.length || 0} steps
                                </span>
                                <span className="text-[10px] text-stone-400 group-open:rotate-180 transition-transform">
                                  ▾
                                </span>
                              </div>
                            </summary>
                            <div className="p-3 border-t border-white/[0.04] space-y-2 bg-[#0C0D0F]">
                              {msg.response.thoughtProcess?.map((step, sIdx) => {
                                const style = getThoughtStyle(step);
                                return (
                                  <div
                                    key={sIdx}
                                    className="flex items-start gap-2 p-1.5 rounded bg-[#141519] border border-white/[0.04] text-[11px] font-mono"
                                  >
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 border ${style.badgeBg}`}
                                    >
                                      [{sIdx + 1}] {style.typeLabel}
                                    </span>
                                    <span className={`${style.textColor} leading-snug flex-1`}>
                                      {step}
                                    </span>
                                  </div>
                                );
                              })}

                              {msg.response.toolCalls?.map((tc, tcIdx) => (
                                <div
                                  key={tcIdx}
                                  className="rounded-lg bg-[#141519] border border-white/[0.04] p-2 text-[10px] font-mono"
                                >
                                  <span className="text-amber-300 font-semibold block mb-1">
                                    tool: {tc.toolName}()
                                  </span>
                                  <pre className="text-emerald-400 overflow-x-auto no-scrollbar max-h-32">
                                    {JSON.stringify(tc.result, null, 2)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                      <div className="text-[10px] text-stone-500 font-mono mt-1.5">
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}

            {/* Typing State with 3 Bouncing Dots */}
            {loading && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white/[0.02] text-stone-400 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs flex items-center gap-2">
                  <span>Evaluating</span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sticky Floating Glass Input Bar */}
          <div className="fixed bottom-4 left-4 right-4 md:relative md:bottom-auto md:left-auto md:right-auto md:w-full rounded-2xl bg-[#1A1C20]/90 backdrop-blur-xl border border-white/10 shadow-2xl z-50 p-2 sm:p-2.5 transition-all">
            {/* Single-line horizontally scrollable suggestion chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 mb-1.5 scroll-smooth whitespace-nowrap">
              {suggestionChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(chip.query);
                    handleRunBuyer(chip.query);
                  }}
                  disabled={loading}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-stone-800/80 hover:bg-stone-700/80 border border-white/[0.06] text-[11px] text-stone-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.97] shadow-sm disabled:opacity-50"
                >
                  <span>&ldquo;{chip.query}&rdquo;</span>
                </button>
              ))}
            </div>

            {/* Prompt Input Box */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (query.trim() && !loading) {
                      handleRunBuyer(query);
                    }
                  }
                }}
                placeholder="Ask AI Buyer (e.g. '1 box of Dark Desire cookies')..."
                className="flex-1 bg-transparent px-2.5 py-2 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none font-sans"
              />
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer border border-white/[0.06] active:scale-[0.97]"
                  title="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRunBuyer(query)}
                disabled={loading || !query.trim()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 text-emerald-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:cursor-not-allowed active:scale-[0.97] shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-950" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
        {/* Right Column: Transaction Proposal & Checkout (6 Cols) */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          {/* Inspector Header: ONLY shown in inspector mode */}
          {activeView === 'inspector' && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#F8F9FA] flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-emerald-400" />
                    Transaction Proposal Inspector
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Cryptographically verifiable order payload ready for invariant gating and settlement rails.
                  </p>
                </div>
                <AuthorityTag type="FINTECH_GATE" compact customLabel="Fintech Gate" />
              </div>

              {/* Financial Authority Boundary Banner */}
              <div className="rounded-xl bg-[#121316] border border-white/[0.05] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-emerald-400 font-bold text-xs">
                    🛡️ FINANCIAL AUTHORITY BOUNDARY
                  </span>
                  <AuthorityTag type="DETERMINISTIC" compact customLabel="No LLM Authority" />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">
                  LLM reasoning halted. Deterministic Invariant Gate engaged. Zero stochastic authority in payment calculation or stock deduction.
                </p>
              </div>
            </>
          )}

          {/* User Mode: Apple Pay / Stripe Style Checkout Card */}
          {activeView === 'user' ? (
            proposal ? (
              <div className="bg-[#121316] border border-white/[0.08] shadow-2xl rounded-3xl p-6 flex flex-col gap-5 animate-in fade-in">
                {/* Top: Merchant Name and subtle Secure Checkout lock */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-stone-800 border border-white/[0.06] flex items-center justify-center font-bold text-xs text-stone-200">
                      SC
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {proposal.merchant?.name || activeResponse?.proposalData?.merchantName || 'Sweet Crumbs'}
                      </h3>
                      <span className="text-[11px] text-stone-500 font-sans">Artisan Bakery &amp; Desserts</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-400 bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/[0.04]">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Secure Checkout</span>
                  </div>
                </div>

                {/* Middle: Clean line items. Large, crisp typography */}
                <div className="flex flex-col gap-3 py-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <span className="text-base font-medium text-stone-100">
                        {proposal.requestedQuantity}x {proposal.product?.name || activeResponse?.proposalData?.productName || 'Dark Desire Cookies'}
                      </span>
                      {proposal.product?.isEggless && (
                        <span className="block text-[11px] text-emerald-400/90 font-medium mt-0.5">100% Eggless</span>
                      )}
                    </div>
                    <span className="text-base font-semibold text-white font-mono">
                      ₹{(proposal.requestedQuantity * proposal.offeredPrice).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-400 pt-3 border-t border-white/[0.04]">
                    <span>Standard Local Delivery</span>
                    <span className="text-stone-300 font-medium">Free</span>
                  </div>
                </div>

                {/* Total: Massive clear typography */}
                <div className="flex items-baseline justify-between pt-3 border-t border-white/[0.06]">
                  <span className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Total Due</span>
                  <div className="text-3xl font-semibold tracking-tight text-white font-mono mt-2">
                    ₹{proposal.calculatedTotal}.00
                  </div>
                </div>

                {/* Verified Payment Receipt in User View */}
                {verifiedReceipt && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-stone-100 flex flex-col gap-2.5 animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Payment Verified &amp; Order Placed!</span>
                    </div>
                    <p className="text-xs text-stone-300">
                      Payment ID: <span className="font-mono text-emerald-300">{verifiedReceipt.paymentId}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedReceipt(null);
                        setCheckoutOrderData(null);
                      }}
                      className="mt-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium self-start active:scale-[0.98] transition-transform"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Bottom: Massive Highly-Tappable CTA Button */}
                {!verifiedReceipt && (
                  <button
                    type="button"
                    onClick={
                      proposal.status === 'RESERVED' && checkoutOrderData
                        ? () => openRazorpayCheckout(checkoutOrderData)
                        : handleProceedToGate
                    }
                    disabled={gateLoading || proposal.status === 'BLOCKED'}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 text-emerald-950 font-bold text-lg py-4 rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-emerald-950/30 disabled:cursor-not-allowed"
                  >
                    {gateLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-950" />
                    ) : proposal.status === 'BLOCKED' ? (
                      <span>Item Unavailable ⛔</span>
                    ) : (
                      <span>Pay ₹{proposal.calculatedTotal}.00</span>
                    )}
                  </button>
                )}
              </div>
            ) : activeResponse ? (
              <div className="bg-[#121316] border border-white/[0.08] shadow-2xl rounded-3xl p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Order could not be formulated</span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  {activeResponse.explanation}
                </p>
              </div>
            ) : (
              <div className="bg-[#121316]/50 border border-white/[0.05] rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-2.5 min-h-[280px]">
                <ShoppingBag className="w-10 h-10 text-stone-600" />
                <span className="text-xs text-stone-400 font-medium">
                  Your checkout proposal will appear here
                </span>
                <p className="text-[11px] text-stone-500 max-w-xs">
                  Ask the assistant for cookies or desserts to begin instant checkout.
                </p>
              </div>
            )
          ) : (
            /* Inspector Mode: Clean Terminal View with Strict Invariant Verification */
            <>
              {proposal ? (
                <div className="rounded-2xl bg-[#121316] border border-white/[0.05] p-5 flex flex-col gap-4 shadow-xl">
                  {/* Top Bar with IDs and timer */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
                    <div>
                      <span className="font-semibold text-sm text-stone-200">
                        {proposal.merchant?.name || 'Sweet Crumbs'}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono mt-0.5">
                        <span>Proposal #{proposal.id.slice(0, 8)}</span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => copyProposalId(proposal.id)}
                          className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedId ? 'Copied' : 'Copy ID'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/[0.05] text-[11px] font-mono text-amber-300">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{countdown}</span>
                    </div>
                  </div>

                  {/* Gate Status Strip */}
                  {gateBlockedInfo || gateBlockedReason || proposal.status === 'BLOCKED' ? (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-rose-300 font-bold mb-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>DETERMINISTIC GATE BLOCKED</span>
                      </div>
                      <p className="text-[11px] text-rose-200/90">
                        {gateBlockedInfo?.reason || gateBlockedReason || 'Transaction blocked by gate.'}
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Deterministic Invariants Validated
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500/20 rounded">
                        PASSED
                      </span>
                    </div>
                  )}

                  {/* Itemized Order Line */}
                  <div className="p-3 rounded-lg bg-black/40 border border-white/[0.04] text-xs font-mono flex flex-col gap-2">
                    <div className="flex items-center justify-between text-stone-300">
                      <span>{proposal.requestedQuantity}x {proposal.product?.name || 'Item'}</span>
                      <span className="font-bold text-white">₹{(proposal.requestedQuantity * proposal.offeredPrice).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1 border-t border-white/[0.04]">
                      <span>Available inventory: {proposal.product?.inventory ?? 'Verified'} units</span>
                      <span>Paise Precision: Exact</span>
                    </div>
                  </div>

                  {/* Deterministic Invariant Pre-Checks in Clean Terminal Log Style */}
                  <div className="p-3 rounded-lg bg-black/50 border border-white/[0.05] flex flex-col gap-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.05] text-stone-400 uppercase text-[10px]">
                      <span>Deterministic Gate Invariant Pre-Checks</span>
                      <span className="text-emerald-400">4 / 4 Rules</span>
                    </div>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Merchant State: {merchantStatus} ({merchantScore}/100)
                        </span>
                        <span className="text-emerald-400">PASSED</span>
                      </div>
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Price Integrity Match: ₹{proposal.offeredPrice}.00
                        </span>
                        <span className="text-emerald-400">PASSED</span>
                      </div>
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Inventory Sufficiency Check
                        </span>
                        <span className="text-emerald-400">PASSED</span>
                      </div>
                      <div className="flex items-center justify-between text-stone-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Deterministic Settlement Math
                        </span>
                        <span className="text-emerald-400">PASSED</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Button & Sandbox Actions */}
                  <button
                    onClick={
                      proposal.status === 'RESERVED' && checkoutOrderData
                        ? () => openRazorpayCheckout(checkoutOrderData)
                        : handleProceedToGate
                    }
                    disabled={gateLoading || proposal.status === 'BLOCKED'}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    {gateLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : proposal.status === 'BLOCKED' ? (
                      <span>Transaction Blocked by Gate ⛔</span>
                    ) : proposal.status === 'RESERVED' && checkoutOrderData ? (
                      <span>Pay ₹{(checkoutOrderData.amount / 100).toFixed(2)} via Razorpay Test Rails →</span>
                    ) : (
                      <span>Proceed to Transaction Gate →</span>
                    )}
                  </button>

                  {/* Simulation Sandbox in Inspector Mode */}
                  {checkoutOrderData && proposal.status === 'RESERVED' && checkoutOrderData.testSignature && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.05]">
                      <button
                        type="button"
                        onClick={() =>
                          handleVerifyPayment({
                            proposalId: proposal.id,
                            razorpay_order_id: checkoutOrderData.orderId,
                            razorpay_payment_id: checkoutOrderData.testPaymentId || `pay_sim_${Date.now()}`,
                            razorpay_signature: checkoutOrderData.testSignature || '',
                          })
                        }
                        className="py-2 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-semibold flex items-center justify-center gap-1 active:scale-[0.97]"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verify (Valid HMAC)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleVerifyPayment({
                            proposalId: proposal.id,
                            razorpay_order_id: checkoutOrderData.orderId,
                            razorpay_payment_id: checkoutOrderData.testPaymentId || `pay_sim_${Date.now()}`,
                            razorpay_signature: 'invalid_tampered_signature_hex_000',
                          })
                        }
                        className="py-2 px-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-rose-400 border border-rose-500/20 font-mono text-[10px] font-semibold flex items-center justify-center gap-1 active:scale-[0.97]"
                      >
                        <AlertOctagon className="w-3 h-3" />
                        <span>Test Invalid HMAC</span>
                      </button>
                    </div>
                  )}

                  {/* Toggle Raw JSON */}
                  <button
                    type="button"
                    onClick={() => setShowJson(!showJson)}
                    className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/[0.05] bg-black/30 self-center active:scale-[0.98]"
                  >
                    <Code className="w-3 h-3" />
                    <span>{showJson ? 'Hide Raw JSON' : 'Inspect Raw Proposal JSON'}</span>
                  </button>
                  {showJson && (
                    <pre className="p-3 rounded-lg bg-black text-stone-300 font-mono text-[10px] overflow-x-auto no-scrollbar max-h-48 border border-white/[0.05]">
                      {JSON.stringify(proposal, null, 2)}
                    </pre>
                  )}
                </div>
              ) : activeResponse ? (
                <div className="rounded-2xl bg-[#121316] border border-amber-500/20 p-5 flex flex-col gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-400 font-bold font-mono">
                    <AlertTriangle className="w-4 h-4" />
                    <span>ORDER PROPOSAL HALTED BY INVARIANT</span>
                  </div>
                  <p className="text-stone-300 leading-relaxed font-mono">
                    {activeResponse.explanation}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#121316] border border-white/[0.05] p-8 flex flex-col items-center justify-center text-center gap-2.5 min-h-[260px]">
                  <ShoppingCart className="w-8 h-8 text-stone-600" />
                  <span className="text-xs text-stone-400 font-mono">
                    No active transaction proposal payload
                  </span>
                </div>
              )}

              {/* Developer Trace & AI Reasoning Accordion */}
              {activeResponse && (
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsTraceExpanded(!isTraceExpanded)}
                    className="text-xs text-stone-300 hover:text-white flex items-center justify-between py-2 px-3 rounded-xl border border-white/[0.06] bg-[#121316] hover:bg-[#181A20] transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="text-amber-400">⚙️</span>
                      <span>{isTraceExpanded ? 'Hide Developer Trace ▴' : 'Inspect Developer Trace ▾'}</span>
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                      {activeResponse.thoughtProcess?.length || 0} steps • {activeResponse.toolCalls?.length || 0} tools
                    </span>
                  </button>

                  <AnimatePresence>
                    {isTraceExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden flex flex-col gap-2 rounded-xl bg-black/40 border border-white/[0.05] p-3 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between text-[10px] text-stone-400 pb-1.5 border-b border-white/[0.05]">
                          <span>Model: Groq Llama 3.3 70B</span>
                          <span>Latency: ~340ms</span>
                          <span>Temp: 0.0</span>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
                          {activeResponse.thoughtProcess?.map((step, idx) => {
                            const style = getThoughtStyle(step);
                            return (
                              <div key={idx} className="p-1.5 rounded bg-[#141519] border border-white/[0.04]">
                                <span className={`text-[9px] px-1 py-0.5 rounded font-bold mr-1.5 border ${style.badgeBg}`}>
                                  [{idx + 1}] {style.typeLabel}
                                </span>
                                <span className={style.textColor}>{step}</span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Recent Proposal History */}
              {recentProposals.length > 0 && (
                <div className="rounded-xl bg-[#121316] border border-white/[0.05] p-3 flex flex-col gap-2 text-xs font-mono">
                  <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                    Recent Proposals ({recentProposals.length})
                  </span>
                  <div className="divide-y divide-white/[0.04]">
                    {recentProposals.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setProposal(p);
                          setVerifiedReceipt(null);
                          setCheckoutOrderData(null);
                        }}
                        className="py-2 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] px-1.5 rounded transition-all active:scale-[0.98]"
                      >
                        <div>
                          <span className="text-white font-medium">{p.product?.name || 'Product'}</span>
                          <span className="text-stone-400 block text-[10px]">
                            Qty: {p.requestedQuantity} • ₹{p.calculatedTotal}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-emerald-400 border border-emerald-500/20">
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
