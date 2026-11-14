// Pure town logic: a round island with a beach ring, crossing roads, a stone plaza,
// four study buildings (one per zone, each a different structure), houses, trees,
// bushes, rocks and decorations. No rendering in here.

import type { ZoneId } from "@/lib/lessons"

// The grid is wider than the main island so the bridge and the exam islet fit to the east.
export const SIZE = 42
const ISLAND = 26 // the main island is still a 26-tile square
const CENTER = (ISLAND - 1) / 2
export const LAND_RADIUS = 14.2
const BEACH_FROM = 13.0 // land beyond this distance is sand
export const BASE_TOP = 1 // height of level land; hills rise above it in half steps

// A bridge runs east from the island to a small islet with the Exam Hall (the mock test).
// The gate at the bridge's start stays shut until all four lessons are done.
export const BRIDGE = { x0: 26, x1: 31, z0: 12, z1: 13 }
export const ISLET = { x: 36, z: 12.5, r: 4.8 }
export const MOCK_HALL = { x0: 35, z0: 12 } // 2x2 footprint
export const MOCK_TILE = { x: 34, z: 12 } // walkable tile in front of the hall
const GATE: [number, number][] = [
  [26, 12],
  [26, 13],
]
const onBridge = (x: number, z: number) => x >= BRIDGE.x0 && x <= BRIDGE.x1 && z >= BRIDGE.z0 && z <= BRIDGE.z1
const onIslet = (x: number, z: number) => Math.hypot(x - ISLET.x, z - ISLET.z) <= ISLET.r

let bridgeOpen = false
// Opens or shuts the gate. Read by walkable(), so routes and taps respect it.
export function setBridgeOpen(open: boolean) {
  bridgeOpen = open
}

export type HouseKind = "cottage" | "shop" | "windmill" | "tower" | "barn"

export type Tile = {
  x: number
  z: number
  land: boolean
  kind: "grass" | "road" | "stone" | "sand" | "bridge"
  block: "building" | "house" | "tree" | "bush" | "rock" | "decor" | "gate" | null
  zone?: ZoneId // study building that owns this tile
  house?: HouseKind
  top: number // height of the ground surface on this tile (0 for sea)
}

// Each study building is a 2x2 footprint in one corner.
export const BUILDINGS: { zone: ZoneId; x0: number; z0: number }[] = [
  { zone: "reef", x0: 4, z0: 4 },
  { zone: "forest", x0: 20, z0: 4 },
  { zone: "mountain", x0: 4, z0: 20 },
  { zone: "meadow", x0: 20, z0: 20 },
]

export const HOUSES: { x: number; z: number; kind: HouseKind }[] = [
  { x: 8, z: 8, kind: "cottage" },
  { x: 17, z: 8, kind: "shop" },
  { x: 8, z: 17, kind: "windmill" },
  { x: 17, z: 17, kind: "tower" },
  { x: 4, z: 15, kind: "barn" },
]

export const TREES: [number, number][] = [
  [7, 2],
  [17, 2],
  [2, 7],
  [2, 17],
  [22, 7],
  [22, 17],
  [7, 23],
  [17, 23],
  [10, 3],
  [15, 3],
  [10, 22],
  [15, 22],
  [2, 10],
  [23, 10],
  [2, 15],
  [23, 15],
]

export const BUSHES: [number, number][] = [
  [3, 6],
  [22, 6],
  [3, 19],
  [22, 19],
  [11, 6],
  [14, 19],
]

export const ROCKS: [number, number][] = [
  [5, 24],
  [20, 24],
  [24, 5],
  [1, 20],
]

// The fountain stands at the middle of the town square, where the two roads cross.
export const FOUNTAIN: [number, number][] = [[12, 12], [13, 12], [12, 13], [13, 13]]

// Decorations: flowers and lamp posts. They block walking, like the other objects.
export const DECOR: { kind: "flower" | "lamp"; x: number; z: number; variant: number }[] = [
  ...[
    [6, 5],
    [19, 5],
    [6, 20],
    [19, 20],
    [10, 8],
    [15, 8],
    [10, 17],
    [15, 17],
    [6, 11],
    [19, 11],
    [6, 13],
    [19, 13],
  ].map(([x, z], i) => ({ kind: "flower" as const, x, z, variant: i % 3 })),
  ...[
    [10, 10],
    [15, 10],
    [10, 15],
    [15, 15],
  ].map(([x, z]) => ({ kind: "lamp" as const, x, z, variant: 0 })),
]

// Roads run across the island at x = 12..13 and z = 12..13. The plaza sits in the middle.
export const isRoad = (x: number, z: number) => x === 12 || x === 13 || z === 12 || z === 13
const inPlaza = (x: number, z: number) => x >= 10 && x <= 15 && z >= 10 && z <= 15

