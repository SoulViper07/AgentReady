import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentReady | Deterministic AI Commerce Rails",
  description: "Deterministic AI commerce readiness and payment gateway for autonomous buyer agents.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark overflow-x-hidden ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh w-full overflow-x-hidden flex flex-col bg-[#0E0F12] text-stone-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
        <Navbar/>
        <main className="flex-1 w-full max-w-full overflow-x-hidden">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
        <Footer/>
      </body>
    </html>
  );
}
