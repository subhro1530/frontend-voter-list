import Link from "next/link";
import UploadForm from "../components/UploadForm";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="card bg-gradient-to-br from-teal-50 to-sand-50 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-wide text-teal-700 font-semibold">
              Gemini OCR → Neon
            </p>
            <h1 className="text-3xl md:text-4xl font-display font-semibold text-slate-900 leading-tight">
              Upload voter PDFs, extract with Gemini, and explore voters fast.
            </h1>
            <p className="text-slate-700 text-lg">
              Drop a PDF (optionally provide your Gemini key), we create a
              session via your backend, then you can browse pages and filter
              voters with a responsive UI.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sessions" className="btn btn-primary">
                View Sessions
              </Link>
              <Link href="/sessions#upload" className="btn btn-secondary">
                Upload PDF
              </Link>
            </div>
          </div>
          <div className="card border-dashed border-2 border-teal-100 bg-white/80">
            <ol className="list-decimal list-inside space-y-2 text-slate-800">
              <li>POST /sessions with your PDF.</li>
              <li>Gemini OCR processes pages.</li>
              <li>Data lands in Neon; browse and filter voters.</li>
            </ol>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="badge bg-emerald-50 border-emerald-200">
                Fast search
              </div>
              <div className="badge bg-blue-50 border-blue-200">
                Shareable filters
              </div>
              <div className="badge bg-amber-50 border-amber-200">
                CSV export
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card space-y-2 lg:col-span-2">
          <h2 className="text-xl font-semibold text-slate-900">Upload now</h2>
          <UploadForm />
        </div>
        <div className="card space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">How it works</h3>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>Base URL comes from NEXT_PUBLIC_API_BASE.</li>
            <li>GETs auto-retry once with small backoff and are abortable.</li>
            <li>
              Status polling keeps the session card fresh while processing.
            </li>
            <li>Gemini API key field is saved locally for quicker uploads.</li>
            <li>Filters stay in the URL so you can share links.</li>
            <li>CSV export uses the current filtered voter list.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
