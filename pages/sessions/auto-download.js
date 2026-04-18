import ProtectedRoute from "../../components/ProtectedRoute";
import SequentialBoothAutoDownloadPanel from "../../components/SequentialBoothAutoDownloadPanel";

export default function SessionsAutoDownloadPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-semibold text-slate-100">
              Sequential Booth Auto Download
            </h1>
            <p className="text-slate-300">
              Run booth-by-booth voter slip generation without affecting the
              main sessions list page.
            </p>
          </div>
        </div>

        <SequentialBoothAutoDownloadPanel />
      </div>
    </ProtectedRoute>
  );
}
