export default function CandidateStatCard({ stat, totalBooths }) {
  const winRate =
    totalBooths > 0 ? ((stat.boothsWon / totalBooths) * 100).toFixed(1) : 0;

  return (
    <div className="card space-y-3">
      <h3
        className="font-bold text-lg text-neon-200 truncate"
        title={stat.candidateName}
      >
        {stat.candidateName}
      </h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
          <span className="text-slate-400 text-xs">Total Votes</span>
          <p className="font-semibold text-xl text-slate-100">
            {stat.totalVotes?.toLocaleString() || 0}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
          <span className="text-slate-400 text-xs">Booths Won</span>
          <p className="font-semibold text-xl text-slate-100">
            {stat.boothsWon}/{totalBooths}{" "}
            <span className="text-sm text-slate-400">({winRate}%)</span>
          </p>
        </div>
        <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
          <span className="text-slate-400 text-xs">Avg Votes/Booth</span>
          <p className="font-semibold text-slate-100">
            {stat.averageVotes?.toLocaleString() || 0}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
          <span className="text-slate-400 text-xs">Best Booth</span>
          <p className="font-semibold text-slate-100">
            #{stat.highestBooth}{" "}
            <span className="text-sm text-emerald-400">
              ({stat.highestVotes?.toLocaleString()})
            </span>
          </p>
        </div>
        <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
          <span className="text-slate-400 text-xs">Worst Booth</span>
          <p className="font-semibold text-slate-100">
            #{stat.lowestBooth}{" "}
            <span className="text-sm text-rose-400">
              ({stat.lowestVotes?.toLocaleString()})
            </span>
          </p>
        </div>
        <div className="p-3 rounded-xl bg-ink-100/30 border border-ink-400/30">
          <span className="text-slate-400 text-xs">Booths Contested</span>
          <p className="font-semibold text-slate-100">
            {stat.boothsContested || totalBooths}
          </p>
        </div>
      </div>

      {/* Win-rate progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Win Rate</span>
          <span>{winRate}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-ink-400/50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-neon-500 to-neon-300"
            style={{ width: `${winRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
