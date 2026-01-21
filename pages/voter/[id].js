import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";
import VoterSlip, { VoterImage } from "../../components/VoterSlip";
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 text-sm text-neon-200 hover:text-neon-100 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to search
          </Link>
          <h1 className="text-xl sm:text-2xl font-display font-semibold text-slate-100">
            Voter Details
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {voter.is_printed && (
            <span className="badge bg-emerald-900/50 text-emerald-200 border-emerald-700">
              ✓ Printed
            </span>
          )}
        </div>
      </div>

      {/* Quick Info Card with Photo */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          {/* Voter Photo */}
          <div className="flex-shrink-0">
            <VoterImage voter={voter} size="xlarge" showBorder={true} />
          </div>

          {/* Quick Info */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-neon-200 mb-2">
              {voter.name || "—"}
            </h2>
            <p className="text-lg font-mono text-slate-300 mb-4">
              {voter.voter_id || "—"}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="quick-info-item">
                <span className="quick-info-label">Age</span>
                <span className="quick-info-value">{voter.age || "—"}</span>
              </div>
              <div className="quick-info-item">
                <span className="quick-info-label">Gender</span>
                <span className="quick-info-value capitalize">
                  {voter.gender || "—"}
                </span>
              </div>
              <div className="quick-info-item">
                <span className="quick-info-label">Part No.</span>
                <span className="quick-info-value">
                  {voter.part_number || "—"}
                </span>
              </div>
              <div className="quick-info-item">
                <span className="quick-info-label">Serial No.</span>
                <span className="quick-info-value">
                  {voter.serial_number || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handlePrint}
          className="btn btn-primary flex-1 sm:flex-none"
        >
          <span className="mr-2">🖨️</span>
          Print Voter Slip
        </button>

        {!voter.is_printed && (
          <button
            onClick={handleMarkAsPrinted}
            disabled={markingPrinted}
            className="btn btn-secondary flex-1 sm:flex-none"
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

        <Link href="/search" className="btn btn-secondary flex-1 sm:flex-none">
          <span className="mr-2">🔍</span>
          Search Again
        </Link>
      </div>

      {/* Voter Slip - Printable */}
      <div ref={printRef} className="voter-slip-print">
        <VoterSlip voter={voter} showQR={true} />
      </div>

      {/* Additional Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Location Details */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>📍</span> Location Details
          </h3>
          <div className="space-y-3">
            <InfoItem label="Assembly" value={voter.assembly} icon="🏛️" />
            <InfoItem label="Section" value={voter.section} icon="📍" />
            <InfoItem
              label="House Number"
              value={voter.house_number}
              icon="🏠"
            />
            {voter.polling_station && (
              <InfoItem
                label="Polling Station"
                value={voter.polling_station}
                icon="🏢"
              />
            )}
          </div>
        </div>

        {/* Family Details */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>👨‍👩‍👧</span> Family Details
          </h3>
          <div className="space-y-3">
            <InfoItem
              label="Voter Name"
              value={voter.name}
              icon="👤"
              highlight
            />
            <InfoItem
              label={voter.relation_type || "Father/Husband"}
              value={voter.relation_name}
              icon="👨‍👧"
            />
          </div>
        </div>
      </div>

      {/* Print Instructions */}
      <div className="print-hide card bg-blue-500/10 border-blue-400/30">
        <h4 className="text-sm font-semibold text-blue-200 mb-3 flex items-center gap-2">
          <span>💡</span> Print as PDF Instructions
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
          <div className="flex items-start gap-2">
            <span className="text-blue-400">1.</span>
            <span>Click "Print Voter Slip" button above</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400">2.</span>
            <span>Select "Save as PDF" as destination</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400">3.</span>
            <span>Choose A5 or A4 paper size</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-blue-400">4.</span>
            <span>Enable "Background graphics" option</span>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="print-hide card bg-gradient-to-r from-purple-500/10 to-neon-500/10 border-purple-400/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📧</span>
            <div>
              <h4 className="text-sm font-semibold text-purple-200">
                Need Help?
              </h4>
              <p className="text-sm text-slate-300">
                Contact us for any issues
              </p>
            </div>
          </div>
          <a
            href="mailto:acodernamedsubhro@gmail.com"
            className="btn btn-secondary text-sm"
          >
            <span className="mr-2">✉️</span>
            acodernamedsubhro@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon, large, highlight, capitalize }) {
  // Handle object values safely
  const displayValue =
    typeof value === "object" ? JSON.stringify(value) : value;

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
