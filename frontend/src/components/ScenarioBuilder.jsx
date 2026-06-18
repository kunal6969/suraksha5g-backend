import { motion } from "framer-motion";
import { useState } from "react";

const TYPE_ORDER = [
  "entry", "exit", "concourse", "platform", "checkpoint",
  "bridge", "hall", "transit", "amenity", "parking", "response",
];

function groupNodes(nodes) {
  const groups = {};
  for (const n of nodes) {
    const t = n.type || "other";
    if (!groups[t]) groups[t] = [];
    groups[t].push(n);
  }
  return groups;
}

const blank = () => ({ nodeId: "" });

export default function ScenarioBuilder({ nodes, onSubmit, onClose, isBusy }) {
  const [origin,    setOrigin]    = useState("");
  const [sightings, setSightings] = useState([blank()]);
  const [error,     setError]     = useState("");

  const groups     = groupNodes(nodes);
  const sortedTypes = TYPE_ORDER.filter((t) => groups[t]);

  function buildOptions(excludeIds = []) {
    return sortedTypes.map((type) => (
      <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
        {groups[type]
          .filter((n) => !excludeIds.includes(n.id))
          .map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
      </optgroup>
    ));
  }

  function addSighting() {
    setSightings((prev) => [...prev, blank()]);
  }

  function removeSighting(i) {
    setSightings((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateSighting(i, field, value) {
    setSightings((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!origin) { setError("Choose a start node."); return; }

    const filled = sightings.filter((s) => s.nodeId);
    if (filled.length === 0) { setError("Add at least one sighting."); return; }

    for (const s of filled) {
      if (s.nodeId === origin) {
        setError("A sighting node cannot be the same as the origin.");
        return;
      }
    }

    const ids = filled.map((s) => s.nodeId);
    if (new Set(ids).size !== ids.length) {
      setError("Each sighting must be a different node.");
      return;
    }

    onSubmit(origin, filled.map((s) => s.nodeId));
  }

  const filled = sightings.filter((s) => s.nodeId);

  return (
    <motion.div
      className="sb-modal"
      initial={{ scale: 0.93, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.93, opacity: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 280 }}
    >
      <div className="sb-header">
        <div>
          <span className="sb-title">Custom Simulation Builder</span>
          <span className="sb-subtitle">
            Define where the search starts and every confirmed suspect sighting
          </span>
        </div>
        <button className="inspector-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <form className="sb-body" onSubmit={handleSubmit}>

        {/* ── Origin ── */}
        <div className="sb-field">
          <label className="sb-label">
            WHERE DOES THE SEARCH START?
            <span className="sb-hint">The camera node where the CCTV hunt begins</span>
          </label>
          <select
            className="sb-select"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            <option value="">— select origin node —</option>
            {buildOptions(sightings.map((s) => s.nodeId).filter(Boolean))}
          </select>
        </div>

        <div className="sb-divider" />

        {/* ── Sightings ── */}
        <div className="sb-field">
          <div className="sb-sightings-hdr">
            <div className="sb-label" style={{ gap: 2 }}>
              SUSPECT SIGHTINGS
              <span className="sb-hint">
                Where (and when) was the suspect seen? Add as many as you have.
                Time is optional but enables time-aware path prediction.
              </span>
            </div>
            <button
              type="button"
              className="sb-toggle"
              onClick={addSighting}
            >
              + Add Sighting
            </button>
          </div>

          <div className="sb-sightings-list">
            {sightings.map((s, i) => {
              const excludeForRow = [
                origin,
                ...sightings.filter((_, idx) => idx !== i).map((x) => x.nodeId),
              ].filter(Boolean);

              return (
                <div className="sb-sighting-row" key={i}>
                  <span className="sb-sighting-num">{i + 1}</span>
                  <select
                    className="sb-select sb-select-amber sb-sighting-select"
                    value={s.nodeId}
                    onChange={(e) => updateSighting(i, "nodeId", e.target.value)}
                  >
                    <option value="">— node —</option>
                    {buildOptions(excludeForRow)}
                  </select>
                  {sightings.length > 1 && (
                    <button
                      type="button"
                      className="sb-remove-btn"
                      onClick={() => removeSighting(i)}
                      title="Remove this sighting"
                    >×</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Preview ── */}
        {origin && filled.length > 0 && (
          <div className="sb-preview">
            <span className="sb-preview-label">Scenario preview</span>
            <div className="sb-preview-flow">
              <span className="sb-pnode sb-pnode-origin">
                {nodes.find((n) => n.id === origin)?.label || origin}
              </span>
              <span className="sb-arrow">→ sweep →</span>
              <span className="sb-pnode sb-pnode-prearm">PRE-ARM</span>
              {filled.map((s, i) => (
                <span key={i} style={{ display: "contents" }}>
                  <span className="sb-arrow">→</span>
                  <span className="sb-pnode sb-pnode-match">
                    {nodes.find((n) => n.id === s.nodeId)?.label || s.nodeId}
                  </span>
                </span>
              ))}
              <span className="sb-arrow">→</span>
              <span className="sb-pnode sb-pnode-exit">EXIT FLAG</span>
            </div>
          </div>
        )}

        {error && <div className="sb-error">{error}</div>}

        <div className="sb-actions">
          <button type="button" className="dock-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="dock-btn dock-btn-primary"
            disabled={isBusy || !origin || filled.length === 0}
          >
            {isBusy ? "Generating…" : "▶ Generate & Run"}
          </button>
        </div>

      </form>
    </motion.div>
  );
}
