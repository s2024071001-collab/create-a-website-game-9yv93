import { useSyncExternalStore } from "react"
import type { ZoneId } from "@/lib/lessons"

// Small local store (no sign-in needed for the prototype). Settings and
// progress live in localStorage so they survive a reload.

export type Settings = {
  dyslexiaFont: boolean // Lexend font, wider spacing
  largeText: boolean // bigger base text size
  calmMode: boolean // slower camera, no bobbing or floating motion
  readAloud: boolean // speak questions automatically
}

export type Progress = {
  points: number // points from lessons
  done: ZoneId[] // zones with a finished lesson
  mockBest: number // best score on the mock test (questions right)
  mockTotal: number // questions in that test
}

const SETTINGS_KEY = "study-island-settings"
const PROGRESS_KEY = "study-island-progress"

const defaultSettings: Settings = {
  dyslexiaFont: false,
  largeText: false,
  calmMode: false,
  readAloud: false,
}
const defaultProgress: Progress = { points: 0, done: [], mockBest: 0, mockTotal: 0 }

function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) || "{}") }
  } catch {
    return fallback
  }
}

function createStore<T>(key: string, fallback: T) {
  let state = load(key, fallback)
  const listeners = new Set<() => void>()
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }
  const get = () => state
  const set = (next: Partial<T>) => {
    state = { ...state, ...next }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(state))
    }
    listeners.forEach((l) => l())
  }
  return { subscribe, get, set, fallback }
}

const settingsStore = createStore<Settings>(SETTINGS_KEY, defaultSettings)
const progressStore = createStore<Progress>(PROGRESS_KEY, defaultProgress)

export function useSettings(): Settings {
  return useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    () => settingsStore.fallback,
  )
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settingsStore.set({ [key]: value } as Partial<Settings>)
}

export function useProgress(): Progress {
  return useSyncExternalStore(
    progressStore.subscribe,
    progressStore.get,
    () => progressStore.fallback,
  )
}

export function finishLesson(zone: ZoneId, points: number) {
  const p = progressStore.get()
  progressStore.set({
    points: p.points + points,
    done: p.done.includes(zone) ? p.done : [...p.done, zone],
  })
}

// Read text out loud with the browser's built-in voice. No backend needed.
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.85
  window.speechSynthesis.speak(u)
}

// Records a finished mock test. Keeps the best score.
export function finishMock(score: number, total: number) {
  const p = progressStore.get()
  if (score >= p.mockBest) progressStore.set({ mockBest: score, mockTotal: total })
}

// The mock test opens once every corner's lesson is done.
export function allLessonsDone(progress: Progress, zoneIds: ZoneId[]) {
  return zoneIds.every((id) => progress.done.includes(id))
}
