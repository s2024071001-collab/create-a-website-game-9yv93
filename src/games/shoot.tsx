import { useReducer } from "react"
import type { Choice } from "@/lib/lessons"
import {
  Feedback,
  GameStyles,
  Hud,
  PAL,
  PopBurst,
  PromptRow,
  pixel,
  usePops,
  useEndReport,
  useFrames,
  useReadAloud,
  useVerdict,
  VerdictBanner,
  type GameProps,
  type Over,
} from "@/games/shared"
import { SceneDecor } from "@/games/scenery"

// Target Shoot (Math Meadow): signs hang on ropes and swing as they slide across the range.
// Tap the sign with the right answer.

type Target = { id: number; label: string; ok: boolean; row: number; x: number; dir: 1 | -1; speed: number; color: string }
type State = { round: number; lives: number; correct: number; targets: Target[]; feedback: string; over: Over; seq: number }
type Action = { t: "tick"; dt: number } | { t: "hit"; id: number }

const SIGN_COLORS = [PAL.yellow, PAL.mint, PAL.pink, PAL.sky]

function targetsFor(q: Choice, seq: number): Target[] {
  const n = q.options.length
  return q.options.map((label, i) => {
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1
    return {
      id: seq * 10 + i,
      label,
      ok: label === q.answer,
      row: 30 + i * (40 / Math.max(n - 1, 1)),
      x: dir === 1 ? 6 : 94,
      dir,
      speed: 8 + Math.random() * 5,
      color: SIGN_COLORS[i % SIGN_COLORS.length],
    }
  })
}

function reduce(s: State, a: Action, qs: Choice[]): State {
  if (s.over !== "playing") return s
  if (a.t === "tick") {
    return {
      ...s,
      targets: s.targets.map((t) => {
        const x = t.x + t.dir * t.speed * a.dt
        if (x > 108) return { ...t, x: -8 }
        if (x < -8) return { ...t, x: 108 }
        return { ...t, x }
      }),
    }
  }
  const t = s.targets.find((x) => x.id === a.id)
  if (!t) return s
  if (t.ok) {
    const round = s.round + 1
    if (round >= qs.length) {
      return { ...s, round, correct: s.correct + 1, targets: [], over: "won", feedback: "Bullseye! All questions done." }
    }
    return {
      ...s,
      round,
      correct: s.correct + 1,
      targets: targetsFor(qs[round], s.seq + 1),
      seq: s.seq + 1,
      feedback: "Hit! Nice shot.",
    }
  }
  const lives = s.lives - 1
  return {
    ...s,
    lives,
    targets: s.targets.filter((x) => x.id !== a.id),
    feedback: `Miss. Hint: ${qs[s.round].hint}`,
    over: lives <= 0 ? "lost" : "playing",
  }
}

export function TargetShoot({ zone, onEnd }: GameProps) {
  const qs = zone.questions
  const [s, d] = useReducer(
    (st: State, a: Action) => reduce(st, a, qs),
    undefined,
    (): State => ({ round: 0, lives: 3, correct: 0, targets: targetsFor(qs[0], 0), feedback: "", over: "playing", seq: 0 }),
  )
  useFrames(s.over === "playing", (dt) => d({ t: "tick", dt }))
  useEndReport(s.over, s.correct, onEnd)
  useReadAloud(s.over === "playing" ? qs[s.round].prompt : null, s.round)
  const verdict = useVerdict(s.correct, 3 - s.lives)
  const [pops, addPop] = usePops()

  const hit = (t: Target) => {
    addPop(t.x, t.row, t.ok)
    d({ t: "hit", id: t.id })
  }

  return (
    <div className="relative flex flex-col gap-3">
      <GameStyles />
      <Hud round={s.round} total={qs.length} lives={s.lives} />
      <PromptRow text={qs[Math.min(s.round, qs.length - 1)].prompt} />
      {/* Bright meadow with a row of bunting. */}
      <div
        className="relative h-72 cursor-crosshair overflow-hidden"
        style={{
          ...pixel,
          background: `linear-gradient(${PAL.sky} 0%, #d9f7ff 60%, #8be08f 60%, #3fbf6a 100%)`,
        }}
      >
        <SceneDecor kind="meadow" />
        <div className="relative flex h-5" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex-1" style={{ background: [PAL.red, PAL.yellow, PAL.blue, PAL.green][i % 4], borderBottom: `3px solid ${PAL.ink}` }} />
          ))}
        </div>
        {s.targets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => hit(t)}
            className="absolute -translate-x-1/2 -translate-y-1/2 active:scale-90"
            style={{ left: `${t.x}%`, top: `${t.row}%` }}
          >
            {/* A sign on a rope: it swings from its top edge. */}
            <span className="block" style={{ display: "block" }}>
              <span className="block mx-auto h-4 w-0.5" style={{ background: PAL.ink }} aria-hidden="true" />
              <span className="sg-hang block px-3 py-2 text-sm font-bold" style={{ background: t.color, border: `4px solid ${PAL.ink}`, boxShadow: `3px 3px 0 ${PAL.ink}`, color: PAL.ink }}>
                {t.label}
              </span>
            </span>
          </button>
        ))}
        <PopBurst pops={pops} />
      </div>
      <Feedback text={s.feedback} />
      <VerdictBanner v={verdict} />
    </div>
  )
}
