import { useEffect, useRef } from "react"
import { BRIDGE, BUILDINGS, BUSHES, DECOR, HOUSES, MAP, MOCK_HALL, ROCKS, SIZE, START, TREES, findPath, isLand, setBridgeOpen, topAt, walkable } from "@/game/island"
import type { HouseKind } from "@/game/island"
import { ZONES, type ZoneId } from "@/lib/lessons"
import { VoxelRenderer, type Box, type Poly, type V3 } from "@/game/voxelRenderer"
import { dayClock, dayEnv } from "@/game/daylight"

// The town. Ground, beach, water and cliffs are flat polygons (cheap).
// Buildings, houses, trees, decorations and the character are blocks (sorted).
// Scale: the character is about 1.6 tiles tall, so houses are 2–3 tiles and
// study buildings 3–5 tiles.

export type IslandCommands = {
  // Hold a direction (keyboard key or on-screen button) to keep walking.
  hold: (id: string, dx: number, dz: number, on: boolean) => void
  walkTo: (x: number, z: number) => void
  // Plays the bridge-and-hall camera tour once (used when the gate is open).
  showBridge: () => void
}

type Props = {
  calm: boolean
  paused: boolean // true while a mini game is open
  commands: { current: IslandCommands | null }
  onArrive: (x: number, z: number) => void
  // Filled by App: one HTML marker per study zone, moved above its building each frame.
  markers: { current: Record<string, HTMLElement | null> }
  bridgeOpen: boolean // true once all four lessons are done: the gate lifts
  onCutscene: (on: boolean) => void // true while the camera tours the bridge and hall
}

const MOVE_SPEED = 5.5 // tiles per second
const GROUND_Y = 1
const WATER_A: V3 = [47, 135, 214]
const WATER_B: V3 = [60, 150, 228]
const SEA_RANGE = 5 // how far the sea extends past the island

const C = {
  grass: [96, 186, 96] as V3,
  grassAlt: [86, 176, 88] as V3,
  grassDark: [72, 162, 76] as V3,
  road: [222, 196, 140] as V3,
  stone: [200, 198, 190] as V3,
  stoneDark: [176, 174, 166] as V3,
  sand: [240, 214, 150] as V3,
  dirt: [141, 91, 58] as V3,
  dirtDark: [112, 70, 44] as V3,
  clay: [84, 86, 96] as V3,
  wall: [240, 226, 190] as V3,
  brick: [176, 96, 84] as V3,
  barnRed: [170, 60, 50] as V3,
  roofRed: [200, 70, 60] as V3,
  roofDark: [110, 40, 40] as V3,
  roofBrown: [140, 90, 60] as V3,
  wood: [196, 150, 105] as V3,
  awning: [240, 150, 60] as V3,
  glass: [150, 210, 240] as V3,
  door: [110, 70, 40] as V3,
  white: [250, 250, 248] as V3,
  trunk: [122, 74, 42] as V3,
  leaves: [47, 158, 68] as V3,
  leavesDark: [36, 130, 56] as V3,
  bush: [60, 140, 70] as V3,
  rock: [150, 150, 146] as V3,
  iron: [70, 70, 80] as V3,
  lampGlow: [255, 232, 140] as V3,
  flowers: [[240, 90, 130], [255, 214, 80], [170, 120, 230]] as V3[],
  skin: [255, 208, 160] as V3,
  shirt: [224, 49, 49] as V3,
  pants: [54, 79, 199] as V3,
  hair: [74, 44, 23] as V3,
  eye: [27, 27, 27] as V3,
  star: [255, 224, 102] as V3,
  cloud: [255, 255, 255] as V3,
  crystal: [160, 110, 240] as V3,
  crystalGlow: [210, 170, 255] as V3,
  gold: [255, 200, 70] as V3,
  leafLight: [120, 214, 110] as V3,
  pink: [255, 143, 171] as V3,
  mint: [143, 240, 208] as V3,
  water: [96, 196, 255] as V3,
  waterDeep: [60, 150, 230] as V3,
  waterLight: [200, 240, 255] as V3,
}

// World position of a grid tile centre (the island is centred on 0,0).
const wx = (x: number) => x - (SIZE - 1) / 2
const wz = (z: number) => z - (SIZE - 1) / 2
const MID = (SIZE - 1) / 2

// Height of the ground under a world position, blended between the four nearest tiles,
// so the character climbs the hills smoothly.
function groundAt(x: number, z: number): number {
  const tx = x + MID
  const tz = z + MID
  const x0 = Math.floor(tx)
  const z0 = Math.floor(tz)
  const fx = tx - x0
  const fz = tz - z0
  const north = topAt(x0, z0) * (1 - fx) + topAt(x0 + 1, z0) * fx
  const south = topAt(x0, z0 + 1) * (1 - fx) + topAt(x0 + 1, z0 + 1) * fx
  return north * (1 - fz) + south * fz
}

function hexToRgb(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

type Beacon = { box: Box; base: number }
type Windmill = { hx: number; hy: number; hz: number; blades: Box[] }
type Pulse = { box: Box; a: V3; b: V3 }
type Drop = { box: Box; base: number; phase: number }
type Part = { ox: number; oy: number; oz: number; sx: number; sy: number; sz: number; c: V3; leg?: "L" | "R"; arm?: "L" | "R" }

// Ground, beach, cliffs and sea: flat polygons, built once.
function buildFlat() {
  const polys: Poly[] = []
  const water: Poly[] = []
  const ground = (x: number, z: number, y: number, c: V3): Poly => ({
    pts: [
      [wx(x) - 0.5, y, wz(z) - 0.5],
      [wx(x) + 0.5, y, wz(z) - 0.5],
      [wx(x) + 0.5, y, wz(z) + 0.5],
      [wx(x) - 0.5, y, wz(z) + 0.5],
    ],
    n: [0, 1, 0],
    c,
    light: 1,
  })

  // Cliff faces: the sides of land tiles that border the sea, in layers.
  const sides: [number, number, V3, number][] = [
    [1, 0, [1, 0, 0], 0.8],
    [-1, 0, [-1, 0, 0], 0.7],
    [0, 1, [0, 0, 1], 0.62],
    [0, -1, [0, 0, -1], 0.62],
  ]
  for (const row of MAP)
    for (const t of row) {
      if (!t.land) continue
      const x = wx(t.x)
      const z = wz(t.z)
      for (const [dx, dz, n, light] of sides) {
        // Drop to the neighbour: the sea, or a lower tile of land.
        const nh = isLand(t.x + dx, t.z + dz) ? topAt(t.x + dx, t.z + dz) : 0
        if (nh >= t.top) continue
        const ex = x + dx * 0.5
        const ez = z + dz * 0.5
        const along = dx !== 0 ? [0, 0, 1] : [1, 0, 0]
        const a: V3 = [ex - along[0] * 0.5, 0, ez - along[2] * 0.5]
        const b: V3 = [ex + along[0] * 0.5, 0, ez + along[2] * 0.5]
        // Layers, top to bottom: turf or sand lip, soil, darker soil, clay at the waterline.
        const lip = t.kind === "sand" ? C.sand : C.grassDark
        const top = t.top
        const rest = top - 0.18 - nh
        const layers: [number, number, V3][] = [
          [top, top - 0.18, lip],
          [top - 0.18, nh + rest * 0.6, C.dirt],
          [nh + rest * 0.6, nh + rest * 0.25, C.dirtDark],
          [nh + rest * 0.25, nh, C.clay],
        ]
        for (const [y0, y1, c] of layers)
          polys.push({ pts: [[a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]]], n, c, light })
      }
    }

  // Ground: grass with varied greens, roads, stone plaza and sand beach.
  for (const row of MAP)
    for (const t of row) {
      if (!t.land) continue
      const alt = (t.x * 7 + t.z * 3) % 5 === 0
      let c: V3
      if (t.kind === "road") c = C.road
      else if (t.kind === "stone") c = (t.x + t.z) % 2 ? C.stone : C.stoneDark
      else if (t.kind === "sand") c = C.sand
      else if (t.kind === "bridge") c = t.x % 2 ? C.wood : [170, 122, 80]
      else c = (t.x + t.z) % 2 ? (alt ? C.grassAlt : C.grass) : C.grassDark
      polys.push(ground(t.x, t.z, t.top, c))
    }

  // Sea: 2x2 squares around the island, skipped where there is land.
  for (let z = -SEA_RANGE; z < SIZE + SEA_RANGE; z += 2)
    for (let x = -SEA_RANGE; x < SIZE + SEA_RANGE; x += 2) {
      if (isLand(x, z) || isLand(x + 1, z) || isLand(x, z + 1) || isLand(x + 1, z + 1)) continue
      water.push({
        pts: [
          [wx(x) - 0.5, 0, wz(z) - 0.5],
          [wx(x) + 1.5, 0, wz(z) - 0.5],
          [wx(x) + 1.5, 0, wz(z) + 1.5],
          [wx(x) - 0.5, 0, wz(z) + 1.5],
        ],
        n: [0, 1, 0],
        c: WATER_A,
        light: 1,
      })
    }
  return { polys, water }
}

