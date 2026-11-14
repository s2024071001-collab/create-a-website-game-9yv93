// Day and night for the island. One day lasts ten minutes of real time. The day starts at
// morning on the first visit and keeps going across reloads.
import type { V3 } from "@/game/voxelRenderer"

export const DAY_MS = 10 * 60 * 1000
const START_KEY = "study-island-day-start"

// Fraction of the day (0 = morning) -> the sky, the light tint and how many stars show.
type Key = { t: number; zenith: V3; horizon: V3; tint: V3; stars: number }
const KEYS: Key[] = [
  { t: 0.0, zenith: [120, 196, 255], horizon: [190, 234, 255], tint: [1, 1, 1], stars: 0 }, // bright morning
  { t: 0.28, zenith: [130, 190, 245], horizon: [255, 236, 180], tint: [1, 0.97, 0.88], stars: 0 }, // cozy afternoon
  { t: 0.5, zenith: [110, 96, 170], horizon: [255, 170, 100], tint: [1, 0.84, 0.66], stars: 0 }, // evening, orange
  { t: 0.6, zenith: [84, 70, 140], horizon: [255, 120, 80], tint: [0.95, 0.7, 0.6], stars: 0 }, // sunset deepens
  { t: 0.72, zenith: [26, 30, 70], horizon: [90, 60, 120], tint: [0.55, 0.55, 0.8], stars: 0.5 }, // dusk
  { t: 0.85, zenith: [8, 12, 36], horizon: [24, 30, 66], tint: [0.4, 0.44, 0.72], stars: 1 }, // starry night
  { t: 0.94, zenith: [8, 12, 36], horizon: [24, 30, 66], tint: [0.4, 0.44, 0.72], stars: 1 }, // night holds
  { t: 1.0, zenith: [120, 196, 255], horizon: [190, 234, 255], tint: [1, 1, 1], stars: 0 }, // back to morning
]

// Where we are in the day, 0..1, from the first visit.
export function dayClock(now = Date.now()): number {
  if (typeof window === "undefined") return 0
  let start = Number(window.localStorage.getItem(START_KEY))
  if (!start) {
    start = now
    window.localStorage.setItem(START_KEY, String(now))
  }
  return (((now - start) % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS
}

const smooth = (x: number) => x * x * (3 - 2 * x)
const mixV = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

export type DayEnv = { zenith: V3; horizon: V3; tint: V3; stars: number }

// The sky and light for a point in the day, blended smoothly between the keys.
export function dayEnv(t: number): DayEnv {
  let i = 0
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const k = smooth(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))))
  return {
    zenith: mixV(a.zenith, b.zenith, k),
    horizon: mixV(a.horizon, b.horizon, k),
    tint: mixV(a.tint, b.tint, k),
    stars: a.stars + (b.stars - a.stars) * k,
  }
}

// A short name for the time of day, shown in the island status box.
export function phaseName(t: number): string {
  if (t < 0.28) return "Morning"
  if (t < 0.5) return "Afternoon"
  if (t < 0.7) return "Evening"
  if (t < 0.92) return "Night"
  return "Morning"
}
