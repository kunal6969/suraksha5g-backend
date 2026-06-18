from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import random
from pathlib import Path
from typing import Any

import networkx as nx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent
GRAPH_PATH = BASE_DIR / "station_graph.json"
SCENARIO_PATH = BASE_DIR / "scenario.json"

NODE_SLICE = "SST-1 eMBB + SST-2 URLLC"
ACTIVE_SLICE = "SST-2 URLLC · 5QI 82 · 99.999%"
VIDEO_STATUS = "discarded at edge · 3 KB embedding only"
MEC_STATUS = "edge-local inference (simulated as node service)"


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


STATION_GRAPH = _read_json(GRAPH_PATH)
SCENARIO = _read_json(SCENARIO_PATH)
NODE_BY_ID = {node["id"]: node for node in STATION_GRAPH["nodes"]}

WALK_GRAPH = nx.Graph()
WALK_GRAPH.add_nodes_from(NODE_BY_ID)
WALK_GRAPH.add_edges_from((edge["source"], edge["target"]) for edge in STATION_GRAPH["edges"])


class DispatchRequest(BaseModel):
    confirmed_match_node: str | None = None
    target_node: str | None = None


class CustomScenarioRequest(BaseModel):
    origin: str
    match_nodes: list[str]  # 1..N node IDs


@dataclass
class ConsoleState:
    initialized: bool = False
    start_clock: str = SCENARIO["start_clock"]
    step_index: int = 0
    simulated_elapsed_s: float = 0.0
    node_states: dict[str, str] = field(default_factory=dict)
    node_timestamps: dict[str, str] = field(default_factory=dict)
    scanned: set[str] = field(default_factory=set)
    prearmed_at: dict[str, float] = field(default_factory=dict)
    matches: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    vectors_pushed: int = 0
    dispatched_unit: str | None = None
    flagged_exit: str | None = None


state = ConsoleState()

