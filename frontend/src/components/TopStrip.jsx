export default function TopStrip({ metrics, onInfoClick, isDone, isLive }) {
  const elapsed = metrics?.elapsed_s ?? 0;
  const timerText = isDone
    ? `LOCATED · ${elapsed.toFixed(1)}s`
    : `T+${elapsed.toFixed(1)}s`;

  return (
    <header className="status-rail">
      <div className="rail-brand">
        <span className="rail-brand-name">SURAKSHA-5G</span>
        <span className="rail-brand-sub">NDLS · Intra-Hub Dragnet</span>
      </div>

      {isLive && <span className="rail-live-dot" title="Hunt active" />}

      <div className="rail-sep" />

      <div className="rail-timer">
        <span className={`rail-timer-value${isDone ? " done" : ""}`}>
          {timerText}
        </span>
      </div>

      <div className="rail-right">
        <span className="rail-slice-chip">
          SST-2 URLLC · 5QI 82 · 99.999%
        </span>
        <button className="rail-info-btn" onClick={onInfoClick} aria-label="Real vs Simulated">
          ⓘ
        </button>
      </div>
    </header>
  );
}
