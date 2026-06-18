import { motion } from "framer-motion";

export default function TelemetryDrawer({ node, telemetry, onClose }) {
  const edge = telemetry?.edge_latency_ms ?? 0;
  const cloud = telemetry?.cloud_baseline_ms ?? 1;
  const maxMs = Math.max(cloud, edge, 1);

  return (
    <motion.aside
      className="node-inspector"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
    >
      <div className="inspector-hdr">
        <div>
          <span className="inspector-id">{node.id}</span>
          <span className="inspector-name">{node.label}</span>
          <span className="inspector-type">{node.type}</span>
        </div>
        <button className="inspector-close" onClick={onClose} aria-label="Close inspector">
          ×
        </button>
      </div>

      <div className="inspector-body">
        {/* Faux camera tile */}
        <div className="cam-tile">
          <div className="cam-tile-scanlines" />
          <div className="cam-tile-content">
            <span className="cam-tile-lock">🔒</span>
            <span className="cam-tile-text">RAW VIDEO DISCARDED{"\n"}3 KB EMBEDDING ONLY</span>
          </div>
        </div>

        {!telemetry && <div className="insp-loading">Loading telemetry…</div>}

        {telemetry && (
          <>
            {/* Two-bar latency comparison */}
            <div className="lat-compare">
              <div className="lat-title">Latency — Edge vs Cloud</div>
              <div className="lat-row">
                <span className="lat-row-label">Edge</span>
                <div className="lat-track">
                  <div
                    className="lat-fill lat-fill-edge"
                    style={{ width: `${(edge / maxMs) * 100}%` }}
                  />
                </div>
                <span className="lat-val">{edge} ms</span>
              </div>
              <div className="lat-row">
                <span className="lat-row-label">Cloud</span>
                <div className="lat-track">
                  <div
                    className="lat-fill lat-fill-cloud"
                    style={{ width: "100%" }}
                  />
                </div>
                <span className="lat-val">{cloud} ms</span>
              </div>
            </div>

            {/* Stat rows */}
            <div className="insp-metrics">
              <div className="insp-row">
                <span className="insp-row-label">Throughput</span>
                <span className="insp-row-val">{telemetry.throughput_mbps} Mbps</span>
              </div>
              <div className="insp-row">
                <span className="insp-row-label">Jitter</span>
                <span className="insp-row-val">{telemetry.jitter_ms} ms</span>
              </div>
              <div className="insp-row">
                <span className="insp-row-label">Packet loss</span>
                <span className="insp-row-val">{telemetry.packet_loss_pct}%</span>
              </div>
              <div className="insp-row">
                <span className="insp-row-label">Reliability</span>
                <span className="insp-row-val">{telemetry.reliability_pct}%</span>
              </div>
              <div className="insp-row">
                <span className="insp-row-label">Persons in frame</span>
                <span className="insp-row-val">{telemetry.persons_in_frame}</span>
              </div>
            </div>

            {/* Slice + 5QI badges */}
            <div>
              <div className="lat-title" style={{ marginBottom: 6 }}>Slice</div>
              <div className="badge-row">
                <span className="badge badge-cyan">{telemetry.slice}</span>
                <span className="badge badge-cyan">5QI {telemetry.fiveqi}</span>
                <span className="badge badge-cyan">99.999%</span>
              </div>
            </div>

            {/* Status badges */}
            <div>
              <div className="lat-title" style={{ marginBottom: 6 }}>Status</div>
              <div className="badge-row">
                <span className="badge badge-amber">🔒 {telemetry.video_status}</span>
              </div>
              <div className="badge-row" style={{ marginTop: 5 }}>
                <span className="badge badge-muted">{telemetry.mec_status}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.aside>
  );
}
