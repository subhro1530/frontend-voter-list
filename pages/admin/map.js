import ProtectedRoute from "../../components/ProtectedRoute";
import dynamic from "next/dynamic";
import Head from "next/head";

// Dynamic import to avoid SSR issues with Leaflet
const MapViewer = dynamic(() => import("../../components/MapViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-12rem)] min-h-[500px] rounded-2xl bg-ink-100 border border-ink-400/70 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-neon-400/30 border-t-neon-400"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl">🗺️</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-slate-200 font-semibold">Loading Map Console</p>
          <p className="text-slate-500 text-xs mt-1">
            Initializing interactive map engine...
          </p>
        </div>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Head>
        <title>Map Console | Voter List</title>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </Head>
      <MapPageContent />
    </ProtectedRoute>
  );
}

function MapPageContent() {
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-neon-500/30 to-blue-500/30 rounded-xl flex items-center justify-center border border-neon-400/30">
            <svg
              className="w-5 h-5 text-neon-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-slate-100">
              Map Console
            </h1>
            <p className="text-xs text-slate-400">
              Interactive constituency map explorer with filters, directions &
              details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-400/30 rounded-full text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            30 States Available
          </span>
        </div>
      </div>

      {/* Map */}
      <MapViewer />

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-center gap-6 text-[10px] text-slate-500 pt-2">
        <span>
          <kbd className="px-1.5 py-0.5 bg-ink-200 border border-ink-400 rounded text-slate-400 font-mono">
            Click
          </kbd>{" "}
          Select constituency
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-ink-200 border border-ink-400 rounded text-slate-400 font-mono">
            Scroll
          </kbd>{" "}
          Zoom in/out
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-ink-200 border border-ink-400 rounded text-slate-400 font-mono">
            Drag
          </kbd>{" "}
          Pan map
        </span>
      </div>
    </div>
  );
}