// A box standing on the ground at (x, z), starting at height y0.
const at = (x: number, y0: number, z: number, sx: number, sy: number, sz: number, c: V3): Box => ({
  x,
  y: y0 + sy / 2,
  z,
  sx,
  sy,
  sz,
  c,
})

// Houses: small, two to three tiles tall.
// Splashes: small spots on the sea that throw a few white droplets and a flat ring, then rest.
type Splash = { off: number; period: number; drops: Box[]; ring: Box; x: number; z: number }

function buildSplashes(water: Poly[]): { splashes: Splash[]; boxes: Box[] } {
  const splashes: Splash[] = []
  const boxes: Box[] = []
  water.forEach((p, i) => {
    if (i % 8 !== 5) return
    const x = (p.pts[0][0] + p.pts[2][0]) / 2
    const z = (p.pts[0][2] + p.pts[2][2]) / 2
    // Keep the splashes near the island, where the camera looks.
    if (Math.hypot(x + 8, z + 8) > 24) return
    const ring: Box = { x, y: 0.01, z, sx: 0.2, sy: 0.02, sz: 0.2, c: C.waterLight, glow: true, hidden: true }
    const drops: Box[] = [0, 1, 2, 3].map(() => ({ x, y: 0, z, sx: 0.24, sy: 0.24, sz: 0.24, c: C.waterLight, glow: true, hidden: true }))
    const s: Splash = { off: ((i * 0.618) % 1) * 3, period: 2.6 + ((i * 37) % 100) / 100 * 1.6, drops, ring, x, z }
    splashes.push(s)
    boxes.push(ring, ...drops)
  })
  return { splashes, boxes }
}

// Each splash runs its own cycle: the ring spreads out, the drops arc up and fall, then it rests.
function updateSplashes(splashes: Splash[], time: number, calm: boolean) {
  splashes.forEach((s, i) => {
    const u = calm ? 1 : (((time + s.off) / s.period) % 1)
    const active = u < 0.9
    s.ring.hidden = !active
    s.ring.sx = s.ring.sz = 0.4 + u * 2.2
    s.ring.c = [
      C.waterLight[0] + (C.water[0] - C.waterLight[0]) * u,
      C.waterLight[1] + (C.water[1] - C.waterLight[1]) * u,
      C.waterLight[2] + (C.water[2] - C.waterLight[2]) * u,
    ]
    s.drops.forEach((d, k) => {
      const a = (k * Math.PI) / 2 + i
      const r = 0.1 + u * 0.7
      d.hidden = !active || u < 0.05
      d.x = s.x + Math.cos(a) * r
      d.z = s.z + Math.sin(a) * r
      d.y = 0.05 + 0.5 * 4 * u * (1 - u)
    })
  })
}

function houseBoxes(kind: HouseKind, cx: number, cz: number, out: Box[], windmills: Windmill[]) {
  const g = GROUND_Y
  switch (kind) {
    case "cottage":
      out.push(at(cx, g, cz, 0.8, 1.7, 0.8, C.wall))
      out.push(at(cx, g + 1.7, cz, 0.95, 0.3, 0.95, C.roofRed))
      out.push(at(cx, g + 2.0, cz, 0.6, 0.3, 0.6, C.roofRed))
      out.push(at(cx + 0.22, g + 1.6, cz - 0.2, 0.14, 0.9, 0.14, C.rock))
      out.push(at(cx, g, cz + 0.41, 0.25, 0.9, 0.05, C.door))
      out.push(at(cx - 0.24, g + 1.0, cz + 0.41, 0.2, 0.2, 0.05, C.glass))
      break
    case "shop":
      out.push(at(cx, g, cz, 0.9, 1.4, 0.9, C.wood))
      out.push(at(cx, g + 1.4, cz, 0.95, 0.12, 0.95, C.roofBrown))
      out.push(at(cx, g + 1.0, cz + 0.5, 0.95, 0.1, 0.35, C.awning))
      out.push(at(cx, g + 1.2, cz + 0.46, 0.5, 0.2, 0.06, C.sand))
      out.push(at(cx - 0.22, g + 0.3, cz + 0.46, 0.22, 0.4, 0.05, C.glass))
      out.push(at(cx + 0.22, g + 0.3, cz + 0.46, 0.22, 0.4, 0.05, C.glass))
      break
    case "windmill": {
      out.push(at(cx, g, cz, 0.6, 2.6, 0.6, C.wall))
      out.push(at(cx, g + 2.6, cz, 0.7, 0.3, 0.7, C.roofBrown))
      out.push(at(cx, g, cz + 0.31, 0.2, 0.6, 0.05, C.door))
      const hy = g + 2.2
      const hz = cz + 0.36
      const blades: Box[] = []
      for (let k = 0; k < 4; k++) {
        const b: Box = { x: cx, y: hy, z: hz, sx: 0.22, sy: 0.22, sz: 0.05, c: C.white }
        blades.push(b)
        out.push(b)
      }
      windmills.push({ hx: cx, hy, hz, blades })
      break
    }
    case "tower":
      out.push(at(cx, g, cz, 0.7, 3.0, 0.7, C.brick))
      for (const [dx, dz] of [
        [-0.25, -0.25],
        [0.25, -0.25],
        [-0.25, 0.25],
        [0.25, 0.25],
      ])
        out.push(at(cx + dx, g + 3.0, cz + dz, 0.2, 0.22, 0.2, C.rock))
      out.push(at(cx, g + 3.0, cz, 0.04, 0.5, 0.04, C.iron))
      out.push(at(cx + 0.17, g + 3.25, cz, 0.3, 0.18, 0.03, C.roofRed))
      out.push(at(cx, g, cz + 0.36, 0.2, 0.6, 0.05, C.door))
      out.push(at(cx, g + 2.0, cz + 0.36, 0.08, 0.5, 0.05, C.glass))
      break
    case "barn":
      out.push(at(cx, g, cz, 0.9, 1.5, 0.85, C.barnRed))
      out.push(at(cx, g + 1.5, cz, 0.98, 0.25, 0.9, C.roofDark))
      out.push(at(cx, g + 1.75, cz, 0.6, 0.25, 0.85, C.roofDark))
      out.push(at(cx, g, cz + 0.43, 0.35, 0.7, 0.05, C.white))
      out.push(at(cx + 0.32, g, cz + 0.2, 0.2, 0.2, 0.2, C.sand))
      break
  }
}

