import type { ZoneId, GateId, FloorId, Gate, ZoneConfig, Vector2D } from '@/domain';
import { distance } from '../utils/math';

// ---- Zone Graph: adjacency via gates ----
export interface ZoneNode {
  readonly zoneId: ZoneId;
  readonly gates: readonly Gate[];
  readonly center: Vector2D;
}

export interface ZoneEdge {
  readonly fromZoneId: ZoneId;
  readonly toZoneId: ZoneId;
  readonly fromGateId: GateId;
  readonly toGateId: GateId;
  readonly isPortal: boolean; // inter-floor
  readonly targetFloorId: FloorId | null;
  readonly cost: number;
}

export class ZoneGraph {
  private nodes = new Map<string, ZoneNode>();
  private edges = new Map<string, ZoneEdge[]>(); // keyed by fromZoneId
  private gateToZone = new Map<string, ZoneId>();

  buildFromZones(zones: readonly ZoneConfig[]) {
    this.nodes.clear();
    this.edges.clear();
    this.gateToZone.clear();

    // Index zones and gates
    for (const zone of zones) {
      const center: Vector2D = {
        x: zone.bounds.x + zone.bounds.w / 2,
        y: zone.bounds.y + zone.bounds.h / 2,
      };
      this.nodes.set(zone.id as string, { zoneId: zone.id, gates: zone.gates, center });

      for (const gate of zone.gates) {
        this.gateToZone.set(gate.id as string, zone.id);
      }
    }

    // Build edges from gate connections
    for (const zone of zones) {
      const edgesForZone: ZoneEdge[] = [];

      for (const gate of zone.gates) {
        if (gate.type === 'portal' && gate.targetFloorId && gate.targetGateId) {
          const targetZoneId = this.gateToZone.get(gate.targetGateId as string);
          if (targetZoneId) {
            edgesForZone.push({
              fromZoneId: zone.id, toZoneId: targetZoneId,
              fromGateId: gate.id, toGateId: gate.targetGateId,
              isPortal: true, targetFloorId: gate.targetFloorId, cost: 50,
            });
          }
        } else if (gate.connectedGateId) {
          const targetZoneId = this.gateToZone.get(gate.connectedGateId as string);
          if (targetZoneId) {
            const targetNode = this.nodes.get(targetZoneId as string);
            const thisNode = this.nodes.get(zone.id as string);
            const cost = thisNode && targetNode ? distance(thisNode.center, targetNode.center) : 100;
            edgesForZone.push({
              fromZoneId: zone.id, toZoneId: targetZoneId,
              fromGateId: gate.id, toGateId: gate.connectedGateId,
              isPortal: false, targetFloorId: null, cost,
            });
          }
        }
      }

      this.edges.set(zone.id as string, edgesForZone);
    }

    // ── Bidirectional: ensure reverse edges exist ──
    // If zone A→B edge exists via gate connection, create B→A if missing.
    // This handles bidirectional gates that only have one-way connectedGateId.
    for (const [zoneIdStr, edges] of this.edges) {
      for (const edge of edges) {
        if (edge.isPortal) continue;
        const reverseEdges = this.edges.get(edge.toZoneId as string) ?? [];
        const hasReverse = reverseEdges.some((e) => (e.toZoneId as string) === zoneIdStr);
        if (!hasReverse) {
          // Find the target zone's gate that connects back
          const targetNode = this.nodes.get(edge.toZoneId as string);
          const fromGate = targetNode?.gates.find((g) =>
            g.type === 'bidirectional' || g.type === 'exit' || (g.connectedGateId as string) === (edge.fromGateId as string)
          );
          if (fromGate) {
            reverseEdges.push({
              fromZoneId: edge.toZoneId, toZoneId: zoneIdStr as any,
              fromGateId: fromGate.id, toGateId: edge.fromGateId,
              isPortal: false, targetFloorId: null, cost: edge.cost,
            });
            this.edges.set(edge.toZoneId as string, reverseEdges);
          }
        }
      }
    }
  }

  getNode(zoneId: ZoneId): ZoneNode | undefined {
    return this.nodes.get(zoneId as string);
  }

  getEdges(zoneId: ZoneId): readonly ZoneEdge[] {
    return this.edges.get(zoneId as string) ?? [];
  }

  getZoneForGate(gateId: GateId): ZoneId | undefined {
    return this.gateToZone.get(gateId as string);
  }

  // Simple BFS to find path (zone sequence) from start to target
  findPath(startZoneId: ZoneId, targetZoneId: ZoneId): ZoneId[] | null {
    if (startZoneId === targetZoneId) return [startZoneId];

    const visited = new Set<string>();
    const queue: { zoneId: ZoneId; path: ZoneId[] }[] = [
      { zoneId: startZoneId, path: [startZoneId] },
    ];
    visited.add(startZoneId as string);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const edges = this.getEdges(current.zoneId);

      for (const edge of edges) {
        if (visited.has(edge.toZoneId as string)) continue;
        visited.add(edge.toZoneId as string);

        const newPath = [...current.path, edge.toZoneId];
        if (edge.toZoneId === targetZoneId) return newPath;
        queue.push({ zoneId: edge.toZoneId, path: newPath });
      }
    }

    return null; // unreachable
  }

  // Find the gate to use to move from one zone to the next
  findGate(fromZoneId: ZoneId, toZoneId: ZoneId): Gate | null {
    const edges = this.getEdges(fromZoneId);
    for (const edge of edges) {
      if (edge.toZoneId === toZoneId) {
        const node = this.nodes.get(fromZoneId as string);
        if (node) {
          return node.gates.find((g) => g.id === edge.fromGateId) ?? null;
        }
      }
    }
    return null;
  }

  // Get all reachable zones from a given zone
  getReachableZones(zoneId: ZoneId): ZoneId[] {
    return this.getEdges(zoneId).map((e) => e.toZoneId);
  }

  // Get all zone IDs
  getAllZoneIds(): ZoneId[] {
    return Array.from(this.nodes.values()).map((n) => n.zoneId);
  }
}