app = FastAPI(title="SURAKSHA-5G Live Console", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _node_label(node_id: str) -> str:
    if node_id not in NODE_BY_ID:
        raise HTTPException(status_code=404, detail=f"Unknown node: {node_id}")
    return NODE_BY_ID[node_id]["label"]


def _clock_at(elapsed_s: float | None = None) -> str:
    value = state.simulated_elapsed_s if elapsed_s is None else elapsed_s
    hour, minute, second = (int(part) for part in SCENARIO["start_clock"].split(":"))
    total_tenths = int(round((hour * 3600 + minute * 60 + second + value) * 10))
    total_seconds, tenth = divmod(total_tenths, 10)
    total_seconds %= 24 * 3600
    hh = total_seconds // 3600
    mm = (total_seconds % 3600) // 60
    ss = total_seconds % 60
    if tenth:
        return f"{hh:02d}:{mm:02d}:{ss:02d}.{tenth}"
    return f"{hh:02d}:{mm:02d}:{ss:02d}"


def _event(message: str, level: str = "info", node_id: str | None = None) -> dict[str, Any]:
    event = {
        "ts": _clock_at(),
        "elapsed_s": state.simulated_elapsed_s,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "node_id": node_id,
        "message": message,
    }
    state.events.append(event)
    return event


def _seeded_metrics(node_id: str) -> dict[str, Any]:
    if node_id not in NODE_BY_ID:
        raise HTTPException(status_code=404, detail=f"Unknown node: {node_id}")
    seed = int(hashlib.sha256(node_id.encode("utf-8")).hexdigest()[:12], 16)
    rng = random.Random(seed)
    return {
        "node_id": node_id,
        "label": _node_label(node_id),
        "edge_latency_ms": round(rng.uniform(6.0, 11.0), 1),
        "cloud_baseline_ms": rng.randint(52, 98),
        "throughput_mbps": round(rng.uniform(90, 160), 1),
        "jitter_ms": round(rng.uniform(0.2, 0.9), 2),
        "packet_loss_pct": round(rng.uniform(0.0005, 0.0015), 4),
        "reliability_pct": 99.999,
        "slice": NODE_SLICE,
        "fiveqi": 82,
        "persons_in_frame": rng.randint(5, 60),
        "video_status": VIDEO_STATUS,
        "mec_status": MEC_STATUS,
    }


def _global_metrics() -> dict[str, Any]:
    scanned = sorted(state.scanned)
    edge_values = [_seeded_metrics(node)["edge_latency_ms"] for node in scanned]
    cloud_values = [_seeded_metrics(node)["cloud_baseline_ms"] for node in scanned]
    avg_edge = round(sum(edge_values) / len(edge_values), 1) if edge_values else 0
    avg_cloud = round(sum(cloud_values) / len(cloud_values), 1) if cloud_values else 0
    done = state.step_index >= len(SCENARIO["hops"])
    return {
        "clock": _clock_at(),
        "elapsed_s": round(state.simulated_elapsed_s, 1),
        "cameras_scanned": len(state.scanned),
        "total_cameras": len(STATION_GRAPH["nodes"]),
        "avg_edge_latency_ms": avg_edge,
        "avg_cloud_baseline_ms": avg_cloud,
        "active_slice": ACTIVE_SLICE,
        "vectors_pushed_kb": state.vectors_pushed * SCENARIO["suspect_vector_kb"],
        "matches_count": len(state.matches),
        "manual_baseline_seconds": SCENARIO["manual_baseline_seconds"],
        "done": done,
        "status": "SUSPECT LOCATED" if done else "HUNT ACTIVE",
        "flagged_exit": state.flagged_exit,
    }


def _public_state() -> dict[str, Any]:
    return {
        "initialized": state.initialized,
        "origin": SCENARIO["origin"],
        "start_clock": state.start_clock,
        "current_step": state.step_index,
        "done": state.step_index >= len(SCENARIO["hops"]),
        "node_states": state.node_states,
        "node_timestamps": state.node_timestamps,
        "matches": state.matches,
        "events": state.events,
        "metrics": _global_metrics(),
        "dispatched_unit": state.dispatched_unit,
        "flagged_exit": state.flagged_exit,
    }


def _set_node_state(node_id: str, status: str) -> None:
    state.node_states[node_id] = status
    state.node_timestamps[node_id] = _clock_at()


def _reset_state() -> list[dict[str, Any]]:
    state.initialized = True
    state.start_clock = SCENARIO["start_clock"]
    state.step_index = 0
    state.simulated_elapsed_s = 0.0
    state.node_states = {node["id"]: "idle" for node in STATION_GRAPH["nodes"]}
    state.node_timestamps = {}
    state.scanned = set()
    state.prearmed_at = {}
    state.matches = []
    state.events = []
    state.vectors_pushed = 0
    state.dispatched_unit = None
    state.flagged_exit = None
    _set_node_state(SCENARIO["origin"], "scanning")
    return [
        _event(
            f"Missing-child search initialized at {_node_label(SCENARIO['origin'])}; 3 KB face vector loaded.",
            level="system",
            node_id=SCENARIO["origin"],
        )
    ]


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "SURAKSHA-5G Live Console", "status": "ready"}


@app.get("/graph")
def get_graph() -> dict[str, Any]:
    return STATION_GRAPH


@app.post("/scenario/init")
def scenario_init() -> dict[str, Any]:
    events = _reset_state()
    return {
        "origin": SCENARIO["origin"],
        "start_clock": state.start_clock,
        "events": events,
        "state": _public_state(),
    }


