'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  Sparkles,
  ArrowRight,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Tag,
  Package,
  FileCheck2,
  Store,
  Layers,
  X,
  RefreshCw,
  Eye,
  ExternalLink,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { AuthorityTag } from '../../components/AuthorityTag';
import { TiltCard } from '../../components/ui/TiltCard';
import { IngestProgressBar } from '../../components/IngestProgressBar';
import { motion } from 'framer-motion';

interface ExtractedProduct {
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  inventory: number | null;
  isEggless: boolean | null;
  sourceEvidence: string | null;
}

interface ExtractedPolicy {
  type: string;
  content: string | null;
  sourceEvidence: string | null;
}

interface ConsistencyFlag {
  field: string;
  detectedValues: string[];
  explanation: string;
}

interface ExtractionResult {
  products: ExtractedProduct[];
  policies: ExtractedPolicy[];
  consistencyFlags: ConsistencyFlag[];
  providerUsed?: 'gemini' | 'groq' | 'deterministic' | 'openai';
}

const PRESETS = [
  {
    id: 'sweet-crumbs',
    title: 'Sweet Crumbs Weekend Drop',
    subtitle: 'WhatsApp broadcast with conflicting prices & unstated stock',
    category: 'Artisan Cookies',
    rawText: `Sweet Crumbs Artisan Bakes - Weekend Fresh Drop! 🍪✨

1. Signature Choco Chip Cookies (100% Eggless) - Price: Rs. 250. Only 10 boxes available!
2. Double Dark Sea Salt Cookies (Eggless) - Rich 70% dark Belgian cocoa with Cornish sea salt flakes.
3. Oats & Cranberry Breakfast Cookies (Contains Egg) - Fresh daily bake with organic rolled oats. DM for box pricing!

Pickup available at our Indiranagar kitchen or delivery across Bengaluru via Dunzo.
Due to fresh perishable nature, no returns or refunds once dispatched. Notify within 2 hours for damaged transit.`,
    csvText: `Product Name,Category,Price,Inventory,Eggless
Signature Choco Chip Cookies,Cookies,200,15,true
Double Dark Sea Salt Cookies,Cookies,220,10,true
Oats & Cranberry Breakfast Cookies,Cookies,180,8,false`,
  },
  {
    id: 'cafe-beverage',
    title: 'Cafe Beverage & Bread Card',
    subtitle: 'Physical menu card with seasonal beverage pricing & batch loaves',
    category: 'Cafe & Bakery',
    rawText: `ROAST & RYE CAFE & BAKEHOUSE
Menu Card - Batch 14

1. Cold Brew Tonic (100% Eggless) - Price: Rs. 240. Single origin Coorg beans, citrus tonic.
2. Artisanal Country Sourdough Loaf (Eggless) - Naturally fermented 36h loaf. Price: Rs. 180. 12 loaves fresh from the deck oven.
3. Classic Almond Croissant (Contains Egg) - Laminated French butter pastry. Price: Rs. 210. Limited batch!
4. Ceremonial Matcha Iced Latte (Eggless) - Uji Kyoto ceremonial grade. DM for oat milk pricing.

Same-day dispatch for orders before 2 PM. Delivery across city. Perishable items cannot be returned after dispatch.`,
    csvText: `Product Name,Category,Price,Inventory,Eggless
Cold Brew Tonic,Beverages,240,20,true
Artisanal Country Sourdough Loaf,Bread,180,12,true
Classic Almond Croissant,Pastry,210,6,false`,
  },
  {
    id: 'artisan-patisserie',
    title: 'Gourmet Patisserie Collection',
    subtitle: 'Instagram drop announcement with dietary badges & refund disclaimer',
    category: 'Gourmet Patisserie',
    rawText: `THE BUTTER ROOM - EXCLUSIVE FRIDAY BAKE DROP

1. Pistachio Raspberry Cruffin (Contains Egg) - Flaky cruffin filled with pistachio ganache. Price: Rs. 280.
2. Hazelnut Praline Babka (Eggless) - Braided brioche swirl. Price: Rs. 350. Only 8 babkas baked today!
3. Vegan Olive & Rosemary Focaccia (100% Eggless) - Cold-pressed EVOO focaccia. DM for catering slab pricing.

Deliveries start at 4 PM. All orders final once baked. Photo required within 2 hours for damaged deliveries.`,
    csvText: `Product Name,Category,Price,Inventory,Eggless
Pistachio Raspberry Cruffin,Pastry,280,10,false
Hazelnut Praline Babka,Breads,320,8,true`,
  },
];

