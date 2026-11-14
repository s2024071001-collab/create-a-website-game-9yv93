import { useEffect, useReducer } from "react"
import { Button } from "@/components/ui/button"
import type { Choice } from "@/lib/lessons"
import {
  Feedback,
  GameStyles,
  Hud,
  PAL,
  PopBurst,
  PromptRow,
  pixel,
  shuffle,
  useEndReport,
  useFrames,
  useReadAloud,
  usePops,
  useVerdict,
  VerdictBanner,
  type GameProps,
  type Over,
} from "@/games/shared"
import { SceneDecor } from "@/games/scenery"

// Arrow Archery (Archer's Grove): each answer hangs on a target. Aim the bow left or
// right, hold Shoot to draw the string back, and let go to fire at the target with the
// right answer. The boards sway slowly and a missed arrow costs nothing.
// Keys: A/D or arrows to aim, hold Space to draw and let go to fire.

const LIMIT_L = 8
const LIMIT_R = 92
const AIM_SPEED = 40 // percent per second
const ARROW_SPEED = 100 // percent per second: a quick flight up after the release
const ARROW_START = 89 // where the arrow sits on the string at rest (centre, percent)
const DRAW_SLIDE = 3 // how far the arrow slides down the bow at full draw (percent)
const DRAW_SPEED = 1.4 // full draw per second
const HIT_HALF = 8 // how close (percent) the arrow must pass to hit a board

type Board = { id: number; label: string; ok: boolean; bx: number; row: number; phase: number }
type Arrow = { x: number; y: number }
type Fx = { id: number; x: number; y: number; ok: boolean; until: number; key: number }
type State = {
  round: number
  lives: number
  correct: number
  boards: Board[]
  aim: number
  aimDir: -1 | 0 | 1
  drawing: boolean
  draw: number // 0 (string at rest) to 1 (fully drawn)
  arrow: Arrow | null
  t: number
  fx: Fx | null
  shots: number
  feedback: string
  over: Over
  seq: number
}
type Action = { t: "tick"; dt: number } | { t: "aim"; dir: -1 | 0 | 1 } | { t: "draw"; on: boolean }

// Board positions: one row for two answers, two rows for three or four so the labels fit.
function layout(n: number): { bx: number; row: number }[] {
  if (n <= 1) return [{ bx: 50, row: 22 }]
  if (n === 2) return [{ bx: 30, row: 22 }, { bx: 70, row: 22 }]
  if (n === 3) return [{ bx: 22, row: 19 }, { bx: 78, row: 19 }, { bx: 50, row: 44 }]
  return [{ bx: 25, row: 19 }, { bx: 75, row: 19 }, { bx: 25, row: 44 }, { bx: 75, row: 44 }]
}

function boardsFor(q: Choice, seq: number): Board[] {
  const spots = layout(q.options.length)
  return shuffle(q.options).map((label, i) => ({
    id: seq * 10 + i,
    label,
    ok: label === q.answer,
    bx: spots[i].bx,
    row: spots[i].row,
    phase: i * 1.7 + seq,
  }))
}

// Boards sway side to side, slowly.
const boardX = (b: Board, t: number) => b.bx + Math.sin(t * 0.9 + b.phase) * 5

function reduce(s: State, a: Action, qs: Choice[]): State {
  if (s.over !== "playing") return s
  if (a.t === "aim") return { ...s, aimDir: a.dir }
  if (a.t === "draw") {
    if (a.on) return s.arrow ? s : { ...s, drawing: true }
    // Let go: fire if the string was drawn, otherwise do nothing.
    if (!s.drawing) return s
    if (s.arrow) return { ...s, drawing: false, draw: 0 }
    return { ...s, drawing: false, draw: 0, arrow: { x: s.aim, y: ARROW_START + s.draw * DRAW_SLIDE }, shots: s.shots + 1, fx: null }
  }

  // tick
  const t = s.t + a.dt
  const aim = Math.max(LIMIT_L, Math.min(LIMIT_R, s.aim + s.aimDir * AIM_SPEED * a.dt))
  const draw = s.drawing ? Math.min(1, s.draw + DRAW_SPEED * a.dt) : s.draw
  const fx = s.fx && t < s.fx.until ? s.fx : null
  const base = { ...s, t, aim, fx, draw }
  if (!s.arrow) return base

  const x = s.arrow.x
  const y = s.arrow.y - ARROW_SPEED * a.dt
  // Hit test: the arrow is passing a board's height.
  const hit = s.boards.find((b) => y <= b.row + 6 && y >= b.row - 8 && Math.abs(x - boardX(b, t)) <= HIT_HALF)
  if (hit) {
    const fxNew: Fx = { id: hit.id, x: boardX(hit, t), y: hit.row, ok: hit.ok, until: t + 0.7, key: Math.round(t * 1000) }
    if (hit.ok) {
      const round = s.round + 1
      if (round >= qs.length) {
        return { ...base, arrow: null, round, correct: s.correct + 1, boards: [], fx: fxNew, over: "won", feedback: "Bullseye! All questions done." }
      }
      return {
        ...base,
        arrow: null,
        round,
        correct: s.correct + 1,
        boards: boardsFor(qs[round], s.seq + 1),
        seq: s.seq + 1,
        fx: fxNew,
        feedback: "Bullseye! That's the right answer.",
      }
    }
    const lives = s.lives - 1
    return {
      ...base,
      arrow: null,
      lives,
      boards: s.boards.filter((b) => b.id !== hit.id),
      fx: fxNew,
      feedback: `Not that one. Hint: ${qs[s.round].hint}`,
      over: lives <= 0 ? "lost" : "playing",
    }
  }
  // Flew past the top with nothing hit: just aim again, no penalty.
  if (y < -5) {
    return {
      ...base,
      arrow: null,
      fx: { id: -1, x, y: 6, ok: false, until: t + 0.5, key: Math.round(t * 1000) },
      feedback: "Missed. Aim again!",
    }
  }
  return { ...base, arrow: { x, y } }
}

