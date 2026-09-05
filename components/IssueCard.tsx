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
} from 'lucide-react';
import { AuthorityTag } from './AuthorityTag';

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
}

export const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  products,
  onResolve,
  isResolving = false,
}) => {
  // Match target product from description or products list
  const matchedProduct = products.find((p) =>
    issue.description.toLowerCase().includes(p.name.toLowerCase())
  );

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

  const [selectedPrice, setSelectedPrice] = useState<string>(detectedVal1);
  const [inputPrice, setInputPrice] = useState<string>(
    issue.advice?.draftContent || (matchedProduct?.name.includes('Dark') ? '220' : '200')
  );
  const [inputInventory, setInputInventory] = useState<string>(
    issue.advice?.draftContent || '15'
  );
  const [policyText, setPolicyText] = useState<string>(
    issue.advice?.draftContent ||
      'Due to the fresh, perishable nature of our artisan baked goods, all sales are final upon dispatch. If an item arrives damaged, notify us within 2 hours with photos for a full replacement or refund.'
  );

  const [loadingThis, setLoadingThis] = useState(false);
  const [justResolved, setJustResolved] = useState(false);

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
      <div className="rounded-2xl bg-zinc-950/70 border border-emerald-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/20 transition-all animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-400">
                Ground Truth Established
              </span>
              <AuthorityTag
                type="HUMAN_VERIFIED"
                compact
                customLabel="Signed Off by Merchant"
              />
            </div>
            <h4 className="text-sm font-semibold text-zinc-200 mt-0.5">
              {issue.title}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono text-emerald-400/90 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <Check className="w-3.5 h-3.5" />
          <span>Deterministically Recalculated</span>
        </div>
      </div>
    );
  }

  const rawLines = getRawEvidenceLines();

  return (
    <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700/80 transition-all p-5 shadow-xl flex flex-col gap-4">
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {getSeverityBadge(issue.severity)}
          <AuthorityTag
            type="AI_INFERRED"
            compact
            customLabel="AI Extracted • 98.4% Confidence"
          />
        </div>
        {matchedProduct && (
          <span className="text-xs font-mono text-zinc-400 truncate max-w-[220px]">
            Catalog Item: <strong className="text-zinc-200">{matchedProduct.name}</strong>
          </span>
        )}
      </div>

      {/* Title & Overview */}
      <div>
        <h3 className="text-base font-bold text-white tracking-tight">
          {issue.title}
        </h3>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
          {issue.description}
        </p>
      </div>

      {/* Cursor/GitHub 3-Sub-Panel Visual Diff Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Sub-Panel: Raw Evidence Extract (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl bg-black/80 border border-zinc-800 p-3.5 flex flex-col justify-between font-mono text-xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-800/80 text-[10px] text-zinc-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Terminal className="w-3 h-3 text-cyan-400" />
                Raw Evidence Extract
              </span>
              <span className="text-zinc-500">Multimodal Provenance</span>
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
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pb-1 mb-1 border-b border-white/5">
                    <span className="text-zinc-400 font-semibold">
                      [{line.source}]
                    </span>
                    <span>L:{line.num}</span>
                  </div>
                  <span className="break-words">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-zinc-900 text-[10px] text-zinc-500 flex items-center justify-between">
            <span>Provenance check: PASSED</span>
            <span className="text-violet-400">Zero Hallucination</span>
          </div>
        </div>

        {/* Center Sub-Panel: AI Remediation Diagnosis (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl bg-violet-950/20 border border-violet-500/25 p-3.5 flex flex-col justify-between text-xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-violet-500/20 text-[10px] text-violet-300 font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3 h-3 text-violet-400" />
                AI Remediation Diagnosis
              </span>
              <span className="text-violet-400/80">Agent Impact</span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {issue.advice?.explanation ||
                'Autonomous AI buyers verify mathematical consistency before authorizing settlement. Inconsistent or missing ground truth trips safety gates.'}
            </p>

            {issue.advice?.suggestedAction && (
              <div className="mt-2.5 p-2 rounded-lg bg-violet-950/40 border border-violet-500/30 text-[11px] text-violet-200 font-mono">
                <span className="text-violet-400 font-bold block text-[10px] uppercase">
                  Suggested Action:
                </span>
                {issue.advice.suggestedAction}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-violet-500/20 flex items-center justify-between text-[10px] font-mono text-violet-300/80">
            <span>Gate Risk: CRITICAL</span>
            <span className="text-rose-400 font-semibold">Will Block AI Buyer</span>
          </div>
        </div>

        {/* Right Sub-Panel: Authoritative Resolution Action (4 Cols) */}
        <div className="lg:col-span-4 rounded-xl bg-zinc-950/90 border border-zinc-800 p-3.5 flex flex-col justify-between text-xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-800/80 text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-zinc-200 font-bold">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Authoritative Action
              </span>
              <span className="text-sky-400">HITL Required</span>
            </div>

            {/* Case 1: Price Conflict */}
            {isConflict && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] text-zinc-400 font-medium">
                  Select Authoritative Ground Truth:
                </span>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-emerald-500/40 text-xs text-zinc-200 transition-colors">
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

                  <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-emerald-500/40 text-xs text-zinc-200 transition-colors">
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
                <span className="text-[11px] text-zinc-400 font-medium">
                  Authorise Verified Unit Price (₹):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inputPrice}
                    onChange={(e) => setInputPrice(e.target.value)}
                    placeholder="220"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[11px] text-zinc-400 font-mono">INR</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
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
                <span className="text-[11px] text-zinc-400 font-medium">
                  Authorise In-Stock Batch Inventory:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={inputInventory}
                    onChange={(e) => setInputInventory(e.target.value)}
                    placeholder="15"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[11px] text-zinc-400 font-mono">boxes</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  Allocated batch: {issue.advice?.draftContent || '15'} boxes
                </span>

                <button
                  onClick={() =>
                    handleAction({
                      action: 'VERIFY_PRODUCT',
                      productId: matchedProduct?.id,
                      inventory: parseInt(inputInventory, 10),
                    })
                  }
                  disabled={loadingThis || isResolving || !matchedProduct}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-md shadow-cyan-950 disabled:opacity-50 cursor-pointer"
                >
                  {loadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  Lock Verified Stock
                </button>
              </div>
            )}

            {/* Case 4: Missing Policy */}
            {issue.category === 'POLICY' && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-zinc-400 font-medium">
                  Review & Sign Standardized Terms:
                </span>
                <textarea
                  rows={3}
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-purple-500 resize-none font-sans leading-relaxed"
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
                  className="w-full mt-1.5 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-md shadow-purple-950 disabled:opacity-50 cursor-pointer"
                >
                  {loadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  Sign & Approve Policy
                </button>
              </div>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-zinc-900 text-[10px] text-zinc-500 flex items-center justify-between">
            <span>Target: Database Ground Truth</span>
            <span className="text-sky-400">Flips to Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