export const MAP: Tile[][] = (() => {
  const map: Tile[][] = []
  for (let z = 0; z < SIZE; z++) {
    map.push([])
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - CENTER, z - CENTER)
      const mainIsland = d <= LAND_RADIUS && x < ISLAND && z < ISLAND
      const islet = onIslet(x, z)
      const bridge = onBridge(x, z)
      const land = mainIsland || islet || bridge
      let kind: Tile["kind"] = "grass"
      if (mainIsland && d > BEACH_FROM) kind = "sand"
      if (mainIsland && isRoad(x, z)) kind = "road"
      if (mainIsland && inPlaza(x, z)) kind = "stone"
      if (islet && Math.hypot(x - ISLET.x, z - ISLET.z) > ISLET.r - 1.2) kind = "sand"
      if (bridge) kind = "bridge"
      map[z].push({ x, z, land, kind, block: null, top: land ? BASE_TOP : 0 })
    }
  }
  const set = (x: number, z: number, block: Tile["block"], zone?: ZoneId) => {
    map[z][x].block = block
    if (zone) map[z][x].zone = zone
  }
  for (const b of BUILDINGS)
    for (let dz = 0; dz < 2; dz++)
      for (let dx = 0; dx < 2; dx++) set(b.x0 + dx, b.z0 + dz, "building", b.zone)
  for (const h of HOUSES) {
    set(h.x, h.z, "house")
    map[h.z][h.x].house = h.kind
  }
  for (const [x, z] of TREES) set(x, z, "tree")
  for (const [x, z] of BUSHES) set(x, z, "bush")
  for (const [x, z] of ROCKS) set(x, z, "rock")
  for (const d of DECOR) set(d.x, d.z, "decor")
  for (const [x, z] of FOUNTAIN) set(x, z, "decor")
  for (const [x, z] of GATE) set(x, z, "gate")
  for (let dz = 0; dz < 2; dz++)
    for (let dx = 0; dx < 2; dx++) set(MOCK_HALL.x0 + dx, MOCK_HALL.z0 + dz, "building")

  // Terrain: grass rises in a few soft hills, in half-level steps. The plaza, roads, beach,
  // study buildings and houses (with a one-tile margin) stay level.
  const HILLS: [number, number, number, number][] = [
    [3.5, 9, 4.5, 2.0],
    [21.5, 8.5, 3.5, 1.5],
    [9, 21.5, 3, 1.5],
  ]
  const levelZone = (x: number, z: number) => {
    const t = map[z][x]
    return t.kind !== "grass" || t.block === "building" || t.block === "house"
  }
  for (const row of map)
    for (const t of row) {
      if (!t.land || t.kind !== "grass") continue
      let level = false
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++)
          if (inBounds(t.x + dx, t.z + dz) && levelZone(t.x + dx, t.z + dz)) level = true
      if (level) continue
      let rise = 0
      for (const [hx, hz, r, amp] of HILLS) {
        const f = 1 - Math.hypot(t.x - hx, t.z - hz) / r
        if (f > 0) rise += amp * f * f * (3 - 2 * f)
      }
      t.top = BASE_TOP + Math.round(rise * 2) / 2
    }
  return map
})()

// Height of the ground surface on a tile (0 outside the island).
export function topAt(x: number, z: number) {
  return inBounds(x, z) ? MAP[z][x].top : 0
}

export function inBounds(x: number, z: number) {
  return x >= 0 && z >= 0 && x < SIZE && z < SIZE
}

export function isLand(x: number, z: number) {
  return inBounds(x, z) && MAP[z][x].land
}

export function walkable(x: number, z: number) {
  if (!inBounds(x, z)) return false
  const t = MAP[z][x]
  if (t.block === "gate") return t.land && bridgeOpen
  return t.land && t.block === null
}

// Breadth-first search over walkable tiles. Returns the tiles after `from`
// up to and including `to`, or null if there is no route.
export function findPath(
  from: { x: number; z: number },
  to: { x: number; z: number },
): { x: number; z: number }[] | null {
  if (!walkable(to.x, to.z)) return null
  const key = (x: number, z: number) => z * SIZE + x
  const prev = new Map<number, number>()
  const start = key(from.x, from.z)
  prev.set(start, -1)
  const queue: number[] = [start]
  const goal = key(to.x, to.z)
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi]
    if (cur === goal) break
    const cx = cur % SIZE
    const cz = Math.floor(cur / SIZE)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx
      const nz = cz + dz
      const nk = key(nx, nz)
      if (!walkable(nx, nz) || prev.has(nk)) continue
      prev.set(nk, cur)
      queue.push(nk)
    }
  }
  if (!prev.has(goal)) return null
  const path: { x: number; z: number }[] = []
  let k = goal
  while (k !== start) {
    path.unshift({ x: k % SIZE, z: Math.floor(k / SIZE) })
    k = prev.get(k)!
  }
  return path
}

// Where the player starts: a free tile on the plaza, always walkable.
export const START = { x: 11, z: 11 }


