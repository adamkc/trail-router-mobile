/**
 * Trail-network graph utilities.
 *
 * Treats every vertex of every library route as a graph node. Adjacent
 * vertices on the same route are connected by an edge weighted with the
 * Haversine distance between them. Vertices on *different* routes that
 * land within `JUNCTION_M` of each other (default 25 m) get connected by
 * a zero-cost edge — this is how the planner can hop from one trail to
 * the next at real-world junctions without any explicit junction data.
 *
 * Once the graph is built, `findPath()` runs Dijkstra to return the
 * stitched [lng, lat] polyline plus its length in km. `nearestNode()`
 * snaps an arbitrary tap location to the closest graph node so the UI
 * can drive routing from raw map taps.
 */

import { haversineKm } from '../store/recording';
import type { LibraryRoute } from '../store/library';

export const JUNCTION_M = 25;

export interface NetworkNode {
  id: string;                         // `r{routeIdx}v{vertexIdx}`
  coord: [number, number];
  routeIdx: number;
  vertexIdx: number;
}

export interface NetworkEdge {
  to: string;
  km: number;
}

export interface NetworkGraph {
  nodes: Map<string, NetworkNode>;
  adj: Map<string, NetworkEdge[]>;
  /** Auto-detected junction node ids (subset of `nodes`). Either side of
   *  a cross-route adjacency lands here, so the UI can render markers. */
  junctions: Set<string>;
}

/** Coarse lng×lat bucket key for spatial neighbor lookups. ~55 m cells. */
const BUCKET_SIZE = 0.0005;
const bucketKey = (lng: number, lat: number) =>
  `${Math.floor(lng / BUCKET_SIZE)}:${Math.floor(lat / BUCKET_SIZE)}`;

/** Build the trail-network graph from a list of library routes. */
export function buildNetwork(
  routes: LibraryRoute[],
  junctionThresholdM = JUNCTION_M,
): NetworkGraph {
  const nodes = new Map<string, NetworkNode>();
  const adj = new Map<string, NetworkEdge[]>();
  const junctions = new Set<string>();

  // 1. Materialize one node per vertex.
  for (let r = 0; r < routes.length; r++) {
    const route = routes[r];
    for (let v = 0; v < route.geo.length; v++) {
      const id = `r${r}v${v}`;
      nodes.set(id, { id, coord: route.geo[v], routeIdx: r, vertexIdx: v });
      adj.set(id, []);
    }
  }

  // 2. Intra-route edges (consecutive vertices on the same trail).
  for (let r = 0; r < routes.length; r++) {
    const route = routes[r];
    for (let v = 0; v < route.geo.length - 1; v++) {
      const a = `r${r}v${v}`;
      const b = `r${r}v${v + 1}`;
      const km = haversineKm(route.geo[v], route.geo[v + 1]);
      adj.get(a)!.push({ to: b, km });
      adj.get(b)!.push({ to: a, km });
    }
  }

  // 3. Spatial bucket for inter-route junction detection.
  const buckets = new Map<string, NetworkNode[]>();
  for (const n of nodes.values()) {
    const k = bucketKey(n.coord[0], n.coord[1]);
    const arr = buckets.get(k);
    if (arr) arr.push(n);
    else buckets.set(k, [n]);
  }

  // 4. For each node, scan the 3×3 bucket neighborhood for vertices on
  //    other routes within the junction threshold; bridge with zero-km
  //    edges. Use sorted-id dedupe so we add each pair at most once.
  const seen = new Set<string>();
  for (const n of nodes.values()) {
    const bx = Math.floor(n.coord[0] / BUCKET_SIZE);
    const by = Math.floor(n.coord[1] / BUCKET_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = buckets.get(`${bx + dx}:${by + dy}`);
        if (!list) continue;
        for (const m of list) {
          if (m.routeIdx === n.routeIdx) continue;
          if (m.id <= n.id) continue;
          const pairKey = `${n.id}|${m.id}`;
          if (seen.has(pairKey)) continue;
          const distM = haversineKm(n.coord, m.coord) * 1000;
          if (distM <= junctionThresholdM) {
            seen.add(pairKey);
            adj.get(n.id)!.push({ to: m.id, km: 0 });
            adj.get(m.id)!.push({ to: n.id, km: 0 });
            junctions.add(n.id);
            junctions.add(m.id);
          }
        }
      }
    }
  }

  return { nodes, adj, junctions };
}

/**
 * Snap a free [lng, lat] point to its nearest graph node. Returns null if
 * nothing is within `maxDistM` (avoids wild taps far off the network).
 */