// Answer boards: red, white and blue rings, like a real archery target.
function Target() {
  return (
    <div className="sg-bob relative size-14 rounded-full p-1" style={{ background: PAL.white, border: `4px solid ${PAL.ink}`, boxShadow: `3px 3px 0 ${PAL.ink}` }}>
      <div className="absolute inset-1 rounded-full" style={{ background: PAL.red }} />
      <div className="absolute inset-3 rounded-full" style={{ background: PAL.white }} />
      <div className="absolute inset-4 rounded-full" style={{ background: PAL.blue }} />
      <div className="absolute inset-[1.1rem] rounded-full" style={{ background: PAL.yellow, border: `2px solid ${PAL.ink}` }} />
    </div>
  )
}

// The longbow, seen from behind the archer and facing up at the targets. Its limbs arch
// up and the string runs across the bottom, with the nocked arrow pointing up from it.
// Drawing pulls the string and the arrow down toward the archer and bends the limbs further.
function Bow({ draw, nocked }: { draw: number; nocked: boolean }) {
  const limb = `M 4 30 Q 40 ${6 - draw * 4} 76 30`
  const apexY = 30 + draw * 8 // the string's centre, pulled toward the archer
  return (
    <svg width="96" height="48" viewBox="0 0 80 40" overflow="visible" aria-hidden="true">
      {/* Limbs: a dark outline with a lighter wood core */}
      <path d={limb} fill="none" stroke={PAL.ink} strokeWidth="7" strokeLinecap="round" />
      <path d={limb} fill="none" stroke={PAL.wood} strokeWidth="3.5" strokeLinecap="round" />
      {/* Grip wrap at the middle of the bow */}
      <rect x="36" y="13" width="8" height="10" fill={PAL.orange} stroke={PAL.ink} strokeWidth="1.5" />
      {/* String across the bottom, pulled down by the draw */}
      <path d={`M 4 30 L 40 ${apexY} L 76 30`} fill="none" stroke={PAL.ink} strokeWidth="1.2" />
      {nocked && (
        // The arrow rests with its nock on the string: the same offset as the string's centre.
        <g transform={`translate(0 ${draw * 8})`}>
          <line x1="40" y1="30" x2="40" y2="-22" stroke={PAL.ink} strokeWidth="3" />
          <line x1="40" y1="30" x2="40" y2="-22" stroke={PAL.wood} strokeWidth="1.4" />
          <polygon points="37,-18 43,-18 40,-26" fill={PAL.red} stroke={PAL.ink} strokeWidth="1" />
        </g>
      )}
    </svg>
  )
}

