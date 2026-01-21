import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import UploadForm from "../components/UploadForm";

export default function Home() {
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to their appropriate page
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (isAdmin) {
        router.push("/admin/dashboard");
      } else {
        router.push("/search");
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  // Show loading while checking auth or redirecting
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
    <div className="space-y-8 sm:space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-ink-400/60 bg-gradient-to-br from-ink-100 to-ink-200 p-5 sm:p-8 lg:p-10 shadow-2xl">
        <div
          className="absolute inset-0 pointer-events-none opacity-80"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(120,56,255,0.35), transparent 40%)," +
              "radial-gradient(circle at 80% 0%, rgba(60,220,255,0.25), transparent 40%)," +
              "radial-gradient(ellipse at 60% 80%, rgba(120,180,255,0.18), transparent 45%)",
          }}
        />
        <div className="relative grid gap-8 lg:gap-10 lg:grid-cols-[1.3fr_1fr] items-center">
          <div className="space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon-400/60 bg-neon-500/10 px-3 py-1 text-xs font-semibold text-neon-100 shadow-card">
              🗳️ Voter Management System
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-display font-semibold leading-tight text-slate-50">
                Upload voter PDFs. Get structured data. Print voter slips.
              </h1>
              <p className="text-base sm:text-lg text-slate-200 max-w-2xl">
                Manage voter lists efficiently with our powerful console. Upload
                PDFs, search voters instantly, and print official voter
                information slips.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/register"
                className="btn btn-primary text-base px-5 py-3 w-full sm:w-auto justify-center"
              >
                <span className="mr-2">🚀</span> Get Started Free
              </Link>
              <Link
                href="/login"
                className="btn btn-secondary text-base px-5 py-3 w-full sm:w-auto justify-center"
              >
                <span className="mr-2">👤</span> Sign In
              </Link>
            </div>

            {/* Features Pills */}
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live search
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/50 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-200">
                🖨️ Print slips
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
                📊 CSV export
              </div>
            </div>

            {/* Key Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
              {[
                { icon: "🔍", text: "Instant search" },
                { icon: "🖨️", text: "Voter slip printing" },
                { icon: "📱", text: "Mobile friendly" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="glass-chip flex items-center gap-2"
                >
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel - Pipeline */}
          <div className="space-y-4 hidden lg:block">
            <div className="glass-panel p-5 border border-ink-400/60 shadow-2xl">
              <div className="flex items-center justify-between mb-3 text-sm text-slate-200">
                <span className="font-semibold">How it works</span>
                <span className="text-neon-200">3 steps</span>
              </div>
              <ol className="space-y-3 text-slate-100">
                <li className="step-pill">
                  <span className="step-dot bg-neon-300" /> Upload voter list
                  PDF
                </li>
                <li className="step-pill">
                  <span className="step-dot bg-blue-300" /> AI extracts voter
                  data
                </li>
                <li className="step-pill">
                  <span className="step-dot bg-emerald-300" /> Search & print
                  slips
                </li>
              </ol>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Fast search", tone: "emerald" },
                  { label: "Print ready", tone: "blue" },
                  { label: "Export CSV", tone: "amber" },
                ].map((pill) => (
                  <div
                    key={pill.label}
                    className={`pill-pill pill-${pill.tone}`}
                  >
                    {pill.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: "📄",
            title: "PDF Upload",
            desc: "Upload voter list PDFs and we extract all voter information automatically",
          },
          {
            icon: "🔍",
            title: "Smart Search",
            desc: "Find any voter instantly by name, ID, area, or other details",
          },
          {
            icon: "🖨️",
            title: "Print Slips",
            desc: "Generate official voter information slips matching ECI format",
          },
          {
            icon: "📱",
            title: "Mobile Ready",
            desc: "Works perfectly on all devices - desktop, tablet, or phone",
          },
        ].map((feature) => (
          <div key={feature.title} className="card text-center">
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="font-semibold text-slate-100 mb-2">
              {feature.title}
            </h3>
            <p className="text-sm text-slate-400">{feature.desc}</p>
          </div>
        ))}
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
            <span className="mr-2">📧</span>
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
}
