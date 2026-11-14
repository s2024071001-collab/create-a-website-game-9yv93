import { useEffect, useRef, useState } from "react"
import { Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { speak, useSettings } from "@/lib/store"
import type { Zone } from "@/lib/lessons"

// Shared pieces for every mini game.

export type GameProps = { zone: Zone; onEnd: (points: number) => void }
export type Over = "playing" | "won" | "lost"

// Runs `onFrame(dt)` every animation frame while enabled.
export function useFrames(enabled: boolean, onFrame: (dt: number) => void) {
  const ref = useRef(onFrame)
  ref.current = onFrame
  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ref.current(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
}

// Reports the score once, when the game leaves "playing".
export function useEndReport(over: Over, points: number, onEnd: (p: number) => void) {
  useEffect(() => {
    if (over === "playing") return
    // Wait a moment so the final CORRECT! or WRONG text can be seen before the results.
    const t = window.setTimeout(() => onEnd(points), 1100)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over])
}

// Speaks `text` when `key` changes, if the read-aloud setting is on.
export function useReadAloud(text: string | null, key: number) {
  const { readAloud } = useSettings()
  useEffect(() => {
    if (readAloud && text) speak(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function SayButton({ text }: { text: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => speak(text)} aria-label={`Read aloud: ${text}`}>
      <Volume2 className="size-4" />
      Read aloud
    </Button>
  )
}

export function Hud({ round, total, lives }: { round: number; total: number; lives?: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Question {Math.min(round + 1, total)} of {total}
      </span>
      {lives !== undefined && <span>Lives: {lives}</span>}
    </div>
  )
}

export function Feedback({ text }: { text: string }) {
  return (
    <p className="min-h-10 p-3 text-sm font-semibold" style={{ ...pixel, background: PAL.white }}>
      {text || "\u00a0"}
    </p>
  )
}

export function PromptRow({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-lg font-medium leading-snug">{text}</p>
      <SayButton text={text} />
    </div>
  )
}

// Each mini game has its own motion (added by class). Turn it all off in calm mode.
export function GameStyles() {
  return (
    <style>{`
      .sg-sway { animation: sg-sway 3.2s ease-in-out infinite; }
      .sg-hang { transform-origin: 50% 0; animation: sg-hang 2.6s ease-in-out infinite; }
      .sg-bob { animation: sg-bob 2.4s ease-in-out infinite; }
      .sg-ring { animation: sg-ring 0.6s ease-out forwards; }
      .sg-flip { animation: sg-flip 0.35s ease-out; }
      .sg-shake { animation: sg-shake 0.4s ease-in-out; }
      .sg-recoil { animation: sg-recoil 0.3s ease-out; }
      .sg-drift { animation: sg-drift 26s ease-in-out infinite alternate; }
      @keyframes sg-drift { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
      @keyframes sg-sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
      @keyframes sg-hang { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
      @keyframes sg-bob { 0%, 100% { transform: translateY(-3px); } 50% { transform: translateY(3px); } }
      @keyframes sg-ring { from { transform: scale(0.3); opacity: 1; } to { transform: scale(2.4); opacity: 0; } }
      @keyframes sg-flip { from { transform: rotateY(90deg); } to { transform: rotateY(0); } }
      @keyframes sg-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
      @keyframes sg-recoil { 0% { transform: translateY(0); } 40% { transform: translateY(6px); } 100% { transform: translateY(0); } }
      .sg-pop { animation: sg-pop 0.35s ease-out; }
      .sg-burst { animation: sg-burst 0.6s ease-out forwards; }
      @keyframes sg-burst { from { transform: translate(0, 0) scale(1.3); opacity: 1; } to { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; } }
      @keyframes sg-pop { 0% { transform: scale(0.4); } 60% { transform: scale(1.12); } 100% { transform: scale(1); } }
      .sg-calm .sg-drift, .sg-calm .sg-sway, .sg-calm .sg-hang, .sg-calm .sg-bob, .sg-calm .sg-ring, .sg-calm .sg-flip, .sg-calm .sg-shake, .sg-calm .sg-recoil, .sg-calm .sg-pop, .sg-calm .sg-burst { animation: none !important; }
    `}</style>
  )
}

// 8-bit look: a bright palette, hard black outlines and blocky shadows.
export const PAL = {
  ink: "#1b1b2f",
  white: "#fff8e7",
  red: "#ff4d6d",
  yellow: "#ffd23f",
  green: "#3bd671",
  blue: "#3a86ff",
  purple: "#8338ec",
  pink: "#ff8fab",
  mint: "#8ff0d0",
  orange: "#ff9f1c",
  sky: "#7fd8ff",
  wood: "#c98b4b",
}

export const pixel = { border: `4px solid ${PAL.ink}`, boxShadow: `4px 4px 0 ${PAL.ink}` } as const
export const pixelFont = { fontFamily: "'Press Start 2P', ui-monospace, monospace" } as const

export type Verdict = { k: number; ok: boolean } | null

// Reports a new verdict whenever the number of correct answers or wrong answers goes up.
export function useVerdict(correct: number, wrong: number): Verdict {
  const [v, setV] = useState<Verdict>(null)
  const prev = useRef({ correct, wrong })
  useEffect(() => {
    if (correct !== prev.current.correct) setV({ k: Date.now(), ok: true })
    else if (wrong !== prev.current.wrong) setV({ k: Date.now(), ok: false })
    prev.current = { correct, wrong }
  }, [correct, wrong])
  return v
}

// A big bold CORRECT! or WRONG over the game for a moment. Put it in a `relative` parent.
export function VerdictBanner({ v }: { v: Verdict }) {
  const [show, setShow] = useState(false)
  const k = v?.k
  useEffect(() => {
    if (k === undefined) return
    setShow(true)
    const t = window.setTimeout(() => setShow(false), 1100)
    return () => window.clearTimeout(t)
  }, [k])
  if (!v || !show) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" role="status" aria-live="assertive">
      <div
        key={v.k}
        className="sg-pop px-5 py-4 text-center"
        style={{
          ...pixel,
          ...pixelFont,
          background: v.ok ? PAL.green : PAL.red,
          color: PAL.white,
          fontSize: "2rem",
          lineHeight: 1.2,
          textShadow: `4px 4px 0 ${PAL.ink}`,
        }}
      >
        {v.ok ? "CORRECT!" : "WRONG"}
      </div>
    </div>
  )
}

// Pop effect: a correct answer bursts into colored squares and a ring; a wrong one only rings red.
export type Pop = { k: number; x: number; y: number; ok: boolean }

const BURST_COLORS = [PAL.yellow, PAL.pink, PAL.green, PAL.blue, PAL.mint, PAL.orange, PAL.white, PAL.red]

export function usePops() {
  const [pops, setPops] = useState<Pop[]>([])
  const add = (x: number, y: number, ok: boolean) => {
    const k = Date.now() + Math.random()
    setPops((list) => [...list, { k, x, y, ok }])
    window.setTimeout(() => setPops((list) => list.filter((p) => p.k !== k)), 700)
  }
  return [pops, add] as const
}

// Place inside a `relative` box. Positions are percentages of that box.
export function PopBurst({ pops }: { pops: Pop[] }) {
  return (
    <>
      {pops.map((p) => (
        <span key={p.k} className="pointer-events-none absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-hidden="true">
          {p.ok ? (
            <>
              <span className="sg-ring absolute -ml-10 -mt-10 size-20 rounded-full border-4" style={{ borderColor: PAL.green }} />
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4
                return (
                  <span
                    key={i}
                    className="sg-burst absolute -ml-1.5 -mt-1.5 size-3"
                    style={
                      {
                        background: BURST_COLORS[i],
                        border: `2px solid ${PAL.ink}`,
                        "--dx": `${Math.round(Math.cos(a) * 52)}px`,
                        "--dy": `${Math.round(Math.sin(a) * 52)}px`,
                      } as React.CSSProperties
                    }
                  />
                )
              })}
            </>
          ) : (
            <span className="sg-ring absolute -ml-10 -mt-10 size-20 rounded-full border-4" style={{ borderColor: PAL.red }} />
          )}
        </span>
      ))}
    </>
  )
}
