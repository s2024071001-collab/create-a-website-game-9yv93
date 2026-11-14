import { useReducer, useState } from "react"
import { SceneDecor } from "@/games/scenery"
import {
  Feedback,
  GameStyles,
  Hud,
  PAL,
  PromptRow,
  pixel,
  shuffle,
  useEndReport,
  useReadAloud,
  useVerdict,
  VerdictBanner,
  type GameProps,
  type Over,
} from "@/games/shared"

// Mountain Climb (Memory Mountain): answer each question to climb the rope one knot.
// Two answers are offered. A wrong answer slides you down one knot and switches that answer off.

type State = {
  round: number
  correct: number
  wrong: number
  climbed: number
  tried: string[]
  feedback: string
  over: Over
}
type Action = { t: "answer"; option: string; ok: boolean; hint: string }

function reduce(s: State, a: Action, total: number): State {
  if (s.over !== "playing") return s
  if (a.ok) {
    const round = s.round + 1
    return {
      ...s,
      round,
      correct: s.correct + 1,
      climbed: s.climbed + 1,
      tried: [],
      feedback: "Up you go! That's right.",
      over: round >= total ? "won" : "playing",
    }
  }
  return {
    ...s,
    wrong: s.wrong + 1,
    climbed: Math.max(0, s.climbed - 1),
    tried: [...s.tried, a.option],
    feedback: `Slipped down. Hint: ${a.hint}`,
  }
}

// The mountain and rope are drawn in a 100 x 100 box, stretched to fill the scene.
// The rope is a quadratic curve from the foot of the mountain to the summit.
const ROPE_START = { x: 30, y: 96 }
const ROPE_CONTROL = { x: 36, y: 60 }
const ROPE_END = { x: 50, y: 12 }
const ROPE_PATH = `M${ROPE_START.x} ${ROPE_START.y} Q${ROPE_CONTROL.x} ${ROPE_CONTROL.y} ${ROPE_END.x} ${ROPE_END.y}`

// Point on the rope at fraction t (0 = foot, 1 = summit).
function ropePoint(t: number) {
  const u = 1 - t
  return {
    x: u * u * ROPE_START.x + 2 * u * t * ROPE_CONTROL.x + t * t * ROPE_END.x,
    y: u * u * ROPE_START.y + 2 * u * t * ROPE_CONTROL.y + t * t * ROPE_END.y,
  }
}

const PEAK = "M-4 100 L14 66 L22 70 L34 40 L42 30 L50 8 L57 24 L63 28 L74 48 L80 44 L104 100 Z"
const SHADE = "M50 8 L50 100 L104 100 L80 44 L74 48 L63 28 L57 24 Z"
const SNOW = "M50 8 L43 24 L46 21 L50 27 L54 21 L57 24 Z"
const SNOW_SHADE = "M50 8 L57 24 L54 21 L50 27 Z"
const STRATA = ["M10 78 L30 74 L48 80", "M28 56 L46 60 L58 54", "M52 62 L66 66 L78 60", "M38 92 L60 88 L82 94", "M18 88 L26 86"]
const ROCKS = ["M30 70 L36 66 L40 74 L33 80 Z", "M60 40 L65 38 L66 44 L61 46 Z", "M14 84 L20 80 L24 86 Z", "M70 70 L76 66 L79 72 Z"]

function Climber({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute"
      style={{ left: `${x}%`, bottom: `${100 - y}%`, width: 24, height: 34, transform: "translateX(-50%)", transition: "left 0.6s ease-in-out, bottom 0.6s ease-in-out" }}
    >
      <div className="sg-bob absolute inset-0">
        <div className="absolute left-1/2 top-0 size-3 -translate-x-1/2 rounded-sm" style={{ background: "#ffd1a6", border: `2px solid ${PAL.ink}` }} />
        <div className="absolute left-1/2 top-0 h-1.5 w-3.5 -translate-x-1/2" style={{ background: PAL.purple }} />
        <div className="absolute left-1/2 top-3 h-3.5 w-3.5 -translate-x-1/2" style={{ background: PAL.red, border: `2px solid ${PAL.ink}` }} />
        <div className="absolute bottom-0 left-1/2 h-3 w-1.5 -translate-x-[110%]" style={{ background: PAL.blue, border: `2px solid ${PAL.ink}` }} />
        <div className="absolute bottom-0 left-1/2 h-3 w-1.5 translate-x-[10%]" style={{ background: PAL.blue, border: `2px solid ${PAL.ink}` }} />
      </div>
    </div>
  )
}

