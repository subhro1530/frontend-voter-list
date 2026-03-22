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
              Upload Voter List
            </h1>
            <p className="text-slate-300">
              Create a voter list by posting your voter list PDF.
            </p>
          </div>
        </div>
        <UploadForm />
        <ApiEngineStatus showSummary={false} pollInterval={5000} />
      </div>
    </ProtectedRoute>
  );
}