@app.post("/scenario/step")
def scenario_step() -> dict[str, Any]:
    if not state.initialized:
        _reset_state()
    if state.step_index >= len(SCENARIO["hops"]):
        return {
            "done": True,
            "scanning": [],
            "prearmed": [],
            "matches": [],
            "clear": [],
            "exit_flags": [],
            "events": [],
            "vector_edges": [],
            "metrics": _global_metrics(),
            "state": _public_state(),
        }

    hop = SCENARIO["hops"][state.step_index]
    state.simulated_elapsed_s = float(hop["elapsed_s"])
    new_events: list[dict[str, Any]] = []

    scanning = list(hop["scan"])
    prearmed = list(hop["prearmed"])
    match_ids = list(hop["match"])
    exit_flags = list(hop["exit_flag"])
    clear = [node for node in scanning if node not in match_ids and node not in exit_flags]

    for node_id in scanning:
        _node_label(node_id)
        state.scanned.add(node_id)

    for node_id in clear:
        _set_node_state(node_id, "clear")

    matches: list[dict[str, Any]] = []
    for node_id in match_ids:
        _node_label(node_id)
        was_prearmed = node_id in state.prearmed_at
        _set_node_state(node_id, "match")
        match = {
            "node_id": node_id,
            "label": _node_label(node_id),
            "ts": _clock_at(),
            "elapsed_s": state.simulated_elapsed_s,
            "was_prearmed": was_prearmed,
        }
        if not any(existing["node_id"] == node_id for existing in state.matches):
            state.matches.append(match)
        matches.append(match)
        if was_prearmed:
            seconds = round(state.simulated_elapsed_s - state.prearmed_at[node_id], 1)
            new_events.append(
                _event(
                    f"MATCH @ {_node_label(node_id)} — node was PRE-ARMED {seconds}s earlier, vector waiting before target arrived.",
                    level="match",
                    node_id=node_id,
                )
            )
        else:
            new_events.append(
                _event(
                    f"MATCH @ {_node_label(node_id)} — cold edge match, no predictive pre-arm available.",
                    level="match",
                    node_id=node_id,
                )
            )

    for node_id in exit_flags:
        _node_label(node_id)
        state.flagged_exit = node_id
        _set_node_state(node_id, "exit_flag")
        new_events.append(
            _event(
                f"EXIT FLAG @ {_node_label(node_id)} — predicted egress confirmed.",
                level="alert",
                node_id=node_id,
            )
        )
        new_events.append(
            _event(
                "📡 CBS alert issued · geo-fence 500 m · 5QI 82",
                level="alert",
                node_id=node_id,
            )
        )

    for node_id in prearmed:
        _node_label(node_id)
        if node_id not in state.prearmed_at:
            state.prearmed_at[node_id] = state.simulated_elapsed_s
            state.vectors_pushed += 1
            new_events.append(
                _event(
                    f"PRE-ARM @ {_node_label(node_id)} — 3 KB vector staged on edge MEC.",
                    level="prearm",
                    node_id=node_id,
                )
            )
        if state.node_states.get(node_id) not in {"match", "exit_flag", "clear", "dispatched"}:
            _set_node_state(node_id, "prearmed")

    for message in hop.get("events", []):
        new_events.append(_event(message, level="info"))

    state.step_index += 1
    done = state.step_index >= len(SCENARIO["hops"])

    latest_match_node = matches[-1]["node_id"] if matches else (state.matches[-1]["node_id"] if state.matches else None)
    return {
        "hop": {"id": hop["id"], "label": hop["label"], "elapsed_s": hop["elapsed_s"]},
        "scanning": scanning,
        "prearmed": prearmed,
        "matches": matches,
        "clear": clear,
        "exit_flags": exit_flags,
        "events": new_events,
        "vector_edges": hop.get("vector_edges", []),
        "metrics": _global_metrics(),
        "done": done,
        "dispatch_ready": len(state.matches) >= 2,
        "dispatch_target": latest_match_node,
        "flagged_exit": state.flagged_exit or "EXIT_AG",
        "state": _public_state(),
    }


@app.get("/scenario/state")
def scenario_state() -> dict[str, Any]:
    return _public_state()


@app.get("/node/{node_id}/metrics")
def node_metrics(node_id: str) -> dict[str, Any]:
    return _seeded_metrics(node_id)


@app.post("/dispatch")
def dispatch(request: DispatchRequest) -> dict[str, Any]:
    target = request.confirmed_match_node or request.target_node
    if target is None:
        target = state.matches[-1]["node_id"] if state.matches else "PF_8_9"
    if target not in WALK_GRAPH:
        raise HTTPException(status_code=404, detail=f"Unknown dispatch target: {target}")

    weights = {"hop_distance": 1.0, "fatigue": 2.0, "specialization": 1.35}
    units = [
        {
            "id": "R-17",
            "name": "RPF QRT Alpha",
            "home_zone": "RPF_POST",
            "type": "rapid_response",
            "fatigue": 0.18,
            "specialization": 0.82,
        },
        {
            "id": "A-04",
            "name": "Ajmeri Gate Bravo",
            "home_zone": "AJMERI_ENTRY",
            "type": "exit_intercept",
            "fatigue": 0.34,
            "specialization": 0.74,
        },
        {
            "id": "P-22",
            "name": "Platform Patrol Charlie",
            "home_zone": "PF_3_4",
            "type": "platform_patrol",
            "fatigue": 0.08,
            "specialization": 0.62,
        },
    ]

    evaluated = []
    for unit in units:
        path = nx.shortest_path(WALK_GRAPH, source=unit["home_zone"], target=target)
        hop_distance = len(path) - 1
        cost_parts = {
            "hop_distance": round(weights["hop_distance"] * hop_distance, 3),
            "fatigue": round(weights["fatigue"] * unit["fatigue"], 3),
            "specialization_credit": round(-weights["specialization"] * unit["specialization"], 3),
        }
        cost = sum(cost_parts.values())
        evaluated.append(
            {
                **unit,
                "home_label": _node_label(unit["home_zone"]),
                "target_node": target,
                "target_label": _node_label(target),
                "path": path,
                "hop_distance": hop_distance,
                "eta_s": hop_distance * 8,
                "cost": round(cost, 3),
                "cost_breakdown": cost_parts,
            }
        )

    chosen = min(evaluated, key=lambda unit: unit["cost"])
    state.dispatched_unit = chosen["id"]
    if state.node_states.get(chosen["home_zone"]) not in {"match", "exit_flag"}:
        _set_node_state(chosen["home_zone"], "dispatched")
    event = _event(
        f"RAKSHAK dispatched {chosen['name']} to {_node_label(target)}; ETA {chosen['eta_s']}s via {chosen['hop_distance']} hops.",
        level="dispatch",
        node_id=chosen["home_zone"],
    )

    return {
        "target": {"id": target, "label": _node_label(target)},
        "flagged_exit": {"id": "EXIT_AG", "label": _node_label("EXIT_AG")},
        "weights": weights,
        "chosen": chosen,
        "units": evaluated,
        "event": event,
        "state": _public_state(),
    }


