"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export interface ResetSandboxButtonProps {
  onSuccess?: () => void | Promise<void>;
}

export default function ResetSandboxButton({ onSuccess }: ResetSandboxButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    setLoading(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("agentready:reset"));
        window.dispatchEvent(new CustomEvent("agentready:status-update"));
      }
      if (onSuccess) {
        await onSuccess();
      }
      router.refresh();
    } catch (error) {
      console.error("Failed to reset sandbox", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleReset}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white/[0.04] text-stone-400 border border-white/[0.08] rounded-lg hover:bg-white/[0.08] hover:text-stone-200 transition-all disabled:opacity-50 active:scale-95 touch-manipulation cursor-pointer"
    >
      <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Resetting..." : "Reset Sandbox"}
    </button>
  );
}