// Study buildings: each zone has its own structure. Returns the height of its top.
// Study buildings. Each one is a detailed structure that matches its game, built from
// flat-coloured blocks: layered roofs, windows, railings, stripes and small props.
// `front` is +1 or -1 and points toward the middle of the island, where the doors face.

function lighthouse(cx: number, cz: number, front: number, out: Box[], pulses: Pulse[]): number {
  const g = GROUND_Y
  // Rocky plinth, with boulders at the corners
  out.push(at(cx, g, cz, 1.4, 0.3, 1.4, C.stoneDark))
  out.push(at(cx, g + 0.3, cz, 1.2, 0.25, 1.2, C.stone))
  out.push(at(cx - 0.8, g, cz - front * 0.8, 0.3, 0.25, 0.3, C.rock))
  out.push(at(cx + 0.8, g, cz + front * 0.75, 0.26, 0.2, 0.26, C.rock))
  // Tower: six bands, white and red, narrowing as they rise
  const widths = [1.0, 0.96, 0.9, 0.84, 0.78, 0.72]
  let y = g + 0.55
  widths.forEach((w, i) => {
    out.push(at(cx, y, cz, w, 0.7, w, i % 2 === 0 ? C.white : C.roofRed))
    if (i % 2 === 0 && i > 0) {
      // Porthole windows on the front and back of each white band
      out.push(at(cx, y + 0.22, cz + front * (w / 2 + 0.02), 0.22, 0.3, 0.04, C.glass))
      out.push(at(cx, y + 0.22, cz - front * (w / 2 + 0.02), 0.22, 0.3, 0.04, C.glass))
    }
    y += 0.7
  })
  // Door with a stone frame and a lintel
  out.push(at(cx, g + 0.55, cz + front * 0.52, 0.34, 0.5, 0.05, C.door))
  out.push(at(cx, g + 1.06, cz + front * 0.52, 0.44, 0.06, 0.06, C.stoneDark))
  // Gallery with a railing and the lantern room
  out.push(at(cx, y, cz, 1.1, 0.12, 1.1, C.iron))
  for (const s of [-1, 1]) {
    out.push(at(cx, y + 0.12, cz + s * 0.5, 1.0, 0.4, 0.04, C.iron))
    out.push(at(cx + s * 0.5, y + 0.12, cz, 0.04, 0.4, 1.0, C.iron))
  }
  out.push(at(cx, y + 0.12, cz, 0.7, 0.7, 0.7, C.glass))
  const lamp = at(cx, y + 0.3, cz, 0.42, 0.42, 0.42, C.lampGlow)
  out.push(lamp)
  pulses.push({ box: lamp, a: C.lampGlow, b: [255, 190, 80] })
  out.push(at(cx, y + 0.82, cz, 0.84, 0.1, 0.84, C.roofRed))
  out.push(at(cx, y + 0.92, cz, 0.5, 0.1, 0.5, C.roofRed))
  out.push(at(cx, y + 1.02, cz, 0.18, 0.14, 0.18, C.gold))
  // Flag on a pole
  out.push(at(cx, y + 1.14, cz, 0.04, 0.42, 0.04, C.iron))
  out.push(at(cx + 0.12, y + 1.4, cz, 0.24, 0.14, 0.03, C.awning))
  return y + 1.56
}

function treehouse(cx: number, cz: number, front: number, out: Box[]): number {
  const g = GROUND_Y
  // Roots and a trunk with bark stripes
  out.push(at(cx - 0.42, g, cz, 0.24, 0.14, 0.3, C.dirtDark))
  out.push(at(cx + 0.42, g, cz, 0.24, 0.14, 0.3, C.dirtDark))
  out.push(at(cx, g, cz, 0.6, 2.4, 0.6, C.trunk))
  for (let i = 0; i < 3; i++) out.push(at(cx, g + 0.5 + i * 0.7, cz + front * 0.31, 0.62, 0.08, 0.04, C.dirtDark))
  // Canopy: clusters of leaves in three shades
  out.push(at(cx, g + 2.0, cz, 2.0, 0.8, 2.0, C.leaves))
  out.push(at(cx - 0.55, g + 2.3, cz + 0.2, 1.0, 0.7, 1.0, C.leavesDark))
  out.push(at(cx + 0.6, g + 2.25, cz - 0.3, 0.9, 0.7, 0.9, C.leafLight))
  out.push(at(cx, g + 2.7, cz, 1.2, 0.45, 1.2, C.leafLight))
  // Platform with posts and a railing on all four sides
  const py = g + 2.6
  out.push(at(cx, py, cz, 1.8, 0.12, 1.8, C.wood))
  for (const sx of [-0.85, 0.85]) for (const sz of [-0.85, 0.85]) out.push(at(cx + sx, py + 0.12, cz + sz, 0.07, 0.4, 0.07, C.wood))
  out.push(at(cx, py + 0.45, cz + front * 0.85, 1.8, 0.06, 0.06, C.wood))
  out.push(at(cx, py + 0.45, cz - front * 0.85, 1.8, 0.06, 0.06, C.wood))
  out.push(at(cx - 0.85, py + 0.45, cz, 0.06, 0.06, 1.8, C.wood))
  out.push(at(cx + 0.85, py + 0.45, cz, 0.06, 0.06, 1.8, C.wood))
  // Hut: plank lines, a door, windows and a two-tone roof
  const hy = py + 0.12
  out.push(at(cx, hy, cz, 1.1, 0.95, 1.1, C.wood))
  for (let i = 0; i < 3; i++) out.push(at(cx, hy + 0.2 + i * 0.28, cz - front * 0.56, 1.1, 0.04, 0.03, C.dirtDark))
  out.push(at(cx - 0.25, hy, cz + front * 0.57, 0.3, 0.6, 0.04, C.door))
  out.push(at(cx + 0.3, hy + 0.4, cz + front * 0.57, 0.28, 0.3, 0.04, C.glass))
  out.push(at(cx + 0.57, hy + 0.4, cz, 0.04, 0.3, 0.28, C.glass))
  out.push(at(cx, hy + 0.95, cz, 1.4, 0.14, 1.4, C.roofRed))
  out.push(at(cx, hy + 1.09, cz, 1.0, 0.14, 1.0, C.roofDark))
  // Flag on the roof
  out.push(at(cx + 0.5, hy + 1.23, cz - 0.4, 0.04, 0.5, 0.04, C.iron))
  out.push(at(cx + 0.62, hy + 1.5, cz - 0.4, 0.24, 0.14, 0.03, C.gold))
  // Rope ladder hanging from the platform to the ground, with rungs
  for (const s of [-0.12, 0.12]) out.push(at(cx + s, g, cz + front * 0.5, 0.05, py - g, 0.05, C.wood))
  for (let i = 0; i < 5; i++) out.push(at(cx, g + 0.4 + i * 0.4, cz + front * 0.5, 0.3, 0.05, 0.05, C.wood))
  return hy + 1.6
}

