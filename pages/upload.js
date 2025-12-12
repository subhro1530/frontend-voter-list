import UploadForm from "../components/UploadForm";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Upload PDF
          </h1>
          <p className="text-slate-300">
            Create a session by posting your voter list PDF.
          </p>
        </div>
      </div>
      <UploadForm />
    </div>
  );
}
