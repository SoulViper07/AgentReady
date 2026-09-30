import Link from "next/link";
import { ShieldCheck, ExternalLink, Cpu, Terminal } from "lucide-react";

function Github({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="w-full mt-auto border-t border-white/[0.06] bg-[#0E0F12]/95 backdrop-blur-md text-stone-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          
          {/* Column 1: Platform Scope */}
          <div className="sm:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-stone-100 font-semibold text-sm tracking-tight">
              <span className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5"/>
              </span>
              AgentReady
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-stone-300">
                v1.0 Production
              </span>
            </div>
            
            <p className="text-stone-400 max-w-md leading-relaxed text-xs">
              Deterministic AI commerce middleware bridging informal micro-merchants to autonomous buyer agents. Zero-hallucination catalog extraction, atomic inventory locking, and cryptographic Razorpay payment verification.
            </p>

            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Built for Razorpay Buildathon 2026 · Track 01
            </div>
          </div>

          {/* Column 2: Platform Rails */}
          <div className="space-y-2.5">
            <h4 className="text-stone-200 font-medium text-xs uppercase tracking-wider font-mono">
              Platform Rails
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link className="hover:text-stone-200 transition-colors" href="/ingest">
                  Multimodal Ingest
                </Link>
              </li>
              <li>
                <Link className="hover:text-stone-200 transition-colors" href="/dashboard">
                  Readiness & HITL Gate
                </Link>
              </li>
              <li>
                <Link className="hover:text-stone-200 transition-colors" href="/agent-demo">
                  Autonomous Buyer Terminal
                </Link>
              </li>
              <li>
                <Link className="hover:text-stone-200 transition-colors" href="/dashboard#ledger">
                  Cryptographic Audit Ledger
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Protocols */}
          <div className="space-y-2.5">
            <h4 className="text-stone-200 font-medium text-xs uppercase tracking-wider font-mono">
              Protocols & Standards
            </h4>
            <ul className="space-y-1.5 text-stone-400">
              <li className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-stone-500 shrink-0"/>
                <span>NPCI Unified Agent Protocol</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-stone-500 shrink-0"/>
                <span>HMAC SHA-256 Settlement</span>
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-stone-500 shrink-0"/>
                <span>Deterministic Financial Gate</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <span>© 2026 AgentReady.</span>
            <span className="hidden sm:inline text-stone-600">•</span>
            <span>
              Engineered by{" "}
              <a 
                href="https://github.com/SoulViper07" 
                target="_blank" 
                rel="noreferrer" 
                className="text-stone-200 font-medium hover:text-emerald-400 transition-colors underline decoration-stone-600 underline-offset-4"
              >
                Areet Das (SoulViper07)
              </a>
            </span>
          </div>

          <a
            href="https://github.com/SoulViper07/AgentReady"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-stone-300 hover:text-white hover:border-white/20 transition-all active:scale-[0.97]"
          >
            <Github className="w-3.5 h-3.5"/>
            <span>Source Code</span>
            <ExternalLink className="w-3 h-3 text-stone-500"/>
          </a>
        </div>
      </div>
    </footer>
  );
}