function ziggurat(cx: number, cz: number, front: number, out: Box[], pulses: Pulse[]): number {
  const g = GROUND_Y
  // Four stepped tiers with stone courses
  const tiers = [
    { w: 2.0, h: 0.9, c: C.stone },
    { w: 1.6, h: 0.8, c: C.stoneDark },
    { w: 1.2, h: 0.8, c: C.stone },
    { w: 0.8, h: 0.6, c: C.stoneDark },
  ]
  let y = g
  for (const t of tiers) {
    out.push(at(cx, y, cz, t.w, t.h, t.w, t.c))
    out.push(at(cx, y + t.h * 0.5, cz + front * (t.w / 2 + 0.01), t.w, 0.05, 0.03, C.stoneDark))
    out.push(at(cx, y + t.h * 0.5, cz - front * (t.w / 2 + 0.01), t.w, 0.05, 0.03, C.stoneDark))
    y += t.h
  }
  // Temple doorway with white pillars, a lintel and two torches
  const doorZ = cz + front * 1.02
  out.push(at(cx, g, doorZ, 0.5, 0.6, 0.04, C.clay))
  out.push(at(cx, g + 0.6, doorZ, 0.7, 0.14, 0.06, C.stoneDark))
  for (const s of [-0.42, 0.42]) {
    out.push(at(cx + s, g, cz + front * 1.04, 0.14, 0.7, 0.14, C.white))
    out.push(at(cx + s, g + 0.7, cz + front * 1.04, 0.22, 0.06, 0.22, C.white))
  }
  for (const s of [-0.8, 0.8]) {
    out.push(at(cx + s, g + 0.45, doorZ, 0.1, 0.2, 0.04, C.iron))
    const flame = at(cx + s, g + 0.7, doorZ, 0.12, 0.12, 0.04, C.lampGlow)
    out.push(flame)
    pulses.push({ box: flame, a: C.lampGlow, b: [255, 150, 60] })
  }
  // Vines on the corners
  out.push(at(cx - 0.92, g + 0.3, cz - 0.92, 0.16, 0.5, 0.16, C.leaves))
  out.push(at(cx + 0.92, g + 1.4, cz + 0.92, 0.16, 0.6, 0.16, C.leafLight))
  // Shrine on top: four columns, a roof and a glowing crystal in the middle
  const top = y
  for (const sx of [-0.28, 0.28]) for (const sz of [-0.28, 0.28]) out.push(at(cx + sx, top, cz + sz, 0.12, 0.7, 0.12, C.white))
  out.push(at(cx, top + 0.7, cz, 0.9, 0.12, 0.9, C.roofDark))
  out.push(at(cx, top + 0.82, cz, 0.6, 0.1, 0.6, C.stone))
  const crystal = at(cx, top + 0.1, cz, 0.34, 0.56, 0.34, C.crystal)
  out.push(crystal)
  pulses.push({ box: crystal, a: C.crystal, b: C.crystalGlow })
  return top + 0.92
}

function carnival(cx: number, cz: number, front: number, out: Box[]): number {
  const g = GROUND_Y
  // Tent walls with red and white stripes on the front
  out.push(at(cx, g, cz, 1.9, 1.0, 1.9, C.white))
  for (let i = 0; i < 5; i++) out.push(at(cx - 0.76 + i * 0.38, g, cz + front * 0.96, 0.19, 1.0, 0.05, i % 2 ? C.white : C.roofRed))
  // Dark entrance with a striped awning and bunting along the top edge
  out.push(at(cx, g, cz + front * 0.97, 0.5, 0.8, 0.06, C.clay))
  out.push(at(cx, g + 0.8, cz + front * 1.02, 0.9, 0.12, 0.3, C.awning))
  const flags = [C.gold, C.mint, C.pink, C.leafLight, C.gold]
  flags.forEach((c, i) => out.push(at(cx - 0.8 + i * 0.4, g + 0.85, cz + front * 1.02, 0.14, 0.14, 0.03, c)))
  // Striped canopy: four layers narrowing to a point, with a gold spike and a pennant
  let y = g + 1.0
  for (const [w, c] of [[2.0, C.roofRed], [1.7, C.white], [1.3, C.roofRed], [0.8, C.white]] as [number, V3][]) {
    out.push(at(cx, y, cz, w, 0.3, w, c))
    y += 0.3
  }
  out.push(at(cx, y, cz, 0.12, 0.35, 0.12, C.gold))
  out.push(at(cx + 0.14, y + 0.2, cz, 0.22, 0.12, 0.03, C.pink))
  // Shooting counter: wooden front, a top board and a prize bowl
  const counterZ = cz + front * 1.15
  out.push(at(cx, g, counterZ, 1.8, 0.6, 0.4, C.wood))
  out.push(at(cx, g + 0.6, counterZ, 1.9, 0.08, 0.5, C.dirtDark))
  for (const [i, c] of [C.gold, C.mint, C.pink].entries()) out.push(at(cx - 0.5 + i * 0.5, g + 0.68, counterZ, 0.16, 0.16, 0.16, c))
  // Three targets on posts behind the counter, each with a red ring and a gold centre
  const boardZ = counterZ - front * 0.22
  for (let i = 0; i < 3; i++) {
    const tx = cx - 0.6 + i * 0.6
    out.push(at(tx, g + 0.68, boardZ, 0.06, 0.7, 0.06, C.iron))
    out.push(at(tx, g + 1.1, boardZ, 0.44, 0.44, 0.06, C.white))
    out.push(at(tx, g + 1.1, boardZ + front * 0.035, 0.3, 0.3, 0.04, C.roofRed))
    out.push(at(tx, g + 1.1, boardZ + front * 0.06, 0.12, 0.12, 0.03, C.gold))
  }
  // Pink sign above the targets
  out.push(at(cx, g + 1.42, boardZ, 1.5, 0.22, 0.05, C.pink))
  return g + 2.55
}

