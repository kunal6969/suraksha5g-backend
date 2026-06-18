# SURAKSHA-5G Live Console Context

This file is a handoff for any AI or developer reading the repository.

## Project Vision

SURAKSHA-5G is a hackathon prototype for a predictive, 5G-native, edge-compute CCTV dragnet inside New Delhi Railway Station.

Core pitch:

> We do not search for the target. We predict where they are going, and the camera is already armed and waiting when they arrive.

The demo intentionally avoids real ML, webcams, raw video, databases, and cloud-heavy processing. All detections are deterministic and scripted. Raw video is represented as discarded at the edge; only a tiny 3 KB face embedding/vector is pushed to likely future CCTV nodes.

## Architecture

- Backend: FastAPI in `backend/app/main.py`
- Graph traversal: NetworkX over `backend/app/station_graph.json`
- Scenario data: `backend/app/scenario.json`
- Frontend: Vite + React + React Flow in `frontend/src`
- State: in-memory single-user demo state, refresh-safe through `GET /scenario/state`
- Storage: no database, no localStorage
- ML: no ML libraries, no webcam/camera permissions

## Data Files

`backend/app/station_graph.json`

- 30 CCTV zones across New Delhi Railway Station.
- Paharganj side is left, platforms are center, Ajmeri side is right.
- Includes entries, exits, security, baggage scan, ticket hall, concourses, waiting/amenity zones, three FOBs, platform groups, parking, bus link, and Ajmeri Gate egress.
- Edges are realistic walkable connections and are used by NetworkX for shortest paths.

`backend/app/scenario.json`

- Deterministic missing-child hunt.
- `origin`: `PE` / Paharganj Entry
- `manual_baseline_seconds`: `540`
- `start_clock`: `14:22:30`
- Hop cadence: about `0.6s` per hop.
- Critical story:
  - Hop 1 scans Paharganj exits, metro, parking, no match.
  - Hop 2 scans concourse and pre-arms `FOB_1`, `FOB_2`.
  - Hop 3 matches at `FOB_2`, which was already pre-armed.
  - Hop 3 also pre-arms `PF_8_9` and `AG_CONCOURSE`.
  - Hop 4 matches at `PF_8_9`, also pre-armed.
  - Hop 5 flags `EXIT_AG`, emits the CBS alert, and pre-arms onward exit branches.

The most important demo proof is the event line:

```text
MATCH @ <label> — node was PRE-ARMED <X>s earlier, vector waiting before target arrived.
```

## Backend Endpoints

- `GET /graph`
  - Returns the 30 station nodes and walkable edges from JSON.
- `POST /scenario/init`
  - Resets in-memory state.
  - Returns `origin` and fixed simulated `start_clock` of `14:22:30`.
- `POST /scenario/step`
  - Advances exactly one scenario hop.
  - Returns `scanning`, `prearmed`, `matches`, `events`, `metrics`, `done`, `state`.
  - Emits pre-armed match lines for `FOB_2` and `PF_8_9`.
  - Emits `📡 CBS alert issued · geo-fence 500 m · 5QI 82` when `EXIT_AG` flags.
- `GET /node/{id}/metrics`
  - Returns stable seeded simulated telemetry:
    - edge latency, cloud baseline, throughput, jitter, packet loss, reliability, slice, 5QI, persons in frame, video status, MEC status.
- `POST /dispatch`
  - Accepts `confirmed_match_node`.
  - Evaluates 3 mock RAKSHAK units with NetworkX shortest paths.
  - Cost formula: `w1*hop_distance + w2*fatigue - w3*specialization`.
  - ETA: `hop_distance * 8s`.
- `GET /scenario/state`
  - Returns full current state for refresh safety.

## Frontend Structure

Important files:

- `frontend/src/App.jsx`
  - Loads graph/state, handles init/step/reset, dispatch call, edge vector animation, node telemetry fetch.
