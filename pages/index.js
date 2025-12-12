import Link from "next/link";
import UploadForm from "../components/UploadForm";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-ink-400/60 bg-gradient-to-br from-ink-100 to-ink-200 p-8 lg:p-10 shadow-2xl">
        <div
          className="absolute inset-0 pointer-events-none opacity-80"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(120,56,255,0.35), transparent 40%)," +
              "radial-gradient(circle at 80% 0%, rgba(60,220,255,0.25), transparent 40%)," +
              "radial-gradient(ellipse at 60% 80%, rgba(120,180,255,0.18), transparent 45%)",
          }}
        />
        <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon-400/60 bg-neon-500/10 px-3 py-1 text-xs font-semibold text-neon-100 shadow-card">
              Gemini OCR → Neon → Next.js
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-display font-semibold leading-tight text-slate-50">
                Upload voter PDFs. Get structured voters. Move in minutes.
              </h1>
              <p className="text-lg text-slate-200 max-w-2xl">
                Drop a PDF, optionally add your Gemini key, and we spin up a
                session that streams into Neon. Search, filter, and export on a
                lightning-fast console built for ops teams.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/sessions"
                className="btn btn-primary text-base px-5 py-3"
              >
                View Sessions
              </Link>
              <Link
                href="/upload"
                className="btn btn-secondary text-base px-5 py-3"
              >
                Upload a PDF
              </Link>
              <div className="inline-flex items-center gap-2 rounded-full border border-ink-400/70 bg-ink-100/70 px-3 py-2 text-sm text-slate-200">
                <span className="h-2 w-2 rounded-full bg-neon-300" /> Live
                filters • CSV export
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {[
                "Neon-backed search",
                "Shareable filter URLs",
                "Abortable fetch with retry",
              ].map((item) => (
                <div key={item} className="glass-chip">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-panel p-5 border border-ink-400/60 shadow-2xl">
              <div className="flex items-center justify-between mb-3 text-sm text-slate-200">
                <span className="font-semibold">Pipeline</span>
                <span className="text-neon-200">3 steps</span>
              </div>
              <ol className="space-y-3 text-slate-100">
                <li className="step-pill">
                  <span className="step-dot bg-neon-300" /> POST /sessions with
                  your PDF
                </li>
                <li className="step-pill">
                  <span className="step-dot bg-blue-300" /> Gemini OCR processes
                  pages
                </li>
                <li className="step-pill">
                  <span className="step-dot bg-emerald-300" /> Rows land in
                  Neon, ready to query
                </li>
              </ol>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Fast search", tone: "emerald" },
                  { label: "Shareable filters", tone: "blue" },
                  { label: "CSV export", tone: "amber" },
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
            <div className="glass-panel p-4 grid grid-cols-2 gap-3 text-sm">
              {[
                "Neon vector speed",
                "Zero-copy filters",
                "Abortable fetch",
                "Gemini-ready",
              ].map((k) => (
                <div key={k} className="flex items-center gap-2 text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-neon-300" />
                  <span>{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-neon-200 font-semibold">
                Upload now
              </p>
              <h2 className="text-2xl font-display font-semibold text-slate-50">
                Create a session
              </h2>
              <p className="text-slate-300">
                Send a PDF, optionally include your Gemini key, and start
                processing immediately.
              </p>
            </div>
            <Link
              href="/sessions"
              className="text-sm text-neon-200 hover:text-neon-100 font-semibold"
            >
              View active sessions →
            </Link>
          </div>
          <div className="glass-panel p-5 border border-ink-400/70">
            <UploadForm />
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-5 border border-ink-400/70">
            <h3 className="text-lg font-semibold text-slate-50 mb-3">
              Playbook
            </h3>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>
                • Base URL comes from NEXT_PUBLIC_API_BASE (or /api proxy).
              </li>
              <li>
                • Requests retry once with gentle backoff and abort support.
              </li>
              <li>
                • Filters stay local for speed; CSV uses your current view.
              </li>
              <li>• Gemini key is stored locally to speed up testing.</li>
            </ul>
          </div>
          <div className="glass-panel p-5 border border-ink-400/70">
            <h3 className="text-lg font-semibold text-slate-50 mb-3">
              Why it feels fast
            </h3>
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-200">
              <div className="metric-card">
                <span className="text-xs text-slate-400">Latency</span>
                <div className="text-xl font-semibold text-neon-100">
                  Sub-200ms searches
                </div>
              </div>
              <div className="metric-card">
                <span className="text-xs text-slate-400">Filters</span>
                <div className="text-xl font-semibold text-neon-100">
                  Instant client merges
                </div>
              </div>
              <div className="metric-card">
                <span className="text-xs text-slate-400">Exports</span>
                <div className="text-xl font-semibold text-neon-100">
                  One-click CSV
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
