import SessionList from "../../components/SessionList";

export default function SessionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Sessions
          </h1>
          <p className="text-slate-300">
            Review, refresh, and manage existing sessions.
          </p>
        </div>
        <div className="text-sm text-slate-400">
          Session creation happens on the upload page.
        </div>
      </div>
      <SessionList />
    </div>
  );
}