// The town fountain: a stone plinth, a rim, two water basins on a column and a gold finial.
// Water shimmers between two blues, and droplets rise and fall over the basins.
// The Exam Hall on the islet: a white hall with a blue roof, columns facing the bridge, and
// a yellow flag that flutters. Returns the height of the flag pole's top.
function examHall(cx: number, cz: number, out: Box[], pulses: Pulse[]): number {
  const g = GROUND_Y
  const BLUE: V3 = [58, 110, 200]
  out.push(at(cx, g, cz, 2.0, 0.3, 2.0, C.stone)) // platform
  out.push(at(cx, g + 0.3, cz, 1.6, 1.3, 1.6, C.wall)) // hall
  for (const sz of [-0.6, 0, 0.6]) out.push(at(cx - 0.95, g + 0.3, cz + sz, 0.16, 1.3, 0.16, C.white)) // columns
  out.push(at(cx - 0.82, g + 0.3, cz, 0.06, 0.8, 0.4, C.door)) // door
  out.push(at(cx, g + 1.6, cz, 2.0, 0.2, 2.0, BLUE)) // roof
  out.push(at(cx, g + 1.8, cz, 1.2, 0.2, 1.2, BLUE))
  out.push(at(cx, g + 2.0, cz, 0.06, 0.8, 0.06, C.iron)) // pole
  const flag = at(cx + 0.2, g + 2.45, cz, 0.42, 0.25, 0.04, [255, 212, 59])
  out.push(flag)
  pulses.push({ box: flag, a: [255, 212, 59], b: [255, 150, 60] })
  return g + 2.8
}

const smooth = (k: number) => {
  const c = Math.min(1, Math.max(0, k))
  return c * c * (3 - 2 * c)
}

// Camera path for the cutscene: the player, the bridge, the Exam Hall, then back to the player.
// zoom 0 is the normal follow camera, 1 is the wide view.
function cutscenePose(p: number, px: number, pz: number) {
  const home = [px, 1, pz]
  const bridge = [wx((BRIDGE.x0 + BRIDGE.x1) / 2), 1.5, wz(BRIDGE.z0) + 0.5]
  const hall = [wx(MOCK_HALL.x0) + 0.5, 2.2, wz(MOCK_HALL.z0) + 0.5]
  const keys: [number, number[], number][] = [
    [0, home, 0],
    [0.25, bridge, 1],
    [0.45, hall, 1],
    [0.72, hall, 1],
    [1, home, 0],
  ]
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1, z1] = keys[i]
    if (p <= t1) {
      const [t0, p0, z0] = keys[i - 1]
      const k = smooth((p - t0) / (t1 - t0))
      return { focus: p0.map((v, j) => v + (p1[j] - v) * k), zoom: z0 + (z1 - z0) * k }
    }
  }
  return { focus: home, zoom: 0 }
}

function fountain(out: Box[], pulses: Pulse[], drops: Drop[]) {
  const g = GROUND_Y
  out.push(at(0, g, 0, 1.9, 0.25, 1.9, C.stone))
  for (const s of [-1, 1]) {
    out.push(at(0, g + 0.25, s * 0.88, 1.9, 0.3, 0.14, C.stoneDark))
    out.push(at(s * 0.88, g + 0.25, 0, 0.14, 0.3, 1.9, C.stoneDark))
  }
  const pool = at(0, g + 0.2, 0, 1.6, 0.06, 1.6, C.water)
  out.push(pool)
  pulses.push({ box: pool, a: C.water, b: C.waterDeep })
  out.push(at(0, g + 0.26, 0, 0.5, 0.45, 0.5, C.stone))
  // Lower basin on the column
  out.push(at(0, g + 0.7, 0, 1.0, 0.1, 1.0, C.stoneDark))
  const low = at(0, g + 0.78, 0, 0.86, 0.04, 0.86, C.water)
  out.push(low)
  pulses.push({ box: low, a: C.water, b: C.waterDeep })
  out.push(at(0, g + 0.8, 0, 0.22, 0.5, 0.22, C.stone))
  // Upper basin and gold finial
  out.push(at(0, g + 1.3, 0, 0.6, 0.08, 0.6, C.stone))
  const high = at(0, g + 1.37, 0, 0.5, 0.04, 0.5, C.water)
  out.push(high)
  pulses.push({ box: high, a: C.water, b: C.waterDeep })
  out.push(at(0, g + 1.38, 0, 0.14, 0.22, 0.14, C.gold))
  // Droplets: [x, z, height of its basin, phase]
  const spots: [number, number, number, number][] = [
    [0, 0, g + 1.45, 0.7],
    [0.32, 0, g + 0.9, 0.2],
    [-0.32, 0, g + 0.9, 0.9],
    [0, 0.32, g + 0.9, 0.5],
  ]
  for (const [x, z, base, phase] of spots) {
    const box = at(x, base, z, 0.1, 0.1, 0.1, C.waterLight)
    out.push(box)
    drops.push({ box, base, phase })
  }
}

