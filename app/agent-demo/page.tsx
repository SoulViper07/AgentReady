'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Bot,
  ShoppingCart,
  ArrowRight,
  Clock,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Send,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Store,
  ExternalLink,
  Loader2,
  Code,
} from 'lucide-react';

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

export default function AgentDemoPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [merchantStatus, setMerchantStatus] = useState<string>('LOADING');
  const [merchantScore, setMerchantScore] = useState<number>(0);
  const [activeResponse, setActiveResponse] = useState<BuyerApiResponse | null>(
    null
  );
  const [recentProposals, setRecentProposals] = useState<ProposalRecord[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });
  const [quickVerifying, setQuickVerifying] = useState(false);
  const [countdown, setCountdown] = useState<string>('10:00');

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
          setRecentProposals(data.proposals || []);
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
    if (!activeResponse?.proposal?.expiresAt) return;

    const expiresAtMs = new Date(
      activeResponse.proposal.expiresAt
    ).getTime();

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
  }, [activeResponse?.proposal?.expiresAt]);

  const handleRunBuyer = async (promptQuery: string) => {
    const textToRun = promptQuery.trim();
    if (!textToRun || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToRun }),
      });

      const data: BuyerApiResponse = await res.json();
      setActiveResponse(data);
      if (data.proposal) {
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">
                AgentReady
              </span>
              <span className="text-[10px] uppercase font-mono text-zinc-400">
                Phase 6: Buyer Simulator
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 border-l border-zinc-800 pl-6">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-2"
            >
              <Store className="w-3.5 h-3.5" />
              Remediation Dashboard
            </Link>
            <Link
              href="/agent-demo"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 text-emerald-400 border border-emerald-500/20 flex items-center gap-2"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              AI Buyer Playground
            </Link>
            <Link
              href="/api/catalog"
              target="_blank"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
            >
              <Code className="w-3.5 h-3.5" />
              Catalog API
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono">
            <span className="text-zinc-400">Sweet Crumbs:</span>
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

          <button
            onClick={() => {
              fetchMerchantStatus();
              fetchRecentProposals();
            }}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all"
            title="Refresh status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

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
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              Autonomous Buyer Client
            </h2>
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

          {/* Terminal Execution Log */}
          <div className="flex-1 rounded-xl bg-black border border-zinc-800 shadow-2xl flex flex-col overflow-hidden min-h-[360px]">
            {/* Terminal Header */}
            <div className="bg-zinc-900/90 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
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
            <div className="p-4 flex-1 font-mono text-xs overflow-y-auto flex flex-col gap-4 text-zinc-300 leading-relaxed">
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
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] text-zinc-400 uppercase tracking-wider">
                      Thought Chain:
                    </span>
                    {activeResponse.thoughtProcess.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 text-zinc-300 text-[11px] pl-1"
                      >
                        <span className="text-cyan-500 font-bold shrink-0 mt-0.5">
                          [{idx + 1}]
                        </span>
                        <span>{step}</span>
                      </div>
                    ))}
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
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-400" />
              Transaction Proposal Inspector
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Cryptographically verifiable order payload ready for invariant gating and settlement rails.
            </p>
          </div>

          {/* Active Proposal Card */}
          {activeResponse?.proposal ? (
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 flex flex-col gap-5 shadow-xl">
              {/* Proposal Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    STATUS: {activeResponse.proposal.status}
                  </span>
                </div>

                {/* Expiry Countdown Timer */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Expires in {countdown}</span>
                </div>
              </div>

              {/* Proposal ID */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs font-mono">
                <span className="text-zinc-400">Proposal ID:</span>
                <button
                  type="button"
                  onClick={() => copyProposalId(activeResponse.proposal?.id || '')}
                  className="flex items-center gap-1.5 text-zinc-200 hover:text-white"
                >
                  <span className="truncate max-w-[220px]">
                    {activeResponse.proposal.id}
                  </span>
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>
              </div>

              {/* Product & Quantity Details */}
              <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {activeResponse.proposalData?.productName ||
                        activeResponse.proposal.product?.name}
                    </h3>
                    <span className="text-xs text-zinc-400">
                      Merchant: {activeResponse.proposalData?.merchantName ||
                        activeResponse.proposal.merchant?.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    ₹{activeResponse.proposal.offeredPrice} / box
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800/80 text-xs font-mono">
                  <div>
                    <span className="text-zinc-400 block">Requested Quantity:</span>
                    <span className="text-sm font-bold text-white">
                      {activeResponse.proposal.requestedQuantity} box(es)
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Available In Stock:</span>
                    <span className="text-sm font-bold text-zinc-300">
                      {activeResponse.proposalData?.availableInventory ??
                        activeResponse.proposal.product?.inventory ??
                        'Unknown'} units
                    </span>
                  </div>
                </div>

                {/* Overstock Warning */}
                {activeResponse.proposalData?.inventoryExceeded && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2 mt-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      Requested quantity ({activeResponse.proposal.requestedQuantity}) exceeds verified available inventory. Transaction gate will flag this!
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
                    ₹{activeResponse.proposal.calculatedTotal}
                    <span className="text-xs text-zinc-400 font-normal ml-1">
                      INR
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <span>
                    {activeResponse.proposal.requestedQuantity} × ₹
                    {activeResponse.proposal.offeredPrice}
                  </span>
                </div>
              </div>

              {/* Action Button: Proceed to Transaction Gate */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    alert(
                      `Phase 7 Gate Triggered! Proposal ${activeResponse.proposal?.id} is queued for final deterministic invariant validation and Razorpay order reservation.`
                    );
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Proceed to Transaction Gate (Phase 7)
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>

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
                    {JSON.stringify(activeResponse.proposal, null, 2)}
                  </pre>
                )}
              </div>
            </div>
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
                    className="py-2.5 flex items-center justify-between text-xs font-mono"
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
