'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  RefreshCw,
  Search,
  Filter,
  Code,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Database,
  Tag,
  CreditCard,
  FileCheck,
} from 'lucide-react';

export interface AuditItem {
  id: string;
  merchantId: string;
  eventType: string;
  details: string;
  createdAt: string | Date;
}

export interface AuditFeedProps {
  initialLogs?: AuditItem[];
  merchantSlug?: string;
  title?: string;
  showFilters?: boolean;
}

export const AuditFeed: React.FC<AuditFeedProps> = ({
  initialLogs = [],
  merchantSlug = 'sweet-crumbs',
  title = 'Immutable System Audit Ledger',
  showFilters = true,
}) => {
  const [logs, setLogs] = useState<AuditItem[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?merchantSlug=${merchantSlug}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [merchantSlug]);

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      if (initialLogs.length > 0) return;
      try {
        const res = await fetch(
          `/api/audit?merchantSlug=${merchantSlug}&limit=100`
        );
        if (res.ok && !ignore) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      }
    }
    void loadInitial();
    return () => {
      ignore = true;
    };
  }, [initialLogs.length, merchantSlug]);

  const toggleExpand = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatTime = (time: string | Date): string => {
    const d = new Date(time);
    if (isNaN(d.getTime())) return '00:00:00';
    return d.toTimeString().split(' ')[0]; // HH:mm:ss
  };

  const formatDate = (time: string | Date): string => {
    const d = new Date(time);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const getBadgeStyle = (eventType: string) => {
    switch (eventType) {
      case 'DATA_INGESTION_COMPLETED':
        return {
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          icon: <Database className="w-3.5 h-3.5" />,
          label: 'Data Ingestion',
        };
      case 'MERCHANT_VERIFIED_PRICE':
      case 'MERCHANT_VERIFIED_INVENTORY':
      case 'MERCHANT_RESOLVED_CONFLICT':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          icon: <Tag className="w-3.5 h-3.5" />,
          label: 'Catalog Verified',
        };
      case 'POLICY_APPROVED':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <FileCheck className="w-3.5 h-3.5" />,
          label: 'Policy Approved',
        };
      case 'TRANSACTION_PROPOSAL_CREATED':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          icon: <Tag className="w-3.5 h-3.5" />,
          label: 'Proposal Created',
        };
      case 'TRANSACTION_RESERVED':
        return {
          bg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
          icon: <Lock className="w-3.5 h-3.5" />,
          label: 'Inventory Held',
        };
      case 'RAZORPAY_ORDER_CREATED':
        return {
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          icon: <CreditCard className="w-3.5 h-3.5" />,
          label: 'Razorpay Order',
        };
      case 'PAYMENT_VERIFIED':
      case 'INVENTORY_DEDUCTED':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: eventType === 'PAYMENT_VERIFIED' ? 'Payment Verified' : 'Inventory Deducted',
        };
      case 'TRANSACTION_BLOCKED':
      case 'PAYMENT_SIGNATURE_MISMATCH':
        return {
          bg: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
          icon: <ShieldAlert className="w-3.5 h-3.5" />,
          label: eventType === 'TRANSACTION_BLOCKED' ? 'Gate Blocked' : 'Signature Mismatch',
        };
      default:
        return {
          bg: 'bg-[#121316] text-stone-300 border border-white/[0.08]',
          icon: <History className="w-3.5 h-3.5" />,
          label: eventType,
        };
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      const matchesType =
        selectedEventType === 'ALL' || item.eventType === selectedEventType;
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        search === '' ||
        item.eventType.toLowerCase().includes(search) ||
        item.details.toLowerCase().includes(search) ||
        item.id.toLowerCase().includes(search);
      return matchesType && matchesSearch;
    });
  }, [logs, selectedEventType, searchTerm]);

  const uniqueEventTypes = useMemo(() => {
    const types = new Set(logs.map((l) => l.eventType));
    return ['ALL', ...Array.from(types)];
  }, [logs]);

  const renderPayload = (details: string, id: string) => {
    let parsed: unknown = null;
    let isJson = false;

    if (details.startsWith('{') || details.startsWith('[')) {
      try {
        parsed = JSON.parse(details);
        isJson = true;
      } catch {
        isJson = false;
      }
    }

    const isExpanded = expandedDetails[id];

    if (isJson && parsed && typeof parsed === 'object') {
      return (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleExpand(id)}
              className="text-[10px] font-mono text-amber-400/90 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Code className="w-3 h-3" />
              {isExpanded ? 'Collapse JSON Payload' : 'Expand JSON Payload'}
            </button>
          </div>
          {isExpanded ? (
            <pre className="p-2.5 rounded-xl bg-[#121316] border border-white/[0.08] text-stone-300 text-[10px] font-mono overflow-x-auto max-h-48 leading-relaxed">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          ) : (
            <span className="text-xs font-mono text-stone-400 truncate block max-w-full">
              {details.slice(0, 120)}...
            </span>
          )}
        </div>
      );
    }

    const isBlocked = details.includes('INSUFFICIENT_INVENTORY') || details.includes('BLOCKED');

    return (
      <div className="mt-1">
        <p
          className={`text-xs font-mono break-words leading-relaxed ${
            isBlocked ? 'text-rose-300 font-semibold' : 'text-stone-300'
          }`}
        >
          {details}
        </p>
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-[#181A20]/90 backdrop-blur-md border border-white/[0.08] p-6 flex flex-col gap-5 shadow-xl shadow-black/20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/10 to-stone-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#F8F9FA] flex items-center gap-2">
              {title}
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#121316] text-stone-300 border border-white/[0.08]">
                {logs.length} Events
              </span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Append-only chronological audit ledger recorded in SQLite Prisma database.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-[#121316] hover:bg-[#1E2028] border border-white/[0.08] text-stone-200 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail by event type, keywords, or proposal ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#121316] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="bg-[#121316] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500/50 cursor-pointer font-mono transition-colors"
            >
              {uniqueEventTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'ALL' ? 'All Event Types' : type}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Timeline Feed Container */}
      <div className="flex flex-col divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto pr-1">
        {filteredLogs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-stone-500">
            <History className="w-8 h-8 stroke-1 text-stone-600" />
            <span className="text-xs font-mono">No audit events match your filter.</span>
          </div>
        ) : (
          filteredLogs.map((item) => {
            const badge = getBadgeStyle(item.eventType);
            return (
              <div
                key={item.id}
                className="py-3.5 px-2.5 hover:bg-[#121316]/60 rounded-xl transition-colors flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Event Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border flex items-center gap-1.5 ${badge.bg}`}
                    >
                      {badge.icon}
                      {item.eventType}
                    </span>

                    {/* Event ID */}
                    <span className="text-[10px] font-mono text-stone-500">
                      ID: {item.id.slice(-8)}
                    </span>
                  </div>

                  {/* Formatted Timestamp */}
                  <div className="flex items-center gap-2 text-stone-400 text-xs font-mono shrink-0">
                    <span className="text-stone-500">{formatDate(item.createdAt)}</span>
                    <span className="text-[#F8F9FA] font-semibold">{formatTime(item.createdAt)}</span>
                  </div>
                </div>

                {/* Event Payload Description */}
                {renderPayload(item.details, item.id)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AuditFeed;