// Blocks: study buildings, houses, trees, decorations, beacons, stars, clouds.
function buildBlocks() {
  const boxes: Box[] = []
  const beacons: Beacon[] = []
  const windmills: Windmill[] = []
  const clouds: Box[] = []
  const pulses: Pulse[] = []
  const drops: Drop[] = []
  const markerY: Record<string, number> = {}

  for (const b of BUILDINGS) {
    const zone = ZONES.find((z) => z.id === b.zone)!
    const cx = wx(b.x0) + 0.5
    const cz = wz(b.z0) + 0.5
    // Doors face the middle of the island.
    const front = b.z0 < MID ? 1 : -1
    let top: number
    switch (zone.id) {
      case "reef":
        top = lighthouse(cx, cz, front, boxes, pulses)
        break
      case "forest":
        top = treehouse(cx, cz, front, boxes)
        break
      case "mountain":
        top = ziggurat(cx, cz, front, boxes, pulses)
        break
      default:
        top = carnival(cx, cz, front, boxes)
    }
    markerY[zone.id] = top + 0.9
    const beacon: Box = { x: cx, y: top + 0.6, z: cz, sx: 0.45, sy: 0.45, sz: 0.45, c: hexToRgb(zone.color) }
    boxes.push(beacon)
    beacons.push({ box: beacon, base: top + 0.6 })
  }

  // The exam islet: its hall gets a beacon like the study buildings.
  const hallTop = examHall(wx(MOCK_HALL.x0) + 0.5, wz(MOCK_HALL.z0) + 0.5, boxes, pulses)
  markerY.mock = hallTop + 0.9
  const hallBeacon: Box = { x: wx(MOCK_HALL.x0) + 0.5, y: hallTop + 0.6, z: wz(MOCK_HALL.z0) + 0.5, sx: 0.45, sy: 0.45, sz: 0.45, c: [255, 212, 59] }
  boxes.push(hallBeacon)
  beacons.push({ box: hallBeacon, base: hallTop + 0.6 })

  // The bridge: rails along both edges, and the gate across its island end. The gate bar lifts when open.
  const railN = wz(BRIDGE.z0) - 0.45
  const railS = wz(BRIDGE.z1) + 0.45
  for (let x = BRIDGE.x0 + 1; x <= BRIDGE.x1; x++)
    for (const z of [railN, railS]) boxes.push(at(wx(x), GROUND_Y, z, 0.12, 0.45, 0.12, C.wood))
  for (const z of [railN, railS]) boxes.push(at((wx(BRIDGE.x0 + 1) + wx(BRIDGE.x1)) / 2, GROUND_Y + 0.45, z, wx(BRIDGE.x1) - wx(BRIDGE.x0 + 1) + 0.2, 0.08, 0.08, C.wood))
  const gateX = wx(BRIDGE.x0)
  for (const z of [railN, railS]) boxes.push(at(gateX, GROUND_Y, z, 0.2, 1.6, 0.2, C.door))
  const gateBar: Box = { x: gateX, y: GROUND_Y + 0.16, z: wz((BRIDGE.z0 + BRIDGE.z1) / 2), sx: 0.14, sy: 0.14, sz: 2.0, c: [230, 60, 50] }
  boxes.push(gateBar)

  for (const h of HOUSES) houseBoxes(h.kind, wx(h.x), wz(h.z), boxes, windmills)

  // Plants and objects stand on the ground of their own tile, so they follow the hills.
  for (const [x, z] of TREES) {
    const g = topAt(x, z)
    boxes.push(at(wx(x), g, wz(z), 0.22, 1.3, 0.22, C.trunk))
    boxes.push(at(wx(x), g + 1.3, wz(z), 1.0, 0.9, 1.0, C.leaves))
    boxes.push(at(wx(x), g + 2.2, wz(z), 0.6, 0.5, 0.6, C.leavesDark))
  }
  for (const [x, z] of BUSHES) {
    const g = topAt(x, z)
    boxes.push(at(wx(x), g, wz(z), 0.7, 0.5, 0.7, C.bush))
    boxes.push(at(wx(x) + 0.15, g + 0.5, wz(z) - 0.1, 0.4, 0.3, 0.4, C.leaves))
  }
  for (const [x, z] of ROCKS) {
    const g = topAt(x, z)
    boxes.push(at(wx(x), g, wz(z), 0.6, 0.4, 0.55, C.rock))
    boxes.push(at(wx(x) - 0.12, g + 0.4, wz(z) + 0.05, 0.3, 0.2, 0.3, C.stone))
  }

  for (const d of DECOR) {
    const x = wx(d.x)
    const z = wz(d.z)
    const g = topAt(d.x, d.z)
    if (d.kind === "flower") {
      const cols = C.flowers
      boxes.push(at(x, g, z, 0.7, 0.12, 0.7, C.grassDark))
      boxes.push(at(x - 0.18, g + 0.12, z + 0.1, 0.18, 0.18, 0.18, cols[d.variant]))
      boxes.push(at(x + 0.16, g + 0.12, z - 0.12, 0.18, 0.18, 0.18, cols[(d.variant + 1) % 3]))
      boxes.push(at(x + 0.02, g + 0.12, z + 0.2, 0.16, 0.16, 0.16, cols[(d.variant + 2) % 3]))
    } else {
      boxes.push(at(x, g, z, 0.1, 2.2, 0.1, C.iron))
      const bulb = at(x, g + 2.2, z, 0.26, 0.26, 0.26, C.lampGlow)
      bulb.glow = true
      boxes.push(bulb)
    }
  }

  // The fountain sits at the exact centre of the stone square (tiles 10 to 15), where the roads cross.
  const fountainParts: Box[] = []
  fountain(fountainParts, pulses, drops)
  for (const b of fountainParts) {
    b.x += wx(12.5)
    b.z += wz(12.5)
    boxes.push(b)
  }

  for (let i = 0; i < 4; i++) {
    const cloud: Box = { x: -18 + i * 11, y: 13 + (i % 2) * 2, z: -10 + i * 6, sx: 2.4, sy: 0.6, sz: 1.2, c: C.cloud }
    boxes.push(cloud)
    clouds.push(cloud)
  }

  // Lamps, the lighthouse beacon and the crystal glow at night too.
  for (const p of pulses) p.box.glow = true

  return { boxes, beacons, windmills, clouds, pulses, drops, markerY, gateBar }
}

// Player parts, in tiles. The character is a child: about 1.55 tiles tall, with short legs.
const SHOE: V3 = [70, 46, 32]
const BELT: V3 = [62, 42, 30]
// Child proportions: short legs and a large head. About 1.55 tiles tall.
const PLAYER_PARTS: Part[] = [
  // Backpack (behind the body, does not move with the walk)
  { ox: 0, oy: 0.87, oz: -0.2, sx: 0.3, sy: 0.42, sz: 0.14, c: [60, 160, 90] },
  // Short legs and shoes
  // Legs run up into the belt, so there is no gap under the torso.
  { ox: -0.1, oy: 0.28, oz: 0, sx: 0.18, sy: 0.56, sz: 0.2, c: C.pants, leg: "L" },
  { ox: 0.1, oy: 0.28, oz: 0, sx: 0.18, sy: 0.56, sz: 0.2, c: C.pants, leg: "R" },
  { ox: -0.1, oy: 0.08, oz: 0.03, sx: 0.2, sy: 0.16, sz: 0.26, c: SHOE, leg: "L" },
  { ox: 0.1, oy: 0.08, oz: 0.03, sx: 0.2, sy: 0.16, sz: 0.26, c: SHOE, leg: "R" },
  // Torso, belt
  { ox: 0, oy: 0.84, oz: 0, sx: 0.42, sy: 0.48, sz: 0.26, c: C.shirt },
  { ox: 0, oy: 0.56, oz: 0, sx: 0.44, sy: 0.08, sz: 0.28, c: BELT },
  // Arms: sleeve and hand, swinging against the legs
  { ox: -0.29, oy: 0.97, oz: 0, sx: 0.12, sy: 0.26, sz: 0.14, c: C.shirt, arm: "L" },
  { ox: 0.29, oy: 0.97, oz: 0, sx: 0.12, sy: 0.26, sz: 0.14, c: C.shirt, arm: "R" },
  { ox: -0.29, oy: 0.76, oz: 0, sx: 0.12, sy: 0.14, sz: 0.14, c: C.skin, arm: "L" },
  { ox: 0.29, oy: 0.76, oz: 0, sx: 0.12, sy: 0.14, sz: 0.14, c: C.skin, arm: "R" },
  // Big round head, hair and fringe
  { ox: 0, oy: 1.33, oz: 0, sx: 0.46, sy: 0.46, sz: 0.46, c: C.skin },
  { ox: 0, oy: 1.54, oz: 0, sx: 0.5, sy: 0.14, sz: 0.5, c: C.hair },
  { ox: 0, oy: 1.47, oz: 0.22, sx: 0.48, sy: 0.1, sz: 0.06, c: C.hair },
  // Face: eyes with pupils, cheeks, smile
  // Eyes: a white, a dark pupil and a small highlight on each
  { ox: -0.1, oy: 1.33, oz: 0.235, sx: 0.1, sy: 0.12, sz: 0.02, c: [255, 255, 255] },
  { ox: 0.1, oy: 1.33, oz: 0.235, sx: 0.1, sy: 0.12, sz: 0.02, c: [255, 255, 255] },
  { ox: -0.1, oy: 1.32, oz: 0.25, sx: 0.07, sy: 0.09, sz: 0.02, c: C.eye },
  { ox: 0.1, oy: 1.32, oz: 0.25, sx: 0.07, sy: 0.09, sz: 0.02, c: C.eye },
  { ox: -0.085, oy: 1.345, oz: 0.265, sx: 0.025, sy: 0.025, sz: 0.01, c: [255, 255, 255] },
  { ox: 0.115, oy: 1.345, oz: 0.265, sx: 0.025, sy: 0.025, sz: 0.01, c: [255, 255, 255] },
  { ox: -0.15, oy: 1.23, oz: 0.235, sx: 0.08, sy: 0.06, sz: 0.02, c: [255, 150, 160] },
  { ox: 0.15, oy: 1.23, oz: 0.235, sx: 0.08, sy: 0.06, sz: 0.02, c: [255, 150, 160] },
  { ox: 0, oy: 1.17, oz: 0.235, sx: 0.15, sy: 0.03, sz: 0.02, c: [150, 50, 50] },
]

