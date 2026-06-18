import { motion } from "framer-motion";

export default function DispatchPanel({ dispatch }) {
  const chosen = dispatch.chosen;
  const units = dispatch.units ?? [];
  const maxCost = Math.max(...units.map((u) => u.cost), 1);

  return (
    <motion.aside
      className="rakshak-card"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 210 }}
    >
      <div className="rakshak-hdr">
        <span className="rakshak-badge">▶ RAKSHAK dispatch verdict</span>
        <span className="rakshak-unit">{chosen.name}</span>
        <span className="rakshak-route">
          {chosen.home_label} → {dispatch.target.label} · exit: {dispatch.flagged_exit.label}
        </span>
      </div>

      <div className="rakshak-stats">
        <div className="rakshak-stat">
          <span className="rakshak-stat-lbl">ETA</span>
          <span className="rakshak-stat-val">{chosen.eta_s}s</span>
        </div>
        <div className="rakshak-stat">
          <span className="rakshak-stat-lbl">Hops</span>
          <span className="rakshak-stat-val">{chosen.hop_distance}</span>
        </div>
        <div className="rakshak-stat">
          <span className="rakshak-stat-lbl">Cost</span>
          <span className="rakshak-stat-val">{chosen.cost}</span>
        </div>
      </div>

      <div className="rakshak-cmp">
        <div className="rakshak-cmp-title">Unit comparison</div>
        {units.map((unit) => (
          <div
            key={unit.id}
            className={`rakshak-unit-bar-row${unit.id === chosen.id ? " chosen" : ""}`}
          >
            <span className="rub-id">{unit.id}</span>
            <div className="rub-track">
              <div
                className="rub-fill"
                style={{ width: `${(unit.cost / maxCost) * 100}%` }}
              />
            </div>
            <span className="rub-cost">{unit.cost}</span>
          </div>
        ))}
      </div>
    </motion.aside>
  );
}