# ── Node detail ────────────────────────────────────────────────────────────────

@app.get("/node/{node_id}/detail")
def node_detail(node_id: str) -> dict[str, Any]:
    if node_id not in NODE_BY_ID:
        raise HTTPException(status_code=404, detail=f"Unknown node: {node_id}")
    node = NODE_BY_ID[node_id]
    neighbors = [
        {
            "id": n,
            "label": NODE_BY_ID[n]["label"],
            "type": NODE_BY_ID[n]["type"],
            "state": state.node_states.get(n, "idle"),
        }
        for n in WALK_GRAPH.neighbors(node_id)
    ]
    metrics = _seeded_metrics(node_id)
    prearmed_elapsed = state.prearmed_at.get(node_id)
    current_state = state.node_states.get(node_id, "idle")
    match_info = next((m for m in state.matches if m["node_id"] == node_id), None)
    state_ts = state.node_timestamps.get(node_id)

    # seconds the node was pre-armed before the match (if applicable)
    prearmed_lead_s: float | None = None
    if match_info and prearmed_elapsed is not None:
        prearmed_lead_s = round(match_info["elapsed_s"] - prearmed_elapsed, 1)

    return {
        **metrics,
        "type": node["type"],
        "x": node.get("x"),
        "y": node.get("y"),
        "current_state": current_state,
        "state_timestamp": state_ts,
        "prearmed_at_elapsed": prearmed_elapsed,
        "prearmed_lead_s": prearmed_lead_s,
        "match_info": match_info,
        "neighbors": neighbors,
        "neighbor_count": len(neighbors),
    }


# ── Custom scenario builder ────────────────────────────────────────────────────