export default function IngestionStudioPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'presets'>('image');

  // Input States
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [rawText, setRawText] = useState<string>(PRESETS[0].rawText);
  const [csvText, setCsvText] = useState<string>(PRESETS[0].csvText);
  const [showCsvInput, setShowCsvInput] = useState(true);

  // Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  // Multi-Stage Ingestion Progress State
  const [inProgress, setInProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [stageText, setStageText] = useState('Encoding and preparing multimodal payload...');
  const [providerUsed, setProviderUsed] = useState<'gemini' | 'groq' | 'deterministic' | 'openai' | null>('gemini');
  const [isFallbackTriggered, setIsFallbackTriggered] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startProgress = (isCommitMode: boolean) => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    setInProgress(true);
    setIsComplete(false);
    setProgressValue(5);
    setElapsedSeconds(0);
    setIsFallbackTriggered(false);
    setProviderUsed('gemini');
    setStageText('Encoding and preparing multimodal payload...');

    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedSeconds(elapsed);

      setProgressValue((prev) => {
        if (prev < 25) {
          setStageText('Encoding and preparing multimodal payload...');
          return Math.min(25, prev + 3);
        } else if (prev < 65) {
          if (elapsed > 12.0) {
            setIsFallbackTriggered(true);
            setProviderUsed('groq');
            setStageText('Gemini 12s OCR latency threshold reached. Engaging Groq Vision failover...');
          } else {
            setStageText('Extracting catalog via Gemini 3.6 Flash (Vision OCR)...');
          }
          return Math.min(65, prev + 1.2);
        } else if (prev < 85) {
          setStageText('Enforcing strict null invariants & source provenance...');
          return Math.min(85, prev + 1.5);
        } else if (prev < 95) {
          setStageText(
            isCommitMode
              ? 'Writing verified schema to SQLite & evaluating readiness...'
              : 'Assembling structured catalog schema & discrepancy analysis...'
          );
          return Math.min(95, prev + 0.8);
        }
        return prev;
      });
    }, 120);
  };

  const stopProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // Handle Image Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFileName(file.name);
    setImageMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImage(result);
      // Auto switch to image tab
      setActiveTab('image');
    };
    reader.readAsDataURL(file);
  };

  // Generate Sample Canvas Menu Card
  const handleLoadSampleImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 600, 420);

    // Decorative Header
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 600, 70);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('SWEET CRUMBS ARTISAN BAKERY', 30, 44);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('DAILY FRESH BATCH MENU - INDIRANAGAR', 30, 100);

    // Item 1
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('1. Signature Choco Chip Cookies (100% Eggless)', 30, 140);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Price: Rs. 250 / box', 30, 162);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Stock: Only 10 boxes available today', 30, 182);

    // Item 2
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('2. Double Dark Sea Salt Cookies (Eggless)', 30, 225);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Price: Seasonal / DM for Box Rate', 30, 247);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('70% Belgian Dark Cocoa & Cornish Sea Salt Flakes', 30, 267);

    // Item 3
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('3. Oats & Cranberry Breakfast Cookies (Contains Egg)', 30, 310);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Price: On request', 30, 332);

    // Footer Policy
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 12px system-ui, sans-serif';
    ctx.fillText('Freshly baked daily. All sales final upon delivery. Transit damages reported within 2h.', 30, 385);

    const dataUrl = canvas.toDataURL('image/png');
    setSelectedImage(dataUrl);
    setImageFileName('Sweet_Crumbs_Menu_Card.png');
    setImageMimeType('image/png');
  };

  // Run Real-Time Extraction Preview
  const handleExtractPreview = async () => {
    setIsExtracting(true);
    setExtractionError(null);
    setCommitSuccess(false);
    startProgress(false);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantSlug: 'sweet-crumbs',
          rawText: activeTab === 'image' ? '' : rawText,
          csvText: showCsvInput ? csvText : undefined,
          imageBase64: activeTab === 'image' ? selectedImage : undefined,
          imageMimeType: activeTab === 'image' ? imageMimeType : undefined,
          preview: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract catalog data');
      }

      const extracted: ExtractionResult = data.extraction;
      setExtractionResult(extracted);
      setProgressValue(100);
      setIsComplete(true);
      const used = extracted.providerUsed || 'gemini';
      setProviderUsed(used);
      setIsFallbackTriggered(used === 'groq');
      setStageText(`Extraction complete! ${extracted.products.length} items loaded into verification queue.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Extraction error';
      setExtractionError(msg);
      setInProgress(false);
    } finally {
      stopProgress();
      setIsExtracting(false);
    }
  };

  // Push Directly to Database & Verification Queue
  const handleCommitToCatalog = async () => {
    setIsCommitting(true);
    setExtractionError(null);
    startProgress(true);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantSlug: 'sweet-crumbs',
          rawText: activeTab === 'image' ? '' : rawText,
          csvText: showCsvInput ? csvText : undefined,
          imageBase64: activeTab === 'image' ? selectedImage : undefined,
          imageMimeType: activeTab === 'image' ? imageMimeType : undefined,
          preview: false,
          replaceExisting: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to push catalog to database');
      }

      if (data.extraction) {
        setExtractionResult(data.extraction);
      }
      setProgressValue(100);
      setIsComplete(true);
      const used = data.extraction?.providerUsed || 'gemini';
      setProviderUsed(used);
      setIsFallbackTriggered(used === 'groq');
      const count = data.products?.length || data.extraction?.products?.length || 0;
      setStageText(`Extraction complete! ${count} items loaded into verification queue.`);

      setCommitSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ingestion commit error';
      setExtractionError(msg);
      setInProgress(false);
    } finally {
      stopProgress();
      setIsCommitting(false);
    }
  };

  const handleSelectPreset = (preset: (typeof PRESETS)[0]) => {
    setRawText(preset.rawText);
    setCsvText(preset.csvText);
    setActiveTab('text');
  };

  return (
    <div className="min-h-screen bg-[#0E0F12] text-stone-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 flex flex-col">
      <Navbar subtitle="Multimodal Ingestion Studio & Vision OCR" />

      {/* Hero Strip */}
      <div className="border-b border-white/[0.06] bg-gradient-to-b from-[#181A20] via-[#141519] to-[#0E0F12] px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                Multimodal OCR + Vision
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Gemini 3.6-Flash
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-stone-500/10 text-stone-300 border border-stone-500/30 uppercase tracking-wider">
                Zero Hallucination
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F8F9FA] mt-2">
              Merchant Ingestion Studio
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-2xl leading-relaxed">
              Upload physical menu cards, paste messy WhatsApp broadcasts, or cross-reference legacy CSV sheets.
              Gemini extracts strict catalog invariants before pushing them into the Merchant Verification Queue.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/dashboard"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#181A20] border border-white/[0.08] hover:border-stone-700 text-xs font-semibold text-stone-300 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Store className="w-3.5 h-3.5 text-amber-300" />
              <span>Merchant Console</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ======================================================== */}
          {/* LEFT COLUMN: SOURCE INPUT METHODS (Tabs & Controls) (5 Cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Input Method Switcher */}
            <div className="rounded-2xl bg-[#181A20] border border-white/[0.08] p-1.5 shadow-xl shadow-black/20 grid grid-cols-3 gap-1 relative">
              {[
                { id: 'image', label: 'Image OCR', icon: ImageIcon },
                { id: 'text', label: 'Raw Text', icon: FileText },
                { id: 'presets', label: 'Presets', icon: Sparkles },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as 'image' | 'text' | 'presets')}
                    className={`relative py-2 px-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] tactile-btn ${
                      isActive
                        ? 'text-white'
                        : 'text-stone-400 hover:text-[#F8F9FA]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeIngestTab"
                        className="absolute inset-0 bg-emerald-600 rounded-xl shadow-md shadow-emerald-950/40 -z-0"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <TabIcon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: Image Dropzone (Vision OCR) */}
            {activeTab === 'image' && (
              <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F8F9FA]">
                      Physical Menu Card / Photo Dropzone
                    </h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Upload packaging, whiteboard specials, or printed menus
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#121316] border border-white/[0.08] text-amber-300">
                    Vision Ready
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                {selectedImage ? (
                  <div className="relative rounded-xl border border-white/[0.1] bg-[#121316] p-2 overflow-hidden flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedImage}
                      alt="Uploaded Menu"
                      className="max-h-64 w-full object-contain rounded-lg"
                    />
                    <div className="w-full flex items-center justify-between pt-2 px-1 text-xs text-stone-400">
                      <span className="truncate max-w-[200px] font-mono">
                        {imageFileName || 'Uploaded Image'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-700 hover:border-amber-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-[#121316]/60 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#181A20] border border-white/[0.08] flex items-center justify-center text-stone-400 group-hover:text-amber-300 group-hover:border-amber-500/30 transition-all">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#F8F9FA]">
                        Click to browse or drop menu image here
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Supports JPEG, PNG, WebP (Max 5MB)
                      </p>
                    </div>
                  </div>
                )}

                {/* Sample Image Quick Button */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-xs text-stone-400">Don&apos;t have a photo?</span>
                  <button
                    type="button"
                    onClick={handleLoadSampleImage}
                    className="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Sample Menu Card</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Raw Text / Broadcast Paste */}
            {activeTab === 'text' && (
              <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F8F9FA]">
                      Raw WhatsApp / Broadcast Text
                    </h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Paste informal captions, price updates, or drop messages
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#121316] border border-white/[0.08] text-stone-300">
                    Text Parser
                  </span>
                </div>

                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste WhatsApp drop announcement..."
                  className="w-full p-3 rounded-xl bg-[#121316] border border-white/[0.08] text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors leading-relaxed"
                />

                {/* Legacy CSV Cross-Reference Toggle */}
                <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCsvInput}
                        onChange={(e) => setShowCsvInput(e.target.checked)}
                        className="rounded border-stone-700 text-amber-500 focus:ring-0"
                      />
                      <span>Cross-Reference Legacy Catalog CSV</span>
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">
                      (Detects Price Discrepancies)
                    </span>
                  </div>

                  {showCsvInput && (
                    <textarea
                      rows={4}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder="Product Name,Category,Price,Inventory,Eggless"
                      className="w-full p-2.5 rounded-xl bg-[#121316] border border-white/[0.08] text-stone-300 text-[11px] font-mono focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: One-Click Presets */}
            {activeTab === 'presets' && (
              <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F8F9FA]">
                      Real-World Commerce Presets
                    </h3>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Select a scenario to test adversarial invariant extraction
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="p-3.5 rounded-xl bg-[#121316] hover:bg-[#181A20] border border-white/[0.06] hover:border-amber-500/30 text-left transition-all flex items-start justify-between gap-3 cursor-pointer group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#F8F9FA] group-hover:text-amber-300 transition-colors">
                            {preset.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#181A20] text-stone-400 font-mono border border-white/[0.06]">
                            {preset.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                          {preset.subtitle}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-300 shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ingestion Action Bar or Active Multi-Stage Progress Terminal */}
            {inProgress ? (
              <div className="flex flex-col gap-3">
                <IngestProgressBar
                  progress={progressValue}
                  stageText={stageText}
                  providerUsed={providerUsed}
                  isFallbackTriggered={isFallbackTriggered}
                  elapsedSeconds={elapsedSeconds}
                  itemsCount={extractionResult?.products.length}
                  isComplete={isComplete}
                  onContinue={() => {
                    if (commitSuccess) {
                      router.push('/dashboard');
                    } else {
                      handleCommitToCatalog();
                    }
                  }}
                  continueLabel={
                    commitSuccess
                      ? 'Redirecting to Remediation...'
                      : 'Push to Store Verification Queue →'
                  }
                />
                {isComplete && !commitSuccess && (
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setInProgress(false);
                        setIsComplete(false);
                      }}
                      className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer py-1"
                    >
                      Reset / Re-run Ingestion
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExtractPreview}
                  disabled={isExtracting || isCommitting}
                  className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#181A20] hover:bg-[#20232B] disabled:opacity-50 text-[#F8F9FA] font-semibold text-xs flex items-center justify-center gap-2 border border-white/[0.1] shadow-lg shadow-black/20 transition-all cursor-pointer active:scale-[0.97] tactile-btn"
                >
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Run Extraction Preview</span>
                </button>

                <button
                  type="button"
                  onClick={handleCommitToCatalog}
                  disabled={isExtracting || isCommitting}
                  className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer active:scale-[0.97] tactile-btn"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Push Directly to Store</span>
                </button>
              </div>
            )}

            {/* Error Message if any */}
            {extractionError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{extractionError}</span>
              </div>
            )}

            {/* Commit Success Toast */}
            {commitSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Inventory ingested! Redirecting to Merchant Verification Console...</span>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: REAL-TIME EXTRACTION PREVIEW (7 Cols)      */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="rounded-2xl bg-[#181A20]/90 border border-white/[0.08] p-5 sm:p-6 shadow-xl shadow-black/20 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-[#F8F9FA]">
                    Live Transformation Visualizer
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {extractionResult?.providerUsed && (
                    <span
                      className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold flex items-center gap-1 ${
                        extractionResult.providerUsed === 'groq'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : extractionResult.providerUsed === 'gemini'
                          ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
                          : 'bg-[#181A20] text-stone-300 border-white/[0.08]'
                      }`}
                    >
                      {extractionResult.providerUsed === 'groq' ? (
                        <>
                          <Zap className="w-3 h-3 text-amber-400" />
                          ⚡ Groq Llama 3.2 Vision (High-Speed Fallback)
                        </>
                      ) : extractionResult.providerUsed === 'gemini' ? (
                        <>
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          ⚡ Powered by Gemini 3.6 Flash
                        </>
                      ) : (
                        '🛡️ Deterministic Engine'
                      )}
                    </span>
                  )}
                  {extractionResult && (
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
                      {extractionResult.products.length} Products Extracted
                    </span>
                  )}
                </div>
              </div>

              {/* Extraction State: Empty / Loading / Display */}
              {!extractionResult && !isExtracting && (
                <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#121316] border border-white/[0.08] flex items-center justify-center text-stone-500">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-300">
                      Awaiting Unstructured Input
                    </h4>
                    <p className="text-xs text-stone-500 max-w-sm mt-1">
                      Select an image, paste broadcast text, or click a preset on the left, then click &ldquo;Run Extraction Preview&rdquo; to visualize the structured catalog invariants.
                    </p>
                  </div>
                </div>
              )}

              {(isExtracting || inProgress) && !extractionResult && (
                <div className="py-16 px-4 flex flex-col items-center justify-center text-center gap-4">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                  <div>
                    <h4 className="text-sm font-semibold text-[#F8F9FA]">
                      Multimodal Extraction in Progress...
                    </h4>
                    <p className="text-xs text-stone-400 mt-1 max-w-md font-mono">
                      {stageText}
                    </p>
                  </div>
                </div>
              )}

              {extractionResult && (!isExtracting || isComplete) && (
                <div className="flex flex-col gap-5 animate-in fade-in">
                  {/* Detected Consistency Flags Banner */}
                  {extractionResult.consistencyFlags.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-semibold text-amber-300">
                          {extractionResult.consistencyFlags.length} Catalog Discrepancy Flag(s) Detected
                        </span>
                      </div>
                      {extractionResult.consistencyFlags.map((flag, idx) => (
                        <p key={idx} className="text-xs text-amber-200/80 leading-relaxed pl-6">
                          <strong>{flag.field}:</strong> {flag.explanation}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Extracted Products List */}
                  <div>
                    <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider font-mono mb-2.5">
                      Extracted Products
                    </h4>
                    <div className="flex flex-col gap-2.5">
                      {extractionResult.products.map((p, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[#121316] border border-white/[0.06] hover:border-stone-700/80 transition-all flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-[#F8F9FA]">
                                {p.name}
                              </span>
                              {p.isEggless && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                  Eggless
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {p.price !== null ? (
                                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                                  ₹{p.price}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/30">
                                  Price: Null (Unstated)
                                </span>
                              )}

                              {p.inventory !== null ? (
                                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                                  {p.inventory} boxes
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">
                                  Stock: Null (Unstated)
                                </span>
                              )}
                            </div>
                          </div>

                          {p.sourceEvidence && (
                            <div className="text-[11px] text-stone-400 italic bg-[#181A20]/80 p-2 rounded-lg border border-white/[0.06]">
                              &ldquo;{p.sourceEvidence}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extracted Policies */}
                  {extractionResult.policies.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider font-mono mb-2.5">
                        Extracted Policies
                      </h4>
                      <div className="flex flex-col gap-2">
                        {extractionResult.policies.map((pol, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#121316] border border-white/[0.06] flex items-start justify-between gap-3 text-xs"
                          >
                            <div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 font-bold mr-2 uppercase">
                                {pol.type}
                              </span>
                              <span className="text-stone-300">
                                {pol.content}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commit Action Footer */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 via-[#181A20] to-[#181A20] border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
                    <div>
                      <h4 className="text-xs font-bold text-[#F8F9FA]">
                        Ready to establish ground truth?
                      </h4>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Commit these items to the merchant catalog and open the verification queue.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCommitToCatalog}
                      disabled={isCommitting}
                      className="min-h-[40px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40 transition-all cursor-pointer shrink-0"
                    >
                      {isCommitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      <span>Commit to Verification Queue</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
