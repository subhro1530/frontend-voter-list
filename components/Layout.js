import Link from "next/link";
import Head from "next/head";

export default function Layout({ children }) {
  return (
    <div
      className="min-h-screen text-slate-100"
      style={{
        background:
          "radial-gradient(circle at 15% 20%, rgba(140,43,255,0.20), transparent 30%)," +
          "radial-gradient(circle at 80% 0%, rgba(72,104,191,0.25), transparent 25%)," +
          "linear-gradient(135deg, #0f1427 0%, #141b35 35%, #1a2245 70%, #202c58 100%)",
      }}
    >
      <Head>
        <title>Voter List Console</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Upload voter PDFs, process with Gemini OCR, and explore voters via Neon-backed API."
        />
      </Head>
      <header className="sticky top-0 z-20 backdrop-blur bg-ink-100/80 border-b border-ink-400/60">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-display font-semibold text-neon-200"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neon-500/20 text-neon-100 font-bold border border-neon-400/50">
              VL
            </span>
            <span>Voter List Console</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-semibold">
            <Link className="btn btn-secondary" href="/sessions">
              View Sessions
            </Link>
            <Link className="btn btn-primary" href="/upload">
              Upload PDF
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">{children}</main>
      <footer className="border-t border-ink-400/70 bg-ink-100/80">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>Powered by Gemini OCR → Neon → Next.js</span>
          <div className="flex gap-3">
            <a href="/sessions">Sessions</a>
            <a href="/upload">Upload</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
