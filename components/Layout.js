import Link from "next/link";
import Head from "next/head";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sand-50 via-sand-100 to-sand-200 text-slate-50">
      <Head>
        <title>Voter List Console</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Upload voter PDFs, process with Gemini OCR, and explore voters via Neon-backed API."
        />
      </Head>
      <header className="sticky top-0 z-20 backdrop-blur bg-sand-100/80 border-b border-sand-400/70">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-display font-semibold text-teal-200"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400/20 text-teal-200 font-bold border border-teal-500/40">
              VL
            </span>
            <span>Voter List Console</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-semibold">
            <Link className="btn btn-secondary" href="/sessions">
              View Sessions
            </Link>
            <Link className="btn btn-primary" href="/sessions#upload">
              Upload PDF
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">{children}</main>
      <footer className="border-t border-sand-400/70 bg-sand-100/80">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>Powered by Gemini OCR → Neon → Next.js</span>
          <div className="flex gap-3">
            <a href="/sessions">Sessions</a>
            <a href="/sessions#upload">Upload</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
