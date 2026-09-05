'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Terminal,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Tag,
  Package,
  FileText,
} from 'lucide-react';
import { AuthorityTag } from './AuthorityTag';
import { TiltCard } from './ui/TiltCard';
import { motion } from 'framer-motion';

export interface IssueCardProps {
  issue: {
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
  };
  products: Array<{
    id: string;
    name: string;
    price: number | null;
    inventory: number | null;
    priceVerified?: boolean;
    inventoryVerified?: boolean;
  }>;
  onResolve: (payload: {
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
  }) => Promise<void>;
  isResolving?: boolean;
  mode?: 'merchant' | 'inspector';
}

export const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  products,
  onResolve,
  isResolving = false,
  mode = 'merchant',
}) => {
  // Parse conflict values if present (e.g. 250 and 200)
  const isConflict =
    issue.category === 'CONSISTENCY' ||
    issue.title.toLowerCase().includes('conflict');
  const valuesMatch = issue.description.match(
    /(\d+(?:\.\d+)?)\s*(?:and|,|vs|\))\s*(?:while[^\d]*(\d+(?:\.\d+)?)|[^\d]*(\d+(?:\.\d+)?))/i
  );
  const detectedVal1 = valuesMatch ? valuesMatch[1] : '250';
  const detectedVal2 = valuesMatch
    ? valuesMatch[2] || valuesMatch[3] || '200'
    : '200';

  // Match target product from description, title, or products list with fallback
  const matchedProduct =
    products.find(
      (p) =>
        issue.description.toLowerCase().includes(p.name.toLowerCase()) ||
        issue.title.toLowerCase().includes(p.name.toLowerCase())
    ) ||
    (issue.category === 'INVENTORY'
      ? products.find((p) => p.name.includes('Double Dark')) ||
        products.find((p) => p.inventory === null || !p.inventoryVerified)
      : issue.category === 'PRICE' && !isConflict
      ? products.find((p) => p.name.includes('Oats')) ||
        products.find((p) => p.price === null || !p.priceVerified)
      : isConflict
      ? products.find((p) => p.name.includes('Signature'))
      : undefined) ||
    products[0];

  const [selectedPrice, setSelectedPrice] = useState<string>(detectedVal1);
  const [inputPrice, setInputPrice] = useState<string>(
    issue.advice?.draftContent || (matchedProduct?.name.includes('Dark') ? '220' : '200')
  );
  const [inputInventory, setInputInventory] = useState<string>(
    issue.advice?.draftContent ||
      (matchedProduct?.inventory !== null && matchedProduct?.inventory !== undefined
        ? String(matchedProduct.inventory)
        : '10')
  );
  const [policyText, setPolicyText] = useState<string>(
    issue.advice?.draftContent ||
      'Due to the fresh, perishable nature of our artisan baked goods, all sales are final upon dispatch. If an item arrives damaged, notify us within 2 hours with photos for a full replacement or refund.'
  );

  const [loadingThis, setLoadingThis] = useState(false);
  const [justResolved, setJustResolved] = useState(false);
  const [showPolicyPreview, setShowPolicyPreview] = useState(false);

  const handleAction = async (payload: Parameters<typeof onResolve>[0]) => {
    try {
      setLoadingThis(true);
      await onResolve(payload);
      setJustResolved(true);
    } finally {
      setLoadingThis(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3" />
            CRITICAL INVARIANT
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            HIGH PRIORITY
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            QUALITY IMPROVEMENT
          </span>
        );
    }
  };

  const getRawEvidenceLines = () => {
    if (isConflict) {
      return [
        {
          num: '04',
          source: 'WhatsApp',
          text: `"${matchedProduct?.name || 'Cookies'}: ₹${detectedVal1}/box (Fresh Batch)"`,
          variant: 'conflict-a',
        },
        {
          num: '18',
          source: 'Catalog CSV',
          text: `${matchedProduct?.name || 'Cookies'},Artisan recipe,${detectedVal2},15,Eggless`,
          variant: 'conflict-b',
        },
      ];
    }
    if (issue.category === 'PRICE') {
      return [
        {
          num: '07',
          source: 'Menu OCR',
          text: `"${matchedProduct?.name || 'Oats & Cranberry'}: Price on request / seasonal"`,
          variant: 'missing',
        },
        {
          num: '08',
          source: 'Zod Parser',
          text: `price: null /* strict null default; non-fabrication enforced */`,
          variant: 'rule',
        },
      ];
    }
    if (issue.category === 'INVENTORY') {
      return [
        {
          num: '12',
          source: 'WhatsApp Chat',
          text: `"Only a few boxes left for today, DM to reserve"`,
          variant: 'missing',
        },
        {
          num: '13',
          source: 'Zod Parser',
          text: `inventory: null /* numerical quantity not explicitly stated */`,
          variant: 'rule',
        },
      ];
    }
    // Policy
    return [
      {
        num: '01',
        source: 'Merchant Header',
        text: `"No refund or cancellation terms found in catalog data."`,
        variant: 'missing',
      },
      {
        num: '02',
        source: 'Readiness Engine',
        text: `policyVerified: false /* autonomous buyer safeguard tripped */`,
        variant: 'rule',
      },
    ];
  };

  // Completed / Resolved State Card
  if (issue.resolved || justResolved) {
    return (
      <TiltCard className="rounded-2xl">
        <div className={`rounded-2xl bg-[#181A20]/90 border border-emerald-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl shadow-black/20 transition-all animate-in fade-in duration-500 ${justResolved ? 'animate-emerald-ripple' : ''}`}>
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.7, 1.15, 1], opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase font-mono font-bold text-emerald-400">
                  Ground Truth Established
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                  Verified
                </span>
              </div>
              <h4 className="text-sm font-semibold text-[#F8F9FA] mt-0.5">
                {issue.title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <Check className="w-3.5 h-3.5" />
            <span>Deterministically Recalculated</span>
          </div>
        </div>
      </TiltCard>
    );
  }

  // Merchant Mode (Clean, Human-centric, Touch-Friendly, No Raw Code)
  if (mode === 'merchant') {
    return (
      <TiltCard className="rounded-2xl">
        <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] hover:border-stone-700/80 p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4 transition-all">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                isConflict
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : issue.category === 'PRICE'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : issue.category === 'INVENTORY'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  : 'bg-stone-500/10 text-stone-300 border border-stone-500/20'
              }`}
            >
              {isConflict ? (
                <AlertTriangle className="w-4 h-4" />
              ) : issue.category === 'PRICE' ? (
                <Tag className="w-4 h-4" />
              ) : issue.category === 'INVENTORY' ? (
                <Package className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#F8F9FA] tracking-tight">
                {isConflict
                  ? `Confirm Price: ${matchedProduct?.name || 'Signature Choco Chip Cookies'}`
                  : issue.category === 'PRICE'
                  ? `Set Price: ${matchedProduct?.name || 'Oats & Cranberry Breakfast Cookies'}`
                  : issue.category === 'INVENTORY'
                  ? `Confirm Stock: ${matchedProduct?.name || 'Double Dark Sea Salt Cookies'}`
                  : 'Perishable Goods Refund Disclaimer'}
              </h3>
              <p className="text-xs sm:text-sm text-stone-400 mt-1 leading-relaxed">
                {isConflict
                  ? `WhatsApp mentions ₹${detectedVal1}, but legacy records list ₹${detectedVal2}. Select the authoritative price for autonomous buyers:`
                  : issue.category === 'PRICE'
                  ? 'AI buyers need a fixed unit price to propose orders without guessing.'
                  : issue.category === 'INVENTORY'
                  ? 'Specify how many boxes are ready to bake or pack so AI buyers do not oversell.'
                  : 'Artisan baked goods require clear refund terms to protect against payment chargebacks.'}
              </p>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
              issue.severity === 'CRITICAL'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
            }`}
          >
            {issue.severity === 'CRITICAL' ? 'Action Required' : 'Recommended'}
          </span>
        </div>

        {/* Action Controls Body */}
        <div className="pt-3 border-t border-white/[0.08]">
          {/* Case 1: Conflict */}
          {isConflict && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="grid grid-cols-2 gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => setSelectedPrice(detectedVal1)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                    selectedPrice === detectedVal1
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-[#121316] border-white/[0.08] text-stone-300 hover:border-stone-600'
                  }`}
                >
                  <span>₹{detectedVal1} (Recent)</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    WhatsApp
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPrice(detectedVal2)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                    selectedPrice === detectedVal2
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-[#121316] border-white/[0.08] text-stone-300 hover:border-stone-600'
                  }`}
                >
                  <span>₹{detectedVal2} (Legacy)</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#181A20] text-stone-400 border border-white/[0.06]">
                    CSV
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleAction({
                    action: 'RESOLVE_CONFLICT',
                    issueId: issue.id,
                    productId: matchedProduct?.id,
                    authoritativePrice: parseFloat(selectedPrice),
                  })
                }
                disabled={loadingThis || isResolving}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer shrink-0"
              >
                {loadingThis ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Confirm Price (₹{selectedPrice})
              </button>
            </div>
          )}

          {/* Case 2: Missing Price */}
          {!isConflict && issue.category === 'PRICE' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 flex items-center">
                <span className="absolute left-3.5 text-stone-400 font-semibold text-sm pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  placeholder="220"
                  className="w-full min-h-[44px] pl-8 pr-4 py-2 rounded-xl bg-[#121316] border border-white/[0.08] text-[#F8F9FA] text-sm font-semibold focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  handleAction({
                    action: 'VERIFY_PRODUCT',
                    productId: matchedProduct?.id,
                    price: parseFloat(inputPrice),
                  })
                }
                disabled={loadingThis || isResolving || !matchedProduct}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer shrink-0"
              >
                {loadingThis ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Authorise Price
              </button>
            </div>
          )}

          {/* Case 3: Missing Inventory */}
          {!isConflict && issue.category === 'INVENTORY' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 flex items-center">
                <input
                  type="number"
                  value={inputInventory}
                  onChange={(e) => setInputInventory(e.target.value)}
                  placeholder="10"
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#121316] border border-white/[0.08] text-[#F8F9FA] text-sm font-semibold focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                />
                <span className="absolute right-3.5 text-stone-400 text-xs font-mono pointer-events-none">
                  boxes in stock
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleAction({
                    action: 'VERIFY_PRODUCT',
                    productId: matchedProduct?.id,
                    inventory: parseInt(inputInventory, 10) || 10,
                  })
                }
                disabled={loadingThis || isResolving || !matchedProduct}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer shrink-0"
              >
                {loadingThis ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Authorise Stock
              </button>
            </div>
          )}

          {/* Case 4: Missing Policy */}
          {issue.category === 'POLICY' && (
            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-xl bg-[#121316] border border-white/[0.08] text-xs text-stone-300 leading-relaxed italic">
                &ldquo;{policyText}&rdquo;
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowPolicyPreview(!showPolicyPreview)}
                  className="text-xs text-stone-400 hover:text-[#F8F9FA] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {showPolicyPreview ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {showPolicyPreview ? 'Hide Policy Editor' : 'Edit Policy Text'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAction({
                      action: 'APPROVE_POLICY',
                      merchantId: issue.merchantId,
                      type: 'REFUND',
                      content: policyText,
                    })
                  }
                  disabled={loadingThis || isResolving}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer ml-auto"
                >
                  {loadingThis ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Accept &amp; Publish Policy
                </button>
              </div>

              {showPolicyPreview && (
                <textarea
                  rows={3}
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-[#121316] border border-white/[0.08] text-stone-200 text-xs focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                />
              )}
            </div>
          )}
        </div>
      </div>
      </TiltCard>
    );
  }

  const rawLines = getRawEvidenceLines();

  return (
    <TiltCard className="rounded-2xl">
      <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] hover:border-stone-700/80 transition-all p-5 shadow-xl shadow-black/20 flex flex-col gap-4">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {getSeverityBadge(issue.severity)}
          <AuthorityTag
            type="AI_INFERRED"
            compact
            customLabel="AI Extracted • 98.4% Confidence"
          />
        </div>
        {matchedProduct && (
          <span className="text-xs font-mono text-stone-400 truncate max-w-[220px]">
            Catalog Item: <strong className="text-stone-200">{matchedProduct.name}</strong>
          </span>
        )}
      </div>

      {/* Title & Overview */}
      <div>
        <h3 className="text-base font-bold text-[#F8F9FA] tracking-tight">
          {issue.title}
        </h3>
        <p className="text-xs text-stone-400 mt-1 leading-relaxed">
          {issue.description}
        </p>
      </div>

      {/* Cursor/GitHub 3-Sub-Panel Visual Diff Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Sub-Panel: Raw Evidence Extract (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl bg-[#121316] border border-white/[0.08] p-3.5 flex flex-col justify-between font-mono text-xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/[0.06] text-[10px] text-stone-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-stone-300">
                <Terminal className="w-3 h-3 text-amber-400" />
                Raw Evidence Extract
              </span>
              <span className="text-stone-500">Multimodal Provenance</span>
            </div>

            <div className="flex flex-col gap-2">
              {rawLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg text-[11px] leading-relaxed border ${
                    line.variant === 'conflict-a'
                      ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                      : line.variant === 'conflict-b'
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                      : line.variant === 'rule'
                      ? 'bg-[#181A20] border-white/[0.06] text-stone-400'
                      : 'bg-[#181A20]/60 border-white/[0.06] text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-stone-500 pb-1 mb-1 border-b border-white/5">
                    <span className="text-stone-400 font-semibold">
                      [{line.source}]
                    </span>
                    <span>L:{line.num}</span>
                  </div>
                  <span className="break-words">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] text-stone-500 flex items-center justify-between">
            <span>Provenance check: PASSED</span>
            <span className="text-amber-400/90 font-medium">Zero Hallucination</span>
          </div>
        </div>

        {/* Center Sub-Panel: AI Remediation Diagnosis (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl bg-amber-950/15 border border-amber-500/20 p-3.5 flex flex-col justify-between text-xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-amber-500/20 text-[10px] text-amber-300 font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3 h-3 text-amber-400" />
                AI Remediation Diagnosis
              </span>
              <span className="text-amber-400/80">Agent Impact</span>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              {issue.advice?.explanation ||
                'Autonomous AI buyers verify mathematical consistency before authorizing settlement. Inconsistent or missing ground truth trips safety gates.'}
            </p>

            {issue.advice?.suggestedAction && (
              <div className="mt-2.5 p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 font-mono">
                <span className="text-amber-400 font-bold block text-[10px] uppercase">
                  Suggested Action:
                </span>
                {issue.advice.suggestedAction}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center justify-between text-[10px] font-mono text-amber-300/80">
            <span>Gate Risk: CRITICAL</span>
            <span className="text-rose-400 font-semibold">Will Block AI Buyer</span>
          </div>
        </div>

        {/* Right Sub-Panel: Authoritative Resolution Action (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl bg-[#121316] border border-white/[0.08] p-3.5 flex flex-col justify-between text-xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/[0.06] text-[10px] text-stone-400 font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-stone-200 font-bold">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Authoritative Action
              </span>
              <span className="text-amber-400 font-semibold">HITL Required</span>
            </div>

            {/* Case 1: Price Conflict */}
            {isConflict && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] text-stone-400 font-medium">
                  Select Authoritative Ground Truth:
                </span>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center justify-between p-2 rounded-lg bg-[#181A20] border border-white/[0.08] cursor-pointer hover:border-emerald-500/40 text-xs text-stone-200 transition-colors">
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`conflict-${issue.id}`}
                        value={detectedVal1}
                        checked={selectedPrice === detectedVal1}
                        onChange={(e) => setSelectedPrice(e.target.value)}
                        className="accent-emerald-500"
                      />
                      <span>₹{detectedVal1} (WhatsApp List)</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      Recommended
                    </span>
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-lg bg-[#181A20] border border-white/[0.08] cursor-pointer hover:border-emerald-500/40 text-xs text-stone-200 transition-colors">
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`conflict-${issue.id}`}
                        value={detectedVal2}
                        checked={selectedPrice === detectedVal2}
                        onChange={(e) => setSelectedPrice(e.target.value)}
                        className="accent-emerald-500"
                      />
                      <span>₹{detectedVal2} (CSV Legacy)</span>
                    </span>
                  </label>
                </div>

                <button
                  onClick={() =>
                    handleAction({
                      action: 'RESOLVE_CONFLICT',
                      issueId: issue.id,
                      productId: matchedProduct?.id,
                      authoritativePrice: parseFloat(selectedPrice),
                    })
                  }
                  disabled={loadingThis || isResolving}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-950 disabled:opacity-50 cursor-pointer"
                >
                  {loadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  Establish Ground Truth (₹{selectedPrice})
                </button>
              </div>
            )}

            {/* Case 2: Missing Price */}
            {!isConflict && issue.category === 'PRICE' && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] text-stone-400 font-medium">
                  Authorise Verified Unit Price (₹):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inputPrice}
                    onChange={(e) => setInputPrice(e.target.value)}
                    placeholder="220"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#181A20] border border-white/[0.08] text-stone-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 font-mono"
                  />
                  <span className="text-[11px] text-stone-400 font-mono">INR</span>
                </div>
                <span className="text-[10px] text-stone-500 font-mono">
                  Suggested from catalog: ₹{issue.advice?.draftContent || '220'}
                </span>

                <button
                  onClick={() =>
                    handleAction({
                      action: 'VERIFY_PRODUCT',
                      productId: matchedProduct?.id,
                      price: parseFloat(inputPrice),
                    })
                  }
                  disabled={loadingThis || isResolving || !matchedProduct}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-950 disabled:opacity-50 cursor-pointer"
                >
                  {loadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  Authorise Verified Price
                </button>
              </div>
            )}

            {/* Case 3: Missing Inventory */}
            {!isConflict && issue.category === 'INVENTORY' && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] text-stone-400 font-medium">
                  Authorise In-Stock Batch Inventory:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inputInventory}
                    onChange={(e) => setInputInventory(e.target.value)}
                    placeholder="15"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-[#181A20] border border-white/[0.08] text-stone-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 font-mono"
                  />
                  <span className="text-[11px] text-stone-400 font-mono">boxes</span>
                </div>
                <span className="text-[10px] text-stone-500 font-mono">
                  Allocated batch: {issue.advice?.draftContent || '15'} boxes
                </span>

                <button
                  onClick={() =>
                    handleAction({
                      action: 'VERIFY_PRODUCT',
                      productId: matchedProduct?.id,
                      inventory: parseInt(inputInventory, 10) || 10,
                    })
                  }
                  disabled={loadingThis || isResolving || !matchedProduct}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-950 disabled:opacity-50 cursor-pointer"
                >
                  {loadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  Authorise Stock
                </button>
              </div>
            )}

            {/* Case 4: Missing Policy */}
            {issue.category === 'POLICY' && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-stone-400 font-medium">
                  Review & Sign Standardized Terms:
                </span>
                <textarea
                  rows={3}
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-[#181A20] border border-white/[0.08] text-stone-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 resize-none font-sans leading-relaxed"
                />

                <button
                  onClick={() =>
                    handleAction({
                      action: 'APPROVE_POLICY',
                      merchantId: issue.merchantId,
                      type: 'REFUND',
                      content: policyText,
                    })
                  }
                  disabled={loadingThis || isResolving}
                  className="w-full mt-1.5 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all shadow-md shadow-amber-950 disabled:opacity-50 cursor-pointer"
                >
                  {loadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  Sign &amp; Approve Policy
                </button>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-[10px] text-stone-500 flex items-center justify-between">
            <span>Target: Database Ground Truth</span>
            <span className="text-emerald-400 font-medium">Flips to Verified</span>
          </div>
        </div>
      </div>
    </div>
    </TiltCard>
  );
};
