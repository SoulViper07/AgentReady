'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2,
  DollarSign,
  Package,
  FileText,
} from 'lucide-react';

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
  // Try to match product from description
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

  const handleAction = async (payload: Parameters<typeof onResolve>[0]) => {
    try {
      setLoadingThis(true);
      await onResolve(payload);
    } finally {
      setLoadingThis(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            HIGH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            MEDIUM
          </span>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toUpperCase()) {
      case 'PRICE':
      case 'CONSISTENCY':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'INVENTORY':
        return <Package className="w-4 h-4 text-cyan-400" />;
      case 'POLICY':
        return <FileText className="w-4 h-4 text-purple-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  if (issue.resolved) {
    return (
      <div className="p-4 rounded-xl bg-zinc-900/40 border border-emerald-500/20 text-zinc-400 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-500 font-mono">
              Resolved
            </span>
            <h4 className="text-sm font-medium text-zinc-200 line-through opacity-70">
              {issue.title}
            </h4>
          </div>
        </div>
        <span className="text-xs text-zinc-400 font-mono">Completed</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all p-5 shadow-lg shadow-black/40 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {getSeverityBadge(issue.severity)}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-zinc-800 text-zinc-300 border border-zinc-700/60">
            {getCategoryIcon(issue.category)}
            {issue.category}
          </span>
        </div>
        {matchedProduct && (
          <span className="text-xs font-mono text-zinc-400 truncate max-w-[200px]">
            Target: {matchedProduct.name}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          {issue.title}
        </h3>
        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
          {issue.description}
        </p>
      </div>

      {/* AI Explanation Callout */}
      {issue.advice?.explanation && (
        <div className="rounded-lg bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-500/20 p-3.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-medium uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            Why this matters for AI buyers
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {issue.advice.explanation}
          </p>
          {issue.advice.suggestedAction && (
            <p className="text-xs text-indigo-400/90 font-medium mt-1">
              Suggested: {issue.advice.suggestedAction}
            </p>
          )}
        </div>
      )}

      {/* Interactive Resolution Controls */}
      <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-3">
        {/* Case 1: Price Conflict */}
        {isConflict && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-400 font-medium">Select Truth:</span>
              <label className="flex items-center gap-1.5 text-xs text-zinc-200 cursor-pointer hover:text-white">
                <input
                  type="radio"
                  name={`conflict-${issue.id}`}
                  value={detectedVal1}
                  checked={selectedPrice === detectedVal1}
                  onChange={(e) => setSelectedPrice(e.target.value)}
                  className="accent-emerald-500"
                />
                ₹{detectedVal1} (WhatsApp)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-200 cursor-pointer hover:text-white">
                <input
                  type="radio"
                  name={`conflict-${issue.id}`}
                  value={detectedVal2}
                  checked={selectedPrice === detectedVal2}
                  onChange={(e) => setSelectedPrice(e.target.value)}
                  className="accent-emerald-500"
                />
                ₹{detectedVal2} (CSV)
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
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md shadow-emerald-950 disabled:opacity-50"
            >
              {loadingThis ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
              Authorise Price (₹{selectedPrice})
            </button>
          </div>
        )}

        {/* Case 2: Missing Price */}
        {!isConflict && issue.category === 'PRICE' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-zinc-400 font-medium shrink-0">
                Unit Price (₹):
              </span>
              <input
                type="number"
                value={inputPrice}
                onChange={(e) => setInputPrice(e.target.value)}
                placeholder="220"
                className="w-24 px-2.5 py-1 text-xs rounded bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-zinc-400">
                (Suggested: ₹{issue.advice?.draftContent || '220'})
              </span>
            </div>
            <button
              onClick={() =>
                handleAction({
                  action: 'VERIFY_PRODUCT',
                  productId: matchedProduct?.id,
                  price: parseFloat(inputPrice),
                })
              }
              disabled={loadingThis || isResolving || !matchedProduct}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all shadow-md shadow-emerald-950 disabled:opacity-50"
            >
              {loadingThis ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
              Confirm Price
            </button>
          </div>
        )}

        {/* Case 3: Missing / Unverified Inventory */}
        {!isConflict && issue.category === 'INVENTORY' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-zinc-400 font-medium shrink-0">
                Available Units:
              </span>
              <input
                type="number"
                value={inputInventory}
                onChange={(e) => setInputInventory(e.target.value)}
                placeholder="15"
                className="w-24 px-2.5 py-1 text-xs rounded bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-zinc-400">
                (Batch allocation: {issue.advice?.draftContent || '15'} boxes)
              </span>
            </div>
            <button
              onClick={() =>
                handleAction({
                  action: 'VERIFY_PRODUCT',
                  productId: matchedProduct?.id,
                  inventory: parseInt(inputInventory, 10),
                })
              }
              disabled={loadingThis || isResolving || !matchedProduct}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-all shadow-md shadow-cyan-950 disabled:opacity-50"
            >
              {loadingThis ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
              Confirm Inventory
            </button>
          </div>
        )}

        {/* Case 4: Missing or Unverified Policy */}
        {issue.category === 'POLICY' && (
          <div className="flex flex-col gap-2.5 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
            <span className="text-xs text-zinc-400 font-medium">
              Review & Accept Policy Terms:
            </span>
            <textarea
              rows={2}
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-purple-500 resize-none font-sans leading-relaxed"
            />
            <div className="flex justify-end">
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
                className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all shadow-md shadow-purple-950 disabled:opacity-50"
              >
                {loadingThis ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                Accept Policy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
