import { motion } from "framer-motion";

const STATE_COLOR = {
  idle:       "var(--muted)",
  scanning:   "var(--cyan)",
  prearmed:   "var(--amber)",
  clear:      "var(--green)",
  match:      "var(--red)",
  exit_flag:  "var(--amber)",
  dispatched: "var(--amber)",
};

const STATE_LABEL = {
  idle: "IDLE", scanning: "SCANNING", prearmed: "PRE-ARMED",
  clear: "CLEAR", match: "MATCH", exit_flag: "EXIT FLAG", dispatched: "DISPATCHED",
};

function StatRow({ label, value, accent }) {
  return (
    <div className="nm-stat-row">
      <span className="nm-stat-label">{label}</span>
      <span className="nm-stat-value" style={accent ? { color: accent } : undefined}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function NodeModal({ detail, onClose }) {
  if (!detail) return null;

  const edge  = detail.edge_latency_ms  ?? 0;
  const cloud = detail.cloud_baseline_ms ?? 1;
  const stateColor = STATE_COLOR[detail.current_state] || "var(--muted)";

  return (
    <motion.div
      className="nm-modal"
      initial={{ scale: 0.93, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.93, opacity: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 280 }}
    >
      {/* ── Header ── */}
      <div className="nm-header">
        <div className="nm-header-left">
          <span className="nm-node-id">{detail.node_id}</span>
          <span className="nm-node-name">{detail.label}</span>
          <div className="nm-badges">
            <span className="badge badge-muted">{detail.type?.toUpperCase()}</span>
            <span className="badge" style={{ background: `${stateColor}18`, color: stateColor, border: `1px solid ${stateColor}30` }}>
              ● {STATE_LABEL[detail.current_state] || detail.current_state?.toUpperCase()}
            </span>
          </div>
        </div>
        <button className="inspector-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="nm-body">

        {/* ── Timeline ── */}
        <div className="nm-section">
          <div className="nm-section-title">Timeline</div>
          <div className="nm-timeline">
            <StatRow label="State changed at"    value={detail.state_timestamp || "—"} />
            <StatRow
              label="Pre-armed at (elapsed)"
              value={detail.prearmed_at_elapsed != null
                ? `T+${detail.prearmed_at_elapsed}s`
                : "Not pre-armed"}
              accent={detail.prearmed_at_elapsed != null ? "var(--amber)" : undefined}
            />
            {detail.prearmed_lead_s != null && (
              <StatRow
                label="Lead time before match"
                value={`${detail.prearmed_lead_s}s ahead`}
                accent="var(--amber)"
              />
            )}
            {detail.match_info && (
              <StatRow
                label="Matched at (elapsed)"
                value={`T+${detail.match_info.elapsed_s}s  ·  ${detail.match_info.ts}`}
                accent="var(--red)"
              />
            )}
          </div>
        </div>

        {/* ── Latency comparison ── */}
        <div className="nm-section">
          <div className="nm-section-title">Latency — Edge vs Cloud</div>
          <div className="lat-compare" style={{ border: "none", padding: 0 }}>
            <div className="lat-row">
              <span className="lat-row-label">Edge</span>
              <div className="lat-track">
                <div className="lat-fill lat-fill-edge" style={{ width: `${Math.round((edge / cloud) * 100)}%` }} />
              </div>
              <span className="lat-val">{edge} ms</span>
            </div>
            <div className="lat-row">
              <span className="lat-row-label">Cloud</span>
              <div className="lat-track">
                <div className="lat-fill lat-fill-cloud" style={{ width: "100%" }} />
              </div>
              <span className="lat-val">{cloud} ms</span>
            </div>
          </div>
        </div>

        {/* ── 5G Telemetry ── */}
        <div className="nm-section">
          <div className="nm-section-title">5G Telemetry</div>
          <div className="nm-timeline">
            <StatRow label="Throughput"       value={`${detail.throughput_mbps} Mbps`} />
            <StatRow label="Jitter"           value={`${detail.jitter_ms} ms`} />
            <StatRow label="Packet loss"      value={`${detail.packet_loss_pct}%`} />
            <StatRow label="Reliability"      value={`${detail.reliability_pct}%`} />
            <StatRow label="5QI"              value={detail.fiveqi} accent="var(--cyan)" />
            <StatRow label="Persons in frame" value={detail.persons_in_frame} />
          </div>
          <div className="badge-row" style={{ marginTop: 10 }}>
            <span className="badge badge-cyan">{detail.slice}</span>
          </div>
          <div className="badge-row" style={{ marginTop: 6 }}>
            <span className="badge badge-amber">🔒 {detail.video_status}</span>
          </div>
          <div className="badge-row" style={{ marginTop: 6 }}>
            <span className="badge badge-muted">{detail.mec_status}</span>
          </div>
        </div>

        {/* ── Connectivity ── */}
        <div className="nm-section">
          <div className="nm-section-title">
            Connected Nodes
            <span className="nm-count">{detail.neighbor_count}</span>
          </div>
          <div className="nm-neighbors">
            {(detail.neighbors || []).map((nb) => {
              const nbColor = STATE_COLOR[nb.state] || "var(--muted)";
              return (
                <div className="nm-neighbor-row" key={nb.id}>
                  <span className="nm-nb-dot" style={{ color: nbColor }}>●</span>
                  <span className="nm-nb-label">{nb.label}</span>
                  <span className="nm-nb-type badge badge-muted">{nb.type}</span>
                  <span className="nm-nb-state" style={{ color: nbColor }}>
                    {STATE_LABEL[nb.state] || nb.state?.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
