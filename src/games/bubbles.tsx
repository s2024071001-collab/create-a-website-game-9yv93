import { useReducer } from "react"
import type { Choice } from "@/lib/lessons"
import {
  Feedback,
  GameStyles,
  Hud,
  PAL,
  PromptRow,
  pixel,
  useEndReport,
  useFrames,
  useReadAloud,
  useVerdict,
  PopBurst,
  usePops,
  VerdictBanner,
  type GameProps,
  type Over,
} from "@/games/shared"
import { SceneDecor } from "@/games/scenery"

// Bubble Pop (Reading Reef): bubbles float up and sway. Pop the one with the right answer.

type Tint = { light: string; base: string; dark: string }
type Bubble = { id: number; label: string; ok: boolean; x: number; y: number; speed: number; color: Tint; size: number }
type State = { round: number; lives: number; correct: number; bubbles: Bubble[]; feedback: string; over: Over; seq: number }
type Action = { t: "tick"; dt: number } | { t: "pop"; id: number }

// Each bubble has a light, a base and a dark shade, for a glossy look.
const BUBBLE_COLORS: Tint[] = [
  { light: "#ffe3f4", base: "#ff7ac2", dark: "#c4368a" },
  { light: "#fff8c4", base: "#ffd23f", dark: "#d19a00" },
  { light: "#d4ffe9", base: "#4fe3a0", dark: "#11935a" },
  { light: "#ebdcff", base: "#a77bff", dark: "#6b3fd1" },
]

// Diameter grows with the square root of the label length (text area grows with length),
// so a long answer gets a bigger bubble, and short answers stay compact.
function bubbleSize(label: string): number {
  return Math.round(Math.min(116, Math.max(84, 62 * Math.sqrt(label.length / 8))))
}

function bubblesFor(q: Choice, seq: number): Bubble[] {
  const n = q.options.length
  return q.options.map((label, i) => ({
    id: seq * 10 + i,
    label,
    ok: label === q.answer,
    x: n === 1 ? 50 : 22 + (i * 56) / (n - 1),
    y: 84 + (i % 2) * 14,
    speed: 6 + Math.random() * 3,
    color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
    size: bubbleSize(label),
  }))
}

function reduce(s: State, a: Action, qs: Choice[]): State {
  if (s.over !== "playing") return s
  if (a.t === "tick") {
    return {
      ...s,
      bubbles: s.bubbles.map((b) => {
        const y = b.y - b.speed * a.dt
        return { ...b, y: y < -15 ? 105 : y }
      }),
    }
  }
  const b = s.bubbles.find((x) => x.id === a.id)
  if (!b) return s
  if (b.ok) {
    const round = s.round + 1
    if (round >= qs.length) {
      return { ...s, round, correct: s.correct + 1, bubbles: [], over: "won", feedback: "All popped. Great work!" }
    }
    return {
      ...s,
      round,
      correct: s.correct + 1,
      bubbles: bubblesFor(qs[round], s.seq + 1),
      seq: s.seq + 1,
      feedback: "Pop! That's right.",
    }
  }
  const lives = s.lives - 1
  return {
    ...s,
    lives,
    bubbles: s.bubbles.filter((x) => x.id !== a.id),
    feedback: `Not that one. Hint: ${qs[s.round].hint}`,
    over: lives <= 0 ? "lost" : "playing",
  }
}

export function BubblePop({ zone, onEnd }: GameProps) {
  const qs = zone.questions
  const [s, d] = useReducer(
    (st: State, a: Action) => reduce(st, a, qs),
    undefined,
    (): State => ({ round: 0, lives: 3, correct: 0, bubbles: bubblesFor(qs[0], 0), feedback: "", over: "playing", seq: 0 }),
  )
  const [pops, addPop] = usePops()
  const verdict = useVerdict(s.correct, 3 - s.lives)
  useFrames(s.over === "playing", (dt) => d({ t: "tick", dt }))
  useEndReport(s.over, s.correct, onEnd)
  useReadAloud(s.over === "playing" ? qs[s.round].prompt : null, s.round)

  const pop = (b: Bubble) => {
    addPop(b.x, b.y, b.ok)
    d({ t: "pop", id: b.id })
  }

  return (
    <div className="relative flex flex-col gap-3">
      <GameStyles />
      <Hud round={s.round} total={qs.length} lives={s.lives} />
      <PromptRow text={qs[Math.min(s.round, qs.length - 1)].prompt} />
      {/* Sky over a grassy hill, like an 8-bit level. */}
      <div
        className="relative h-72 overflow-hidden"
        style={{
          ...pixel,
          background: `linear-gradient(${PAL.sky} 0%, #c9f1ff 58%, #7be38f 58%, #3fbf6a 100%)`,
        }}
      >
        <SceneDecor kind="sky" />
        {s.bubbles.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => pop(b)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-1 text-center font-bold active:scale-95"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              fontSize: Math.min(14, Math.max(12, Math.round(b.size * 0.1))),
              lineHeight: 1.2,
              background: `radial-gradient(circle at 50% 50%, ${b.color.light} 0%, ${b.color.base} 55%, ${b.color.dark} 100%)`,
              border: `4px solid ${PAL.ink}`,
              boxShadow: `inset -5px -6px 0 rgba(0,0,0,0.14), 4px 4px 0 ${PAL.ink}`,
              color: PAL.ink,
            }}
          >
            {/* Glossy highlight: a bright blob and a small sparkle on the upper left. */}
            <span
              aria-hidden="true"
              className="absolute rounded-full bg-white"
              style={{ left: "16%", top: "14%", width: "26%", height: "16%", transform: "rotate(-30deg)", opacity: 0.85 }}
            />
            <span
              aria-hidden="true"
              className="absolute rounded-full bg-white"
              style={{ left: "28%", top: "30%", width: "8%", height: "8%", opacity: 0.6 }}
            />
            {/* The answer sits on a cream card so it reads clearly on any bubble colour. */}
            <span
              className="sg-sway relative block rounded-lg px-1.5 py-0.5 font-bold"
              style={{ animationDelay: `${-((b.id % 5) * 0.6)}s`, maxWidth: "76%", background: "rgba(255, 252, 240, 0.94)", boxShadow: "0 1px 0 rgba(0,0,0,0.25)", letterSpacing: "0.01em" }}
            >
              {b.label}
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