- `frontend/src/components/CameraNode.jsx`
  - Custom React Flow node with status, timestamp, and latency tag.
- `frontend/src/components/KavachStream.jsx`
  - Left event log.
- `frontend/src/components/TelemetryDrawer.jsx`
  - Node 5G telemetry overlay.
- `frontend/src/components/TopStrip.jsx`
  - Sticky global metrics and final freeze state.
- `frontend/src/components/DispatchPanel.jsx`
  - Bottom-right RAKSHAK decision card.
- `frontend/src/components/HonestyPanel.jsx`
  - Collapsible Real vs Simulated table.
- `frontend/src/components/VectorEdge.jsx`
  - Animated `→ 3 KB vector` edge label.
- `frontend/src/styles.css`
  - Dark control-room theme, node states, overlays, layout.

## Node Visual States

- `idle`: grey baseline.
- `scanning`: blue pulse, transient per hop.
- `prearmed`: amber outline only, never filled. This is the key predictive proof state.
- `clear`: green with check and timestamp.
- `match`: red pulse with warning and timestamp.
- `exit_flag`: solid amber, used for `EXIT_AG`.
- `dispatched`: amber ring, used for the chosen RAKSHAK unit home zone.

## Current Verification

Backend smoke test passed:

- `/graph` returns 30 nodes and 51 edges.
- `/scenario/init` returns `14:22:30`.
- Hop 2 pre-arms `FOB_1`, `FOB_2`.
- Hop 3 returns match at `FOB_2` with the required PRE-ARMED line.
- Hop 4 returns match at `PF_8_9` with the required PRE-ARMED line.
- Hop 5 returns CBS alert and `EXIT_AG` flag.
- `/node/FOB_2/metrics` returns stable simulated telemetry.
- `/dispatch` computes real NetworkX shortest-path costs and chooses a unit.

Frontend verification:

- `npm run build` passes.
- `npm audit --json` reports zero vulnerabilities.
- The browser sees all 30 `.camera-node` elements.
- Previous issue: nodes originally looked invisible because React Flow fit the full wide topology into a narrow middle column, shrinking cards to tiny thumbnails.
- Fix applied: map gets the main screen real estate, station coordinates are display-scaled in `App.jsx`, and node cards now render around 133x89 px in the browser check.

Known caveat:

- In one in-app-browser hit-test, `document.elementFromPoint()` still reported the surrounding `map-panel` instead of the transformed React Flow node, even though all 30 nodes were present and visibly sized. Keyboard/focus activation had worked earlier. If node click feels unreliable in a real browser, inspect React Flow pointer layering in `styles.css` and `CameraNode.jsx`.

## Run Commands

Backend:

```powershell
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev -- --port 5173 --strictPort
```

Open:

```text
http://127.0.0.1:5173
```

## Graphify

Graphify is project-installed under `.codex/skills/graphify`, with hooks in `.codex/hooks.json` and instructions in `AGENTS.md`.

Last local update in this session:

- `graphify update .` succeeded for the AST/code graph.
- The semantic docs pass then succeeded with Gemini using `gemini-2.5-flash`.
- Final observed Graphify graph after semantic extraction and reclustering: `209 nodes`, `262 edges`, `26 communities`.
- `graphify-out/graph.json`, `graphify-out/graph.html`, and `graphify-out/GRAPH_REPORT.md` were updated.
- Semantic extraction usage reported across successful Gemini update passes: initial pass `20,420` input / `14,048` output tokens, estimated cost about `$0.0524`; larger retry `13,034` input / `22,051` output tokens, estimated cost about `$0.0727`; final one-file context refresh `2,736` input / `8,299` output tokens, estimated cost about `$0.0263`.

After code changes, run:

```powershell
graphify update .
```

If `graphify` is not on PATH in the current shell:

```powershell
$env:PATH = "C:\Users\Kunal\.local\bin;$env:PATH"
graphify update .
```