export function ArcheryRange({ zone, onEnd }: GameProps) {
  const qs = zone.questions
  const [s, d] = useReducer(
    (st: State, a: Action) => reduce(st, a, qs),
    undefined,
    (): State => ({
      round: 0,
      lives: 3,
      correct: 0,
      boards: boardsFor(qs[0], 0),
      aim: 50,
      aimDir: 0,
      drawing: false,
      draw: 0,
      arrow: null,
      t: 0,
      fx: null,
      shots: 0,
      feedback: "",
      over: "playing",
      seq: 0,
    }),
  )
  const verdict = useVerdict(s.correct, 3 - s.lives)
  const [pops, addPop] = usePops()
  useFrames(s.over === "playing", (dt) => d({ t: "tick", dt }))
  useEndReport(s.over, s.correct, onEnd)
  useReadAloud(s.over === "playing" ? qs[s.round].prompt : null, s.round)

  // A hit on a board pops. A miss past the top does not.
  useEffect(() => {
    if (s.fx && s.fx.id !== -1) addPop(s.fx.x, s.fx.y, s.fx.ok)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.fx?.key])

  // Keys: A/D or arrows to aim (hold), hold Space or Enter to draw, let go to fire.
  useEffect(() => {
    const aimKey = (code: string) => (code === "ArrowLeft" || code === "KeyA" ? -1 : code === "ArrowRight" || code === "KeyD" ? 1 : 0)
    const isShoot = (code: string) => code === "Space" || code === "Enter"
    const down = (e: KeyboardEvent) => {
      const dir = aimKey(e.code)
      if (dir !== 0) {
        e.preventDefault()
        d({ t: "aim", dir })
      } else if (isShoot(e.code) && !e.repeat) {
        e.preventDefault()
        d({ t: "draw", on: true })
      }
    }
    const up = (e: KeyboardEvent) => {
      if (aimKey(e.code) !== 0) d({ t: "aim", dir: 0 })
      else if (isShoot(e.code)) d({ t: "draw", on: false })
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  const aimButton = (dir: -1 | 1, label: string) => ({
    onPointerDown: () => d({ t: "aim", dir }),
    onPointerUp: () => d({ t: "aim", dir: 0 }),
    onPointerLeave: () => d({ t: "aim", dir: 0 }),
    onPointerCancel: () => d({ t: "aim", dir: 0 }),
    "aria-label": label,
  })

  // Press and hold to draw; let go to fire.
  const shootButton = {
    onPointerDown: () => d({ t: "draw", on: true }),
    onPointerUp: () => d({ t: "draw", on: false }),
    onPointerLeave: () => d({ t: "draw", on: false }),
    onPointerCancel: () => d({ t: "draw", on: false }),
  }

  const bowSpace = s.arrow !== null || s.over !== "playing"
  const wood = PAL.wood

  return (
    <div className="relative flex flex-col gap-3">
      <GameStyles />
      <Hud round={s.round} total={qs.length} lives={s.lives} />
      <PromptRow text={qs[Math.min(s.round, qs.length - 1)].prompt} />
      {/* Sunset sky over a grassy field, with the bow at the bottom. */}
      <div
        className="relative h-80 overflow-hidden"
        style={{
          ...pixel,
          background: `linear-gradient(${PAL.orange} 0%, #ffd27a 45%, #ffe9b0 55%, #6bd16f 55%, #3fae5e 100%)`,
        }}
        role="img"
        aria-label="Archery range"
      >
        <SceneDecor kind="sunset" />
        {/* Boards with an answer each. */}
        {s.boards.map((b) => (
          <div
            key={b.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${boardX(b, s.t)}%`, top: `${b.row}%` }}
          >
            <Target />
            <span
              className="mt-1 max-w-[7.5rem] px-1.5 py-0.5 text-center text-xs font-bold leading-tight"
              style={{ background: PAL.white, border: `3px solid ${PAL.ink}`, color: PAL.ink }}
            >
              {b.label}
            </span>
          </div>
        ))}

        <PopBurst pops={pops} />

        {/* The arrow in flight: a wooden shaft with a red tip. */}
        {s.arrow && (
          <div
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${s.arrow.x}%`, top: `${s.arrow.y}%` }}
            aria-hidden="true"
          >
            <div className="h-3 w-1.5" style={{ background: PAL.red, border: `1px solid ${PAL.ink}` }} />
            <div className="h-7 w-1.5" style={{ background: wood, border: `1px solid ${PAL.ink}` }} />
          </div>
        )}

        {/* The bow moves with the aim, bends as it is drawn and recoils when it fires. */}
        <div key={s.shots} className="sg-recoil absolute bottom-1 -translate-x-1/2" style={{ left: `${s.aim}%` }}>
          <Bow draw={s.draw} nocked={!s.arrow} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="lg" {...aimButton(-1, "Aim left")}>
          Aim left
        </Button>
        <Button size="lg" {...shootButton} disabled={bowSpace} aria-label="Hold to draw, let go to shoot">
          {s.drawing ? "Release!" : "Hold to draw"}
        </Button>
        <Button variant="outline" size="lg" {...aimButton(1, "Aim right")}>
          Aim right
        </Button>
      </div>
      <Feedback text={s.feedback} />
      <VerdictBanner v={verdict} />
    </div>
  )
}