def _generate_custom_scenario(origin: str, match_nodes: list[str]) -> dict[str, Any]:
    """Build a playable hop sequence for N match nodes with predictive pre-arming."""
    hops: list[dict[str, Any]] = []
    elapsed = 0.6
    globally_scanned: set[str] = set()

    def _scan_around(node: str, exclude: set[str], limit: int = 3) -> list[str]:
        nbrs = [n for n in WALK_GRAPH.neighbors(node) if n not in exclude]
        return [node] + nbrs[:limit]

    # ── Hop 1: origin area sweep ───────────────────────────────────────────────
    h1 = _scan_around(origin, globally_scanned)
    globally_scanned.update(h1)
    hops.append({
        "id": 1,
        "label": f"Initial sweep · {NODE_BY_ID[origin]['label']}",
        "elapsed_s": elapsed,
        "scan": h1,
        "prearmed": [],
        "match": [],
        "exit_flag": [],
        "vector_edges": [],
        "events": ["Parallel perimeter sweep from origin; no match."],
    })
    elapsed += 0.6

    # ── Hop 2: advance to midpoint, PRE-ARM all match nodes ───────────────────
    try:
        path0 = nx.shortest_path(WALK_GRAPH, origin, match_nodes[0])
    except nx.NetworkXNoPath:
        path0 = [origin]
    mid = path0[max(1, len(path0) // 2)] if len(path0) > 2 else origin

    h2 = [n for n in _scan_around(mid, globally_scanned) if n not in match_nodes]
    globally_scanned.update(h2)

    prearm_all = match_nodes[:]
    vec_h2 = [{"source": mid, "target": match_nodes[0]}]
    for i in range(len(match_nodes) - 1):
        vec_h2.append({"source": match_nodes[i], "target": match_nodes[i + 1]})

    hops.append({
        "id": 2,
        "label": "Predictive forward analysis",
        "elapsed_s": elapsed,
        "scan": h2 or [mid],
        "prearmed": prearm_all,
        "match": [],
        "exit_flag": [],
        "vector_edges": vec_h2[:4],
        "events": [
            f"Path analysis complete. PRE-ARM: "
            f"{' · '.join(NODE_BY_ID[n]['label'] for n in prearm_all)} "
            f"— 3 KB face embedding staged on edge MEC ahead of arrival."
        ],
    })
    elapsed += 0.6

    # ── Hops 3..N+2: MATCH at each node ───────────────────────────────────────
    exit_ids = [n for n, d in NODE_BY_ID.items() if d["type"] == "exit"]

    def _nearest_exit(from_node: str) -> str | None:
        reachable = [e for e in exit_ids if nx.has_path(WALK_GRAPH, from_node, e)]
        if not reachable:
            return None
        return min(reachable, key=lambda e: nx.shortest_path_length(WALK_GRAPH, from_node, e))

    for idx, mn in enumerate(match_nodes):
        is_last = idx == len(match_nodes) - 1
        h_scan = _scan_around(mn, globally_scanned | set(match_nodes[idx + 1:]), limit=2)
        globally_scanned.update(h_scan)

        prearm_h: list[str] = []
        vec_h: list[dict] = []
        events_h: list[str] = []

        if is_last:
            ne = _nearest_exit(mn)
            if ne:
                prearm_h = [ne]
                vec_h = [{"source": mn, "target": ne}]
                events_h.append("Predicted egress pre-armed.")

        ordinal = ["First", "Second", "Third", "Fourth", "Fifth",
                   "Sixth", "Seventh", "Eighth"][min(idx, 7)]
        events_h.insert(0, f"{ordinal} sighting confirmed.")

        hops.append({
            "id": idx + 3,
            "label": f"MATCH · {NODE_BY_ID[mn]['label']}",
            "elapsed_s": elapsed,
            "scan": h_scan,
            "prearmed": prearm_h,
            "match": [mn],
            "exit_flag": [],
            "vector_edges": vec_h,
            "events": events_h,
        })
        elapsed += 0.6

    # ── Final hop: EXIT FLAG ───────────────────────────────────────────────────
    ne = _nearest_exit(match_nodes[-1])
    if ne:
        hops.append({
            "id": len(hops) + 1,
            "label": f"Predicted egress · {NODE_BY_ID[ne]['label']}",
            "elapsed_s": elapsed,
            "scan": [ne],
            "prearmed": [],
            "match": [],
            "exit_flag": [ne],
            "vector_edges": [],
            "events": ["📡 CBS alert issued · geo-fence 500 m · 5QI 82"],
        })

    return {
        "origin": origin,
        "suspect_vector_kb": 3,
        "manual_baseline_seconds": 540,
        "start_clock": "14:22:30",
        "hops": hops,
    }


@app.post("/scenario/custom")
def scenario_custom(req: CustomScenarioRequest) -> dict[str, Any]:
    global SCENARIO

    if not req.match_nodes:
        raise HTTPException(status_code=400, detail="Provide at least one sighting.")

    for nid in [req.origin] + req.match_nodes:
        if nid not in NODE_BY_ID:
            raise HTTPException(status_code=400, detail=f"Unknown node: {nid}")

    if req.origin in req.match_nodes:
        raise HTTPException(status_code=400, detail="Origin cannot be a match node.")

    if len(set(req.match_nodes)) != len(req.match_nodes):
        raise HTTPException(status_code=400, detail="Duplicate match nodes are not allowed.")

    for mn in req.match_nodes:
        if not nx.has_path(WALK_GRAPH, req.origin, mn):
            raise HTTPException(
                status_code=400,
                detail=f"No graph path from {req.origin} to {mn}.",
            )

    SCENARIO = _generate_custom_scenario(req.origin, req.match_nodes)
    events = _reset_state()
    return {
        "origin": req.origin,
        "start_clock": state.start_clock,
        "generated_hops": len(SCENARIO["hops"]),
        "events": events,
        "state": _public_state(),
    }
