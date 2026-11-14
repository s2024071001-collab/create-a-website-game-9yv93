// A small, dependency-free 3D renderer for a blocky town.
//
// Two kinds of geometry:
//  - polys: flat 4-point faces (ground, water, island walls). They never need
//    depth sorting, so they are drawn in the order given. This is the cheap part.
//  - boxes: solid blocks (buildings, trees, characters). Only their visible
//    faces are sorted back to front (painter's algorithm).
// The canvas is drawn at a low resolution and scaled up with CSS (8-bit look).

export type V3 = [number, number, number]

export type Box = {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  c: V3
  hidden?: boolean
  glow?: boolean // lit from within: keeps its colour at night
}

export type Poly = {
  pts: V3[] // four corners in order
  n: V3 // outward normal, used to skip faces pointing away
  c: V3
  light: number
}

type Corner = [number, number, number]

const FACES: { n: V3; corners: Corner[]; light: number }[] = [
  { n: [0, 1, 0], light: 1.0, corners: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, -1, 0], light: 0.5, corners: [[-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, -1, -1]] },
  { n: [1, 0, 0], light: 0.8, corners: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]] },
  { n: [-1, 0, 0], light: 0.7, corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { n: [0, 0, 1], light: 0.62, corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { n: [0, 0, -1], light: 0.62, corners: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]] },
]

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

export type Camera = { eye: V3; target: V3 }

// The look of the sky and light: horizon (also the fog colour), zenith, a light tint, and stars.
export type Env = { horizon: V3; zenith: V3; tint: V3; stars: number; time: number }

// Fixed star positions across the upper sky (x and y as fractions, size in px at 400 px wide).
const STARS: [number, number, number][] = Array.from({ length: 70 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453
  const b = Math.sin(i * 78.233) * 43758.5453
  return [a - Math.floor(a), b - Math.floor(b), i % 5 === 0 ? 2 : 1]
})

export class VoxelRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private w = 1
  private h = 1
  private view = { eye: [0, 0, 0] as V3, f: [0, 0, 1] as V3, r: [1, 0, 0] as V3, u: [0, 1, 0] as V3, focal: 1 }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")!
  }

  resize(w: number, h: number) {
    this.w = w
    this.h = h
    this.canvas.width = w
    this.canvas.height = h
  }

  // Project a world point to canvas pixels using the last rendered camera.
  project(p: V3): [number, number] | null {
    const { eye, f, r, u, focal } = this.view
    const d = sub(p, eye)
    const zc = dot(d, f)
    if (zc < 0.5) return null
    return [this.w / 2 + (dot(d, r) / zc) * focal, this.h / 2 - (dot(d, u) / zc) * focal]
  }

  render(cam: Camera, env: Env, polys: Poly[], boxes: Box[]) {
    const { w, h } = this
    const { horizon: sky, zenith, tint, stars, time } = env
    const ctx = this.ctx
    const eye = cam.eye
    const f = norm(sub(cam.target, eye))
    // Right-handed camera basis (right, up, forward). Getting this order wrong
    // mirrors the whole picture left to right.
    const r = norm(cross(f, [0, 1, 0]))
    const u = cross(r, f)
    const focal = h * 0.95
    this.view = { eye, f, r, u, focal }

    const project = (p: V3): [number, number, number] | null => {
      const d = sub(p, eye)
      const zc = dot(d, f)
      if (zc < 0.5) return null
      return [w / 2 + (dot(d, r) / zc) * focal, h / 2 - (dot(d, u) / zc) * focal, zc]
    }

    // Fade distant things into the sky colour for depth.
    const shade = (c: V3, light: number, depth: number, lit = false) => {
      const fog = Math.min(0.85, Math.max(0, (depth - 16) / 18))
      const t = lit ? [1, 1, 1] : tint
      const mix = (k: number) => c[k] * light * t[k] * (1 - fog) + sky[k] * fog
      return `rgb(${mix(0) | 0},${mix(1) | 0},${mix(2) | 0})`
    }

    // Background (sky): a gradient from the zenith down to the horizon colour.
    const css = (c: V3) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, css(zenith))
    grad.addColorStop(0.5, css(sky))
    grad.addColorStop(1, css(sky))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Stars fade in at night and twinkle at slightly different times.
    if (stars > 0.02) {
      ctx.fillStyle = "#ffffff"
      STARS.forEach(([sx, sy, size], i) => {
        ctx.globalAlpha = stars * (0.55 + 0.45 * Math.sin(time * 2 + i * 1.7))
        const s = Math.max(1, Math.round((size * w) / 400))
        ctx.fillRect(sx * w, sy * h * 0.5, s, s)
      })
      ctx.globalAlpha = 1
    }

    const fillPoly = (pts: [number, number][], fill: string) => {
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.strokeStyle = fill
      ctx.fill()
      ctx.stroke()
    }

    // Flat layer: water, walls and ground. No sorting needed.
    ctx.lineWidth = 0.6
    for (const poly of polys) {
      const c = poly.n
      // Skip faces that point away from the camera.
      const mid: V3 = [
        (poly.pts[0][0] + poly.pts[2][0]) / 2,
        (poly.pts[0][1] + poly.pts[2][1]) / 2,
        (poly.pts[0][2] + poly.pts[2][2]) / 2,
      ]
      if (dot(c, sub(eye, mid)) <= 0) continue
      const screen: [number, number][] = []
      let depth = 0
      let ok = true
      for (const p of poly.pts) {
        const s = project(p)
        if (!s) {
          ok = false
          break
        }
        screen.push([s[0], s[1]])
        depth += s[2]
      }
      if (!ok) continue
      fillPoly(screen, shade(poly.c, poly.light, depth / 4))
    }

    // Solid boxes: gather visible faces, sort back to front, then fill.
    type Face = { pts: [number, number][]; depth: number; fill: string }
    const faces: Face[] = []
    const LIMIT = 30
    for (const b of boxes) {
      if (b.hidden) continue
      const dx = b.x - eye[0]
      const dy = b.y - eye[1]
      const dz = b.z - eye[2]
      if (dx * dx + dy * dy + dz * dz > LIMIT * LIMIT) continue
      const half: V3 = [b.sx / 2, b.sy / 2, b.sz / 2]
      for (const face of FACES) {
        const fc: V3 = [b.x + face.n[0] * half[0], b.y + face.n[1] * half[1], b.z + face.n[2] * half[2]]
        if (dot(face.n, sub(eye, fc)) <= 0) continue
        const pts: [number, number][] = []
        let ok = true
        for (const c of face.corners) {
          const p = project([b.x + c[0] * half[0], b.y + c[1] * half[1], b.z + c[2] * half[2]])
          if (!p) {
            ok = false
            break
          }
          pts.push([p[0], p[1]])
        }
        if (!ok) continue
        const depth = project(fc)?.[2] ?? 0
        faces.push({ pts, depth, fill: shade(b.c, face.light, depth, !!b.glow) })
      }
    }
    faces.sort((a, b) => b.depth - a.depth)
    for (const face of faces) fillPoly(face.pts, face.fill)
  }
}