export function MountainClimb({ zone, onEnd }: GameProps) {
  const qs = zone.questions
  const n = qs.length
  // Each question gets its right answer and exactly one wrong answer, in a random order.
  // The wrong one comes from the question's own options, or from the other questions in this
  // corner when the question has none (your own questions can have a single answer).
  const [pairs] = useState(() =>
    qs.map((q, i) => {
      const others = qs.filter((_, j) => j !== i).map((x) => x.answer)
      const pool = shuffle([...q.options, ...others]).filter((o, k, all) => o !== q.answer && all.indexOf(o) === k)
      return shuffle([q.answer, ...pool.slice(0, 1)])
    }),
  )
  const [s, d] = useReducer(
    (st: State, a: Action) => reduce(st, a, n),
    undefined,
    (): State => ({ round: 0, correct: 0, wrong: 0, climbed: 0, tried: [], feedback: "", over: "playing" }),
  )
  const verdict = useVerdict(s.correct, s.wrong)
  useEndReport(s.over, s.correct, onEnd)
  const cur = qs[Math.min(s.round, n - 1)]
  useReadAloud(s.over === "playing" ? cur.prompt : null, s.round)

  const at = ropePoint(n === 0 ? 0 : s.climbed / n)

  return (
    <div className="relative flex flex-col gap-3">
      <GameStyles />
      <Hud round={s.round} total={n} />
      <PromptRow text={cur.prompt} />

      {/* The two answers sit at the top, away from the mountain. */}
      <div className="grid grid-cols-2 gap-2">
        {pairs[Math.min(s.round, n - 1)].map((opt) => {
          const off = s.tried.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              disabled={off || s.over !== "playing"}
              onClick={() => d({ t: "answer", option: opt, ok: opt === cur.answer, hint: cur.hint })}
              className="min-h-14 px-3 py-2 text-center text-base font-semibold disabled:opacity-40"
              style={{ ...pixel, background: PAL.white, color: PAL.ink }}
            >
              {opt}
            </button>
          )
        })}
      </div>

      <div
        className="relative h-72 overflow-hidden"
        style={{ ...pixel, background: `linear-gradient(${PAL.sky} 0%, #d9f7ff 70%, #bfe9ff 100%)` }}
        role="img"
        aria-label={`Climber on rope knot ${s.climbed} of ${n}`}
      >
        <SceneDecor kind="sky" />

        <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {/* The mountain: a lit left face, a shaded right face and a snowy top. */}
          <path d={PEAK} fill="#7d8aa0" />
          <path d={SHADE} fill="#5a6780" />
          {STRATA.map((d) => (
            <path key={d} d={d} fill="none" stroke="#4d5870" strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.7} />
          ))}
          {ROCKS.map((d) => (
            <path key={d} d={d} fill="#9c8a72" />
          ))}
          <path d={SNOW} fill={PAL.white} />
          <path d={SNOW_SHADE} fill="#c9d6e6" />

          {/* The rope: a dark braid with lighter strands over it. */}
          <path d={ROPE_PATH} fill="none" stroke="#6b4423" strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={ROPE_PATH} fill="none" stroke="#e0a95c" strokeWidth={3} strokeDasharray="5 3" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
          <path d={ROPE_PATH} fill="none" stroke="#ffd58a" strokeWidth={1} strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* The flag on the summit. */}
        <div className="absolute" style={{ left: `${ROPE_END.x}%`, top: 0, width: 3, height: 30, background: PAL.ink, transform: "translateX(-50%)" }}>
          <div className="absolute left-[3px] top-0 h-3 w-5" style={{ background: PAL.red, border: `2px solid ${PAL.ink}` }} />
        </div>

        <Climber x={at.x} y={at.y} />
      </div>

      <Feedback text={s.feedback} />
      <VerdictBanner v={verdict} />
    </div>
  )
}
