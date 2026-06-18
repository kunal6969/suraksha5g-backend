import { motion } from "framer-motion";

const ROWS = [
  ["Graph traversal / BFS", "REAL", "NetworkX computes neighbors and shortest paths on the station graph."],
  ["Parallel multi-node scan", "REAL", "Each hop scans multiple CCTV zones simultaneously."],
  ["RAKSHAK cost function", "REAL MATH", "Fleet is simulated, but the argmin calculation is real."],
  ["Per-node 5G metrics", "SIMULATED", "Stable seeded values with plausible edge/MEC numbers."],
  ["CCTV detections", "SCRIPTED", "Deterministic scenario for repeatable judging."],
  ["Face-recognition model", "BENCHMARKED SEPARATELY", "ArcFace-style embedding represented as a 3 KB vector."],
  ["5G slice / MEC / radio", "EMULATED", "Each node behaves like a separate MEC instance."],
];

export default function HonestyPanel({ onClose }) {
  return (
    <motion.div
      className="honesty-modal"
      initial={{ scale: 0.93, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.93, opacity: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 280 }}
    >
      <div className="honesty-mhdr">
        <span className="honesty-mtitle">Real vs Simulated</span>
        <button className="honesty-mclose" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="honesty-table">
        {ROWS.map(([item, status, detail]) => (
          <div className="honesty-row" key={item}>
            <span className="honesty-item">{item}</span>
            <span className="honesty-status">{status}</span>
            <span className="honesty-detail">{detail}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
