import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";
import { userAPI } from "../../lib/api";
import toast from "react-hot-toast";

export default function VoterDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["user", "admin"]}>
      <VoterDetailContent />
    </ProtectedRoute>
  );
}

function VoterDetailContent() {
  const router = useRouter();
  const { id } = router.query;
  const [voter, setVoter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    userAPI
      .getVoter(id, controller.signal)
      .then((res) => {
        setVoter(res.voter || res);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load voter details");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleMarkAsPrinted = async () => {
    if (!id) return;
    setMarkingPrinted(true);
    try {
      await userAPI.markAsPrinted(id);
      setVoter((prev) => ({ ...prev, is_printed: true }));
      toast.success("Voter marked as printed");
    } catch (err) {
      toast.error(err.message || "Failed to mark as printed");
    } finally {
      setMarkingPrinted(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent"></div>
          <p className="text-slate-300">Loading voter details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/search"
          className="text-sm text-neon-200 hover:text-neon-100"
        >
          ← Back to search
        </Link>
        <div className="p-4 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!voter) {
    return (
      <div className="space-y-6">
        <Link
          href="/search"
          className="text-sm text-neon-200 hover:text-neon-100"
        >
          ← Back to search
        </Link>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-slate-100">
            Voter not found
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link
            href="/search"
            className="text-sm text-neon-200 hover:text-neon-100"
          >
            ← Back to search
          </Link>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Voter Details
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {voter.is_printed && (
            <span className="badge bg-emerald-900/50 text-emerald-200 border-emerald-700">
              ✓ Printed
            </span>
          )}
        </div>
      </div>

      {/* Voter Card - Printable */}
      <div ref={printRef} className="voter-slip-print">
        <div className="card space-y-6">
          {/* Header Section */}
          <div className="text-center border-b border-ink-400/50 pb-4">
            <h2 className="text-xl font-bold text-neon-200">
              🗳️ VOTER INFORMATION SLIP
            </h2>
            <p className="text-sm text-slate-400 mt-1">Official Reference Document</p>
          </div>

          {/* Voter ID Highlight */}
          <div className="text-center p-4 bg-gradient-to-r from-neon-500/20 to-neon-400/10 rounded-xl border border-neon-400/30">
            <p className="text-sm text-slate-400 mb-1">Voter ID (EPIC Number)</p>
            <p className="text-2xl font-bold font-mono text-neon-200 tracking-wider">
              {voter.voter_id || "—"}
            </p>
          </div>

          {/* Location Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-ink-100/50 rounded-xl">
            <InfoItem label="Assembly" value={voter.assembly} icon="🏛️" />
            <InfoItem label="Part Number" value={voter.part_number} icon="🧩" />
            <InfoItem label="Section" value={voter.section} icon="📍" />
          </div>

          {/* Voter Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem
              label="Serial Number"
              value={voter.serial_number}
              icon="🔢"
              large
            />
            <InfoItem
              label={voter.relation_type || "Father/Husband"}
              value={voter.relation_name}
              icon="👨‍👩‍👧"
              large
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <InfoItem label="Voter Name" value={voter.name} icon="👤" large highlight />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoItem
              label="House Number"
              value={voter.house_number}
              icon="🏠"
            />
            <InfoItem label="Age" value={voter.age} icon="📅" />
            <InfoItem label="Gender" value={voter.gender} icon="⚧" capitalize />
          </div>

          {/* Polling Station (if available) */}
          {voter.polling_station && (
            <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-400/30">
              <InfoItem 
                label="Polling Station" 
                value={voter.polling_station} 
                icon="🏢" 
                large 
              />
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-slate-400 pt-4 border-t border-ink-400/50 print-footer">
            <p>This is an unofficial voter information slip for reference purposes only.</p>
            <p className="mt-1">Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons - Hide on Print */}
      <div className="flex flex-wrap gap-3 print-hide">
        <button onClick={handlePrint} className="btn btn-primary">
          <span className="mr-2">🖨️</span>
          Print as PDF
        </button>

        {!voter.is_printed && (
          <button
            onClick={handleMarkAsPrinted}
            disabled={markingPrinted}
            className="btn btn-secondary"
          >
            {markingPrinted ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
                Marking...
              </>
            ) : (
              <>
                <span className="mr-2">✓</span>
                Mark as Printed
              </>
            )}
          </button>
        )}

        <Link href="/search" className="btn btn-secondary">
          <span className="mr-2">🔍</span>
          Back to Search
        </Link>
      </div>

      {/* Print Instructions */}
      <div className="print-hide card bg-blue-500/10 border-blue-400/30">
        <h4 className="text-sm font-semibold text-blue-200 mb-2">💡 Print as PDF Instructions</h4>
        <ul className="text-sm text-slate-300 space-y-1">
          <li>• Click "Print as PDF" button above</li>
          <li>• In the print dialog, select "Save as PDF" as the destination</li>
          <li>• Choose A5 or A4 paper size for best results</li>
          <li>• Enable "Background graphics" for colored sections</li>
        </ul>
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon, large, highlight, capitalize }) {
  // Handle object values safely
  const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
  
  return (
    <div
      className={`p-3 rounded-xl bg-ink-100/30 border border-ink-400/30 ${
        large ? "py-4" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className={`font-semibold ${large ? "text-lg" : "text-base"} ${
          highlight ? "text-neon-200 font-mono" : "text-slate-100"
        } ${capitalize ? "capitalize" : ""}`}
      >
        {displayValue || "—"}
      </div>
    </div>
  );
}