export function nearestNode(
  net: NetworkGraph,
  coord: [number, number],
  maxDistM = 200,
): { id: string; node: NetworkNode; distM: number } | null {
  const bx = Math.floor(coord[0] / BUCKET_SIZE);
  const by = Math.floor(coord[1] / BUCKET_SIZE);
  // Two-stage scan: try the immediate 3×3 neighborhood first (covers the
  // common case of taps near the network); fall back to a full scan only
  // when nothing close is found.
  let bestId = '';
  let bestNode: NetworkNode | null = null;
  let bestDist = Infinity;
  const consider = (n: NetworkNode) => {
    const d = haversineKm(coord, n.coord) * 1000;
    if (d < bestDist) {
      bestDist = d;
      bestId = n.id;
      bestNode = n;
    }
  };
  // Bucket lookup needs the same buckets buildNetwork built — recompute
  // locally so this function stays a pure utility on (graph, coord).
  for (const n of net.nodes.values()) consider(n);
  if (!bestNode || bestDist > maxDistM) return null;
  return { id: bestId, node: bestNode, distM: bestDist };
}

/**
 * Project a tap onto the *nearest segment* of any library route — not just
 * the nearest vertex. Returns the closest [lng, lat] point on the route's
 * polyline (which may lie between vertices) plus the distance in metres.
 *
 * Used by PLOT mode so dragging your finger near a trail snaps cleanly
 * onto the path — the JCT-only snap was vertex-only, which jumped in
 * coarse steps along sparsely-sampled trails.
 */
export function snapToNearestSegment(
  routes: LibraryRoute[],
  coord: [number, number],
  maxDistM = 30,
): { coord: [number, number]; distM: number; routeIdx: number; segmentIdx: number } | null {
  let best: {
    coord: [number, number]; distM: number; routeIdx: number; segmentIdx: number;
  } | null = null;
  for (let r = 0; r < routes.length; r++) {
    const route = routes[r];
    for (let i = 0; i < route.geo.length - 1; i++) {
      const proj = projectPointOnSegment(coord, route.geo[i], route.geo[i + 1]);
      const distM = haversineKm(coord, proj) * 1000;
      if (distM > maxDistM) continue;
      if (!best || distM < best.distM) {
        best = { coord: proj, distM, routeIdx: r, segmentIdx: i };
      }
    }
  }
  return best;
}

/** Project a point onto the line segment a–b in lng/lat space (planar
 *  approximation; fine at trail scale where segments are <1 km). */
function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): [number, number] {
  const ax = a[0], ay = a[1];
  const bx = b[0], by = b[1];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return [ax, ay];
  let t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return [ax + t * dx, ay + t * dy];
}

/**
 * Dijkstra shortest-path between two graph nodes by total km. Returns the
 * stitched polyline + cumulative distance, or null if no path exists.
 *
 * The `routes` arg is the same array used to build the graph; we use it
 * to look up the per-vertex coords (cheaper than threading through the
 * NetworkNode record in the path queue).
 */
export function findPath(
  net: NetworkGraph,
  routes: LibraryRoute[],
  fromId: string,
  toId: string,
): { coords: Array<[number, number]>; elevations: number[]; km: number; nodeIds: string[] } | null {
  if (!net.nodes.has(fromId) || !net.nodes.has(toId)) return null;
  if (fromId === toId) {
    const n = net.nodes.get(fromId)!;
    return { coords: [n.coord], elevations: [], km: 0, nodeIds: [fromId] };
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  dist.set(fromId, 0);

  // Naïve priority queue — a sorted array. For ~1500-node graphs the
  // overhead is negligible compared to threading in a real heap.
  const queue: Array<{ id: string; d: number }> = [{ id: fromId, d: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d);
    const { id: u, d: du } = queue.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === toId) break;
    const neighbors = net.adj.get(u);
    if (!neighbors) continue;
    for (const { to, km } of neighbors) {
      if (visited.has(to)) continue;
      const alt = du + km;
      const cur = dist.get(to);
      if (cur === undefined || alt < cur) {
        dist.set(to, alt);
        prev.set(to, u);
        queue.push({ id: to, d: alt });
      }
    }
  }

  if (!prev.has(toId)) return null;

  // Walk prev chain back to start.
  const nodeIds: string[] = [];
  let cur: string | undefined = toId;
  while (cur) {
    nodeIds.unshift(cur);
    cur = prev.get(cur);
  }

  // Materialize coords + elevations along the path. Junction hops (a node
  // change with no positional movement) collapse — drop the duplicate.
  const coords: Array<[number, number]> = [];
  const elevations: number[] = [];
  let lastCoord: [number, number] | null = null;
  for (const id of nodeIds) {
    const n = net.nodes.get(id)!;
    if (lastCoord && lastCoord[0] === n.coord[0] && lastCoord[1] === n.coord[1]) continue;
    coords.push(n.coord);
    const ev = routes[n.routeIdx]?.elevations?.[n.vertexIdx];
    if (typeof ev === 'number') elevations.push(ev);
    lastCoord = n.coord;
  }

  return {
    coords,
    elevations: elevations.length === coords.length ? elevations : [],
    km: dist.get(toId) ?? 0,
    nodeIds,
  };
}
