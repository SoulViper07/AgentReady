"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export interface SeedDemoButtonProps {
  onSuccess?: () => void | Promise<void>;
}

export default function SeedDemoButton({ onSuccess }: SeedDemoButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSeed = async () => {
    setLoading(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      window.dispatchEvent(new CustomEvent("agentready:status-update"));
      if (onSuccess) {
        await onSuccess();
      }
      router.refresh();
    } catch (error) {
      console.error("Failed to seed data", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleSeed}
      disabled={loading}
      className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer font-medium"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : null}
      {loading ? "Initializing Sandbox..." : "Load Sweet Crumbs Demo Data"}
    </button>
  );
}
