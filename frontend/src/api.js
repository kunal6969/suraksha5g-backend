const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  return response.json();
}

export function getGraph() {
  return request("/graph");
}

export function initScenario() {
  return request("/scenario/init", { method: "POST" });
}

export function stepScenario() {
  return request("/scenario/step", { method: "POST" });
}

export function getScenarioState() {
  return request("/scenario/state");
}

export function getNodeMetrics(nodeId) {
  return request(`/node/${nodeId}/metrics`);
}

export function dispatchUnit(confirmedMatchNode = "PF_8_9") {
  return request("/dispatch", {
    method: "POST",
    body: JSON.stringify({ confirmed_match_node: confirmedMatchNode }),
  });
}

export function getNodeDetail(nodeId) {
  return request(`/node/${nodeId}/detail`);
}

export function createCustomScenario(origin, matchNodes) {
  return request("/scenario/custom", {
    method: "POST",
    body: JSON.stringify({ origin, match_nodes: matchNodes }),
  });
}
