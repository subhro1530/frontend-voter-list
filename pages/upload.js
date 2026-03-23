import ProtectedRoute from "../components/ProtectedRoute";
import UploadForm from "../components/UploadForm";
import ApiEngineStatus from "../components/ApiEngineStatus";

export default function UploadPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-semibold text-slate-100">
              Upload Voter Lists
            </h1>
            <p className="text-slate-300">
              Create multiple voter list sessions in one batch upload.
            </p>
          </div>
        </div>
        <UploadForm />
        <ApiEngineStatus showSummary={false} pollInterval={4000} />
      </div>
    </ProtectedRoute>
  );
}
