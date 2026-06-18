import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

const LEVEL_META = {
  system:   { label: "SYSTEM",   color: "#22D3EE", bg: "rgba(34,211,238,0.08)"  },
  info:     { label: "INFO",     color: "#8294B5", bg: "rgba(130,148,181,0.06)" },
  prearm:   { label: "PRE-ARM",  color: "#FFB23E", bg: "rgba(255,178,62,0.10)"  },
  match:    { label: "MATCH",    color: "#FF5A5F", bg: "rgba(255,90,95,0.10)"   },
  alert:    { label: "ALERT",    color: "#FFB23E", bg: "rgba(255,178,62,0.10)"  },
  dispatch: { label: "DISPATCH", color: "#34D399", bg: "rgba(52,211,153,0.10)"  },
};

function levelMeta(level) {
  return LEVEL_META[level] || { label: (level || "—").toUpperCase(), color: "#8294B5", bg: "rgba(130,148,181,0.06)" };
}

export default function EventPanel({ events, isOpen, onToggle }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (isOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [events, isOpen]);

  const lastEvent = events[events.length - 1];

  return (
    <>
      {/* ── Tab trigger on right edge ── */}
      <button
        className={`ep-tab${isOpen ? " ep-tab-open" : ""}`}
        onClick={onToggle}
        title="Toggle Operation Log"
      >
        <span className="ep-tab-icon">{isOpen ? "▶" : "◀"}</span>
        <span className="ep-tab-label">LOG</span>
        {events.length > 0 && (
          <span className="ep-tab-count">{events.length}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className="ep-panel"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* ── Header ── */}
            <div className="ep-hdr">
              <div className="ep-hdr-left">
                <div className="ep-hdr-icon">◈</div>
                <div>
                  <div className="ep-hdr-title">OPERATION LOG</div>
                  <div className="ep-hdr-sub">Live event stream · {events.length} entries</div>
                </div>
              </div>
              <button className="inspector-close" onClick={onToggle}>×</button>
            </div>

            {/* ── Latest event banner ── */}
            <AnimatePresence mode="wait">
              {lastEvent && (
                <motion.div
                  key={events.length}
                  className="ep-latest"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ borderLeftColor: levelMeta(lastEvent.level).color }}
                >
                  <span className="ep-latest-badge" style={{
                    color: levelMeta(lastEvent.level).color,
                    background: levelMeta(lastEvent.level).bg,
                  }}>
                    {levelMeta(lastEvent.level).label}
                  </span>
                  <span className="ep-latest-msg">{lastEvent.message}</span>
                  <span className="ep-latest-ts">{lastEvent.ts}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Scrollable event list ── */}
            <div className="ep-body" ref={bodyRef}>
              {events.length === 0 ? (
                <div className="ep-empty">
                  <div className="ep-empty-icon">◎</div>
                  <div>Initialize the scenario to begin</div>
                  <div className="ep-empty-sub">Events will stream here in real time</div>
                </div>
              ) : (
                events.map((ev, i) => {
                  const meta = levelMeta(ev.level);
                  const isNew = i === events.length - 1;
                  return (
                    <motion.div
                      className={`ep-row ep-row-${ev.level}`}
                      key={i}
                      style={{ borderLeftColor: meta.color }}
                      initial={isNew ? { opacity: 0, x: 12 } : false}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.28 }}
                    >
                      <div className="ep-row-head">
                        <span
                          className="ep-badge"
                          style={{ color: meta.color, background: meta.bg }}
                        >
                          {meta.label}
                        </span>
                        <span className="ep-ts">{ev.ts}</span>
                      </div>
                      <div className="ep-msg">{ev.message}</div>
                      {ev.node_id && (
                        <div className="ep-node">
                          <span className="ep-node-dot" style={{ color: meta.color }}>●</span>
                          {ev.node_id}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* ── Footer ── */}
            <div className="ep-footer">
              <span className="ep-footer-dot" />
              <span>{events.length > 0 ? "Stream active" : "Awaiting initialization"}</span>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