export function IslandScene({ calm, paused, commands, onArrive, markers, bridgeOpen, onCutscene }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  // Keep the latest callbacks and settings without rebuilding the scene.
  const latest = useRef({ calm, paused, onArrive, markers, bridgeOpen, onCutscene })
  latest.current = { calm, paused, onArrive, markers, bridgeOpen, onCutscene }

  useEffect(() => {
    const mount = mountRef.current!
    const canvas = document.createElement("canvas")
    canvas.style.width = "100%"
    canvas.style.height = "100%"
    canvas.style.imageRendering = "auto"
    canvas.style.display = "block"
    canvas.style.touchAction = "manipulation"
    mount.appendChild(canvas)
    const renderer = new VoxelRenderer(canvas)

    const flat = buildFlat()
    const blocks = buildBlocks()
    const splash = buildSplashes(flat.water)
    const playerBoxes: Box[] = PLAYER_PARTS.map((p) => ({ x: 0, y: 0, z: 0, sx: p.sx, sy: p.sy, sz: p.sz, c: p.c }))
    const walkTiles: { x: number; z: number }[] = []
    for (const row of MAP) for (const t of row) if (walkable(t.x, t.z)) walkTiles.push({ x: t.x, z: t.z })

    // Logical position (the tile we are on) and visual position (smooth, in world units).
    const logical = { x: START.x, z: START.z }
    const visual = { x: wx(logical.x), y: topAt(logical.x, logical.z), z: wz(logical.z) }
    const queue: { x: number; z: number }[] = []
    let walkTime = 0
    let stride = 0 // 0 when standing, 1 when walking; eases between the two
    let yaw = 0
    const cam = { eye: [visual.x, visual.y + 10, visual.z + 9] as V3, target: [visual.x, visual.y + 1, visual.z] as V3 }

    // The bridge cutscene: while cut is set, the camera tours the bridge and the hall and the player stands still.
    const CUT_LEN = 7 // seconds
    const SEEN_KEY = "study-island-bridge-seen"
    let cut: { t: number } | null = null
    let gateLift = 0 // 0 shut, 1 open; eases between
    const startCut = () => {
      cut = { t: 0 }
      latest.current.onCutscene(true)
    }

    const lastTarget = () => (queue.length ? queue[queue.length - 1] : logical)

    // Held directions, most recent last. The character walks the newest one.
    const held: { id: string; dx: number; dz: number }[] = []
    const heldDir = () => (held.length ? held[held.length - 1] : null)

    const api: IslandCommands = {
      showBridge() {
        if (!cut) startCut()
      },
      hold(id, dx, dz, on) {
        const i = held.findIndex((h) => h.id === id)
        if (on) {
          if (i >= 0) held.splice(i, 1)
          held.push({ id, dx, dz })
          // Turning: drop the tile already queued in the old direction (keep the current one).
          queue.splice(1)
        } else if (i >= 0) {
          held.splice(i, 1)
          queue.splice(1) // stop after the tile we are on
        }
      },
      walkTo(x, z) {
        const path = findPath(logical, { x, z })
        if (path) {
          held.length = 0
          queue.length = 0
          queue.push(...path)
        }
      },
    }
    commands.current = api

    // Keyboard: arrows and WASD. Holding a key keeps walking.
    const keyMap: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      KeyW: [0, -1],
      ArrowDown: [0, 1],
      KeyS: [0, 1],
      ArrowLeft: [-1, 0],
      KeyA: [-1, 0],
      ArrowRight: [1, 0],
      KeyD: [1, 0],
    }
    const onKey = (e: KeyboardEvent) => {
      const d = keyMap[e.code]
      if (!d) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.type === "keydown") {
        if (latest.current.paused) return
        e.preventDefault()
        if (!e.repeat) api.hold(`key-${e.code}`, d[0], d[1], true)
      } else {
        api.hold(`key-${e.code}`, d[0], d[1], false)
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    // Stop walking if the window loses focus while a key is held.
    const onBlur = () => {
      held.length = 0
      queue.splice(1)
    }
    window.addEventListener("blur", onBlur)

    // Tap near a walkable tile to walk there. Pick the tile whose top is closest.
    const onPointer = (e: PointerEvent) => {
      if (latest.current.paused) return
      const rect = canvas.getBoundingClientRect()
      const px = (e.clientX - rect.left) * (canvas.width / rect.width)
      const py = (e.clientY - rect.top) * (canvas.height / rect.height)
      let best: { x: number; z: number } | null = null
      let bestD = 26 // canvas pixels
      for (const t of walkTiles) {
        const s = renderer.project([wx(t.x), topAt(t.x, t.z), wz(t.z)])
        if (!s) continue
        const d = Math.hypot(s[0] - px, s[1] - py)
        if (d < bestD) {
          bestD = d
          best = t
        }
      }
      if (best) api.walkTo(best.x, best.z)
    }
    canvas.addEventListener("pointerdown", onPointer)

    // Size: draw at the screen's real pixel density (capped at 2x) so edges stay sharp.
    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      renderer.resize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)))
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    // ── Main loop ──────────────────────────────────────────────────────────
    // Where each marker floats: the four study buildings and the Exam Hall.
    const marks = [
      ...BUILDINGS.map((b) => ({ key: b.zone, x: wx(b.x0) + 0.5, y: blocks.markerY[b.zone], z: wz(b.z0) + 0.5 })),
      { key: "mock", x: wx(MOCK_HALL.x0) + 0.5, y: blocks.markerY.mock, z: wz(MOCK_HALL.z0) + 0.5 },
    ]
    let raf = 0
    let last = performance.now()
    let time = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      const calmNow = latest.current.calm

      // While a direction is held, keep one tile queued ahead so there is no pause between tiles.
      const h = heldDir()
      if (!cut && h && queue.length < 2) {
        const from = lastTarget()
        const nx = from.x + h.dx
        const nz = from.z + h.dz
        if (walkable(nx, nz)) queue.push({ x: nx, z: nz })
      }

      // Walking toward the next tile in the queue.
      const dest = queue[0]
      let moving = false
      if (dest && !cut) {
        const tx = wx(dest.x)
        const tz = wz(dest.z)
        const dx = tx - visual.x
        const dz = tz - visual.z
        const dist = Math.hypot(dx, dz)
        const step = MOVE_SPEED * dt * (calmNow ? 0.6 : 1)
        if (dist <= step) {
          visual.x = tx
          visual.z = tz
          logical.x = dest.x
          logical.z = dest.z
          queue.shift()
          latest.current.onArrive(dest.x, dest.z)
        } else {
          visual.x += (dx / dist) * step
          visual.z += (dz / dist) * step
          moving = true
        }
        // Turn smoothly toward the direction of travel.
        const want = Math.atan2(dx, dz)
        let diff = want - yaw
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        yaw += diff * Math.min(1, dt * 14)
      }

      // The stride eases in when walking starts and out when it stops, so limbs never snap.
      stride += ((moving ? 1 : 0) - stride) * Math.min(1, dt * 9)
      if (moving) walkTime += dt * 11
      const step = Math.sin(walkTime) * stride // the left leg's swing, -1..1
      // A soft bob: the body rises a little on each step and settles between them.
      const bob = calmNow ? 0 : (1 - Math.cos(walkTime * 2)) * 0.5 * 0.06 * stride

      // The character stands on the ground under it, so it climbs the hills.
      visual.y = groundAt(visual.x, visual.z)

      // Place the player's blocks, turned to face the walking direction.
      const cs = Math.cos(yaw)
      const sn = Math.sin(yaw)
      PLAYER_PARTS.forEach((p, i) => {
        // The left leg and right arm swing together; the right leg and left arm opposite them.
        const right = p.leg === "R" || p.arm === "R"
        const s = right ? -step : step
        const legZ = p.leg ? s * 0.3 : p.arm ? -s * 0.22 : 0
        // A shoe lifts while its leg swings forward.
        const legPhase = right ? walkTime + Math.PI : walkTime
        const foot = p.leg && p.sy < 0.2 ? Math.max(0, Math.cos(legPhase)) * 0.06 * stride : 0
        const ox = p.ox
        const oz = p.oz + legZ
        const b = playerBoxes[i]
        b.x = visual.x + ox * cs + oz * sn
        b.y = visual.y + p.oy + bob + foot
        b.z = visual.z - ox * sn + oz * cs
      })

      // The gate: it opens when all four lessons are done. The first time, the camera tours the bridge.
      if (!cut && latest.current.bridgeOpen && !latest.current.paused && !localStorage.getItem(SEEN_KEY)) {
        localStorage.setItem(SEEN_KEY, "1")
        startCut()
      }
      setBridgeOpen(latest.current.bridgeOpen)
      gateLift += ((latest.current.bridgeOpen ? 1 : 0) - gateLift) * Math.min(1, dt * 1.5)
      blocks.gateBar.y = GROUND_Y + 0.16 + gateLift * 0.9

      if (cut) {
        cut.t += dt
        const p = Math.min(1, cut.t / CUT_LEN)
        const { focus, zoom } = cutscenePose(p, visual.x, visual.z)
        cam.target = [focus[0], focus[1], focus[2]]
        cam.eye = [focus[0], focus[1] + 10 + 9 * zoom, focus[2] + 9 + 8 * zoom]
        if (p >= 1) {
          cut = null
          latest.current.onCutscene(false)
        }
      } else {
        // Camera follows the player smoothly.
        const follow = calmNow ? 0.03 : 0.08
        const gx = visual.x
        const gy = visual.y + 10
        const gz = visual.z + 9
        cam.eye = [cam.eye[0] + (gx - cam.eye[0]) * follow, cam.eye[1] + (gy - cam.eye[1]) * follow, cam.eye[2] + (gz - cam.eye[2]) * follow]
        cam.target = [visual.x, visual.y + 1, visual.z]
      }

      // Floating motion, spinning and glowing (turned off in calm mode).
      if (!calmNow) {
        for (const b of blocks.beacons) b.box.y = b.base + Math.sin(time * 2) * 0.2
        for (const d of blocks.drops) {
          const k = (time * 0.9 + d.phase) % 1
          d.box.y = d.base + Math.sin(k * Math.PI) * 0.45
          d.box.hidden = k > 0.85
        }
        for (const c of blocks.clouds) {
          c.x += dt * 0.6
          if (c.x > 26) c.x = -30
        }
        // Windmill blades: four tips turning around the hub.
        for (const m of blocks.windmills) {
          m.blades.forEach((b, k) => {
            const a = time * 1.6 + (k * Math.PI) / 2
            b.x = m.hx + Math.cos(a) * 0.42
            b.y = m.hy + Math.sin(a) * 0.42
            b.z = m.hz
          })
        }
        // Lighthouse lamp and temple crystal pulse between two shades.
        for (const p of blocks.pulses) p.box.c = Math.sin(time * 3) > 0 ? p.a : p.b
        // Shimmer: alternate the two water blues in slow waves.
        for (const q of flat.water) {
          const wave = Math.sin(time * 2 + q.pts[0][0] * 0.6 + q.pts[0][2] * 0.4)
          q.c = wave > 0 ? WATER_B : WATER_A
        }
      }

      updateSplashes(splash.splashes, time, calmNow)

      // Day and night: the sky, the light tint and the stars follow the clock.
      renderer.render(cam, { ...dayEnv(dayClock()), time }, [...flat.water, ...flat.polys], [...blocks.boxes, ...splash.boxes, ...playerBoxes])

      // Move each zone marker to float above its building (canvas px -> CSS px).
      const cssScale = mount.clientWidth / Math.max(1, canvas.width)
      for (const m of marks) {
        const el = latest.current.markers.current[m.key]
        if (!el) continue
        const p = renderer.project([m.x, m.y, m.z])
        if (!p) {
          el.style.display = "none"
          continue
        }
        // Keep the label fully on screen even when its building is at the edge.
        const mx = Math.min(Math.max(p[0] * cssScale, 96), mount.clientWidth - 96)
        const my = Math.min(Math.max(p[1] * cssScale, 170), mount.clientHeight - 280)
        el.style.display = ""
        el.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -100%)`
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    // Report the start tile once on load.
    latest.current.onArrive(logical.x, logical.z)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
      window.removeEventListener("blur", onBlur)
      canvas.removeEventListener("pointerdown", onPointer)
      commands.current = null
      canvas.remove()
    }
    // The scene is built once; settings and callbacks are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={mountRef} className="absolute inset-0 overflow-hidden" />
}
