import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import {
  createCustomScenario,
  dispatchUnit,
  getGraph,
  getNodeDetail,
  getScenarioState,
  initScenario,
  stepScenario,
} from "./api";
import CameraNode from "./components/CameraNode.jsx";
import DispatchPanel from "./components/DispatchPanel.jsx";
import EventPanel from "./components/EventPanel.jsx";
import HonestyPanel from "./components/HonestyPanel.jsx";
import KavachStream from "./components/KavachStream.jsx";
import NodeModal from "./components/NodeModal.jsx";
import ScenarioBuilder from "./components/ScenarioBuilder.jsx";
import TopStrip from "./components/TopStrip.jsx";
import VectorEdge from "./components/VectorEdge.jsx";

const nodeTypes = { cameraNode: CameraNode };
const edgeTypes = { vectorEdge: VectorEdge };
const DISPLAY_SCALE = { x: 0.62, y: 0.72 };

function edgeKey(edge) { return `${edge.source}|${edge.target}`; }

function displayState(baseState, isScanning) {
  if (["match", "exit_flag", "dispatched"].includes(baseState)) return baseState;
  return isScanning ? "scanning" : baseState || "idle";
}

export default function App() {
  const [graph, setGraph]                   = useState({ nodes: [], edges: [] });
  const [nodeStates, setNodeStates]         = useState({});
  const [nodeTimestamps, setNodeTimestamps] = useState({});
  const [events, setEvents]                 = useState([]);
  const [metrics, setMetrics]               = useState(null);
  const [isInitialized, setIsInitialized]   = useState(false);
  const [isDone, setIsDone]                 = useState(false);
  const [isBusy, setIsBusy]                 = useState(false);
  const [transientScanning, setTransientScanning] = useState(new Set());
  const [activeEdges, setActiveEdges]       = useState(new Set());
  const [nodeTelemetry, setNodeTelemetry]   = useState({});
  const [dispatchInfo, setDispatchInfo]     = useState(null);
  const [honestyOpen, setHonestyOpen]       = useState(false);
  const [builderOpen, setBuilderOpen]       = useState(false);
  const [logOpen,     setLogOpen]           = useState(false);
  const [nodeDetail, setNodeDetail]         = useState(null);   // full detail for popup
  const [error, setError]                   = useState("");
  const scanTimer   = useRef(null);
  const vectorTimer = useRef(null);

  const hydrateState = useCallback((payload) => {
    setIsInitialized(Boolean(payload.initialized));
    setIsDone(Boolean(payload.done));
    setNodeStates(payload.node_states || {});
    setNodeTimestamps(payload.node_timestamps || {});
    setEvents(payload.events || []);
    setMetrics(payload.metrics || null);
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all([getGraph(), getScenarioState()])
      .then(([graphPayload, statePayload]) => {
        if (!live) return;
        setGraph(graphPayload);
        hydrateState(statePayload);
        Promise.all(graphPayload.nodes.map((n) => getNodeDetail(n.id)))
          .then((items) => {
            if (!live) return;
            setNodeTelemetry(
              Object.fromEntries(items.map((item) => [item.node_id, item])),
            );
          })
          .catch(() => {});
      })
      .catch((err) => setError(err.message));
    return () => {
      live = false;
      clearTimeout(scanTimer.current);
      clearTimeout(vectorTimer.current);
    };
  }, [hydrateState]);

  /* Open the node popup with full detail */
  const openNodeDetail = useCallback(
    async (nodeId) => {
      setError("");
      try {
        const detail = await getNodeDetail(nodeId);
        setNodeDetail(detail);
      } catch (err) {
        setError(err.message);
      }
    },
    [],
  );

  const flowNodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: "cameraNode",
        position: {
          x: Math.round(node.x * DISPLAY_SCALE.x),
          y: Math.round(node.y * DISPLAY_SCALE.y),
        },
        data: {
          ...node,
          state: displayState(nodeStates[node.id] || "idle", transientScanning.has(node.id)),
          timestamp: nodeTimestamps[node.id],
          edgeLatencyMs: nodeTelemetry[node.id]?.edge_latency_ms,
          onInspect: openNodeDetail,
        },
        draggable: false,
      })),
    [graph.nodes, openNodeDetail, nodeStates, nodeTelemetry, nodeTimestamps, transientScanning],
  );

  const flowEdges = useMemo(
    () =>
      graph.edges.map((edge, i) => {
        const active = activeEdges.has(edgeKey(edge));
        return {
          id: `${edge.source}-${edge.target}-${i}`,
          source: edge.source,
          target: edge.target,
          type: "vectorEdge",
          animated: active,
          data: { active },
          style: {
            stroke: active ? "#22D3EE" : "rgba(130,148,181,0.22)",
            strokeWidth: active ? 2 : 1,
          },
        };
      }),
    [graph.edges, activeEdges],
  );

  async function initialize() {
    setIsBusy(true);
    setError("");
    setDispatchInfo(null);
    setNodeDetail(null);
    setTransientScanning(new Set());
    setActiveEdges(new Set());
    try {
      const payload = await initScenario();
      hydrateState(payload.state);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function step() {
    setIsBusy(true);
    setError("");
    try {
      const payload = await stepScenario();
      setNodeStates(payload.state.node_states || {});
      setNodeTimestamps(payload.state.node_timestamps || {});
      setMetrics(payload.metrics);
      setIsDone(payload.done);
      setEvents((prev) => [...prev, ...(payload.events || [])]);

      setTransientScanning(new Set(payload.scanning || []));
      clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => setTransientScanning(new Set()), 900);

      setActiveEdges(new Set((payload.vector_edges || []).map(edgeKey)));
      clearTimeout(vectorTimer.current);
      vectorTimer.current = setTimeout(() => setActiveEdges(new Set()), 1900);

      if (payload.dispatch_ready && !dispatchInfo) {
        const dpPayload = await dispatchUnit(payload.dispatch_target);
        setDispatchInfo(dpPayload);
        setNodeStates(dpPayload.state.node_states || {});
        setNodeTimestamps(dpPayload.state.node_timestamps || {});
        setEvents((prev) => [...prev, dpPayload.event]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function buildCustomScenario(origin, sightings) {
    setIsBusy(true);
    setError("");
    setBuilderOpen(false);
    setDispatchInfo(null);
    setNodeDetail(null);
    setTransientScanning(new Set());
    setActiveEdges(new Set());
    try {
      const payload = await createCustomScenario(origin, sightings);
      hydrateState(payload.state);
      setLogOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsBusy(false);
    }
  }

  const isStepActive = isInitialized && !isDone;

  /* Space bar → Next Hop */
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const handler = (e) => {
      if (e.code === "Space" && isStepActive && !isBusy && !e.target.closest("button, select, input")) {
        e.preventDefault();
        stepRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isStepActive, isBusy]);

  /* Any overlay open? */
  const anyOverlay = honestyOpen || builderOpen || Boolean(nodeDetail);

  return (
    <>
      {/* ── Status Rail ── */}
      <TopStrip
        metrics={metrics}
        isDone={isDone}
        isLive={isInitialized && !isDone}
        onInfoClick={() => setHonestyOpen(true)}
      />

      {/* ── Graph Stage ── */}
      <div className="graph-stage">
        <KavachStream events={events} />

        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => openNodeDetail(node.id)}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          nodeOrigin={[0.5, 0.5]}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.45}
          maxZoom={1.6}
        >
          <Background color="rgba(34,211,238,0.06)" gap={32} size={1} />
          <MiniMap
            nodeColor={(node) => {
              const s = node.data?.state;
              if (s === "match")                         return "#FF5A5F";
              if (s === "prearmed" || s === "exit_flag") return "#FFB23E";
              if (s === "clear")                         return "#34D399";
              if (s === "scanning")                      return "#22D3EE";
              return "#8294B5";
            }}
            maskColor="rgba(10,14,26,0.75)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* End-freeze verdict */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              className="verdict-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.9 }}
            >
              <div className="verdict-inner">
                <div className="verdict-title">SUSPECT LOCATED</div>
                <div className="verdict-stats">
                  {metrics?.elapsed_s?.toFixed(1)}s &middot; {metrics?.cameras_scanned}/30 CAMERAS
                </div>
                <div className="verdict-vs">Manual sequential: ~9 min</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Control Dock ── */}
      <div className="control-dock">
        <button
          className="dock-btn"
          onClick={() => setBuilderOpen(true)}
          disabled={isBusy}
          title="Custom simulation builder"
        >
          ⚙ Configure
        </button>
        <button className="dock-btn" onClick={initialize} disabled={isBusy}>
          ◦ Initialize
        </button>
        <button
          className={`dock-btn dock-btn-primary${isStepActive && !isBusy ? " pulsing" : ""}`}
          onClick={step}
          disabled={!isStepActive || isBusy}
        >
          ▶ Next Hop
        </button>
        <button className="dock-btn" onClick={initialize} disabled={isBusy}>
          ↺ Reset
        </button>
      </div>

      {/* ── RAKSHAK card ── */}
      <AnimatePresence>
        {dispatchInfo && <DispatchPanel dispatch={dispatchInfo} />}
      </AnimatePresence>

      {/* ── Operation log panel (right side) ── */}
      <EventPanel
        events={events}
        isOpen={logOpen && !anyOverlay}
        onToggle={() => setLogOpen((v) => !v)}
      />

      {/* ══ Overlay layer — node modal, builder, honesty ══ */}
      <AnimatePresence>
        {anyOverlay && (
          <motion.div
            className="honesty-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setNodeDetail(null);
                setHonestyOpen(false);
                setBuilderOpen(false);
              }
            }}
          >
            {/* Node detail popup */}
            {nodeDetail && (
              <NodeModal
                detail={nodeDetail}
                onClose={() => setNodeDetail(null)}
              />
            )}

            {/* Scenario builder */}
            {builderOpen && !nodeDetail && (
              <ScenarioBuilder
                nodes={graph.nodes}
                onSubmit={buildCustomScenario}
                onClose={() => setBuilderOpen(false)}
                isBusy={isBusy}
              />
            )}

            {/* Honesty modal */}
            {honestyOpen && !nodeDetail && !builderOpen && (
              <HonestyPanel onClose={() => setHonestyOpen(false)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error strip ── */}
      {error && <div className="error-strip">{error}</div>}
    </>
  );
}
