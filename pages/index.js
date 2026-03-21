import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  {
    icon: "document",
    title: "Voter List OCR",
    description: "Upload voter list PDFs and extract data with AI-powered OCR",
    path: "/upload",
    gradient: "from-blue-500 to-cyan-400",
  },
  {
    icon: "chart",
    title: "Election Results",
    description: "Process Form 20 election result sheets with booth-wise data",
    path: "/admin/election-results",
    gradient: "from-purple-500 to-pink-400",
  },
  {
    icon: "clipboard",
    title: "Affidavit Scanner",
    description: "OCR nomination papers & affidavits, export as Word documents",
    path: "/affidavits",
    gradient: "from-emerald-500 to-teal-400",
  },
  {
    icon: "bot",
    title: "AI Agent",
    description: "Query the voter database using natural language",
    path: "/agent",
    gradient: "from-orange-500 to-amber-400",
  },
  {
    icon: "search",
    title: "Smart Search",
    description: "Find voters by name, ID, assembly, religion, and more",
    path: "/search",
    gradient: "from-rose-500 to-red-400",
  },
  {
    icon: "analytics",
    title: "Analytics",
    description: "View demographics, religion stats, and age distributions",
    path: "/admin/stats",
    gradient: "from-indigo-500 to-violet-400",
  },
];

export default function Home() {
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (isAdmin) {
        router.push("/admin/dashboard");
      } else {
        router.push("/search");
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-ink-400/60 bg-gradient-to-br from-ink-100 to-ink-200 p-6 sm:p-10 lg:p-14 shadow-2xl">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-72 h-72 bg-neon-500/15 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, rgba(120,56,255,0.25), transparent 40%)," +
                "radial-gradient(circle at 80% 0%, rgba(60,220,255,0.18), transparent 40%)," +
                "radial-gradient(ellipse at 60% 80%, rgba(120,180,255,0.12), transparent 45%)",
            }}
          />
        </div>

        <div className="relative text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-neon-400/60 bg-neon-500/10 px-4 py-1.5 text-xs font-semibold text-neon-100 shadow-card mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              AI-Powered Election Data Platform
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-semibold text-slate-50 mb-6 tracking-tight leading-tight">
              Voter Database
              <br />
              <span className="bg-gradient-to-r from-neon-300 via-blue-300 to-indigo-300 text-transparent bg-clip-text">
                Management System
              </span>
            </h1>

            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
              Upload voter lists, election results, and affidavits. Our AI
              extracts, organizes, and makes your data searchable in seconds.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <Link
                href="/register"
                className="btn btn-primary text-base px-8 py-3"
              >
                Get Started Free
              </Link>
              <Link
                href="/login"
                className="btn btn-secondary text-base px-8 py-3"
              >
                Sign In
              </Link>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                {
                  label: "Live search",
                  tone: "emerald",
                  dot: true,
                },
                { label: "Affidavit OCR", tone: "neon" },
                { label: "Print slips", tone: "blue" },
                { label: "CSV export", tone: "amber" },
              ].map((pill) => (
                <div
                  key={pill.label}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium
                    ${
                      pill.tone === "emerald"
                        ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                        : pill.tone === "neon"
                          ? "border-neon-400/50 bg-neon-500/10 text-neon-200"
                          : pill.tone === "blue"
                            ? "border-blue-400/50 bg-blue-500/10 text-blue-200"
                            : "border-amber-400/50 bg-amber-500/10 text-amber-200"
                    }`}
                >
                  {pill.dot && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {pill.label}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="glass-panel p-6 border border-ink-400/60 shadow-2xl">
        <div className="flex items-center justify-between mb-4 text-sm text-slate-200">
          <span className="font-semibold text-lg">How it works</span>
          <span className="text-neon-200 text-xs">3 simple steps</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              text: "Upload voter list PDF or affidavit",
              dot: "bg-neon-300",
            },
            {
              step: "2",
              text: "AI extracts & organizes all data",
              dot: "bg-blue-300",
            },
            {
              step: "3",
              text: "Search, analyze & export results",
              dot: "bg-emerald-300",
            },
          ].map((item) => (
            <div key={item.step} className="step-pill">
              <span className={`step-dot ${item.dot}`} />
              <span className="text-sm">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Cards */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-slate-50 text-center mb-8">
          Everything You Need
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="group card hover:border-ink-300 hover:scale-[1.02] transition-all duration-300 h-full">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <HomeIcon type={feature.icon} />
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section className="card bg-gradient-to-r from-purple-500/10 to-neon-500/10 border-purple-400/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-1">
              Need help or have questions?
            </h3>
            <p className="text-sm text-slate-400">
              We&apos;re here to help with any website functionality related
              queries
            </p>
          </div>
          <a
            href="mailto:acodernamedsubhro@gmail.com"
            className="btn btn-secondary whitespace-nowrap"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Contact Us
          </a>
        </div>
      </section>

      {/* Footer credit */}
      <div className="text-center pb-4">
        <p className="text-sm text-slate-500">
          Created by{" "}
          <a
            href="https://ssaha.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-300/60 hover:text-neon-200 transition-colors font-normal"
          >
            Shaswata Saha
          </a>{" "}
          | &copy; {new Date().getFullYear()} All Rights Reserved
        </p>
      </div>
    </div>
  );
}

function HomeIcon({ type }) {
  const icons = {
    document: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 12h6m-6 4h6M8 4h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z"
      />
    ),
    chart: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 3v18h18M7 14l4-4 3 3 5-7"
      />
    ),
    clipboard: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 5h6M9 9h6m-6 4h6m-7 7h8a2 2 0 002-2V6a2 2 0 00-2-2h-1.5a2.5 2.5 0 00-5 0H8a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    ),
    bot: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 7V6a3 3 0 016 0v1m-7 4h8m-8 4h8M5 11h14v6a3 3 0 01-3 3H8a3 3 0 01-3-3v-6z"
      />
    ),
    search: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M21 21l-4.35-4.35m1.85-4.65a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    ),
    analytics: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M7 12v6m5-10v10m5-14v14M3 21h18"
      />
    ),
  };

  return (
    <svg
      className="h-6 w-6 text-white"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {icons[type] || icons.chart}
    </svg>
  );
}
