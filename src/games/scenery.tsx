import { PAL } from "@/games/shared"

// Decorative pixel scenery behind each mini-game. Purely visual: it never takes clicks.

export type SceneKind = "sky" | "sunset" | "meadow"

// Where the grass starts, as a percentage from the top of the scene.
const HORIZON: Record<SceneKind, number> = { sky: 58, sunset: 55, meadow: 60 }
const GRASS = "#2f9e57"

function Cloud({ top, left, u = 5, delay = 0 }: { top: number; left: number; u?: number; delay?: number }) {
  return (
    <div
      className="sg-drift absolute"
      style={{ top: `${top}%`, left: `${left}%`, width: u * 10, height: u * 7, animationDelay: `${-delay}s`, filter: `drop-shadow(2px 2px 0 ${PAL.ink})` }}
    >
      <div className="absolute" style={{ left: 0, bottom: 0, width: u * 10, height: u * 4, background: PAL.white }} />
      <div className="absolute" style={{ left: u * 2, bottom: u * 4, width: u * 4, height: u * 3, background: PAL.white }} />
      <div className="absolute" style={{ left: u * 6, bottom: u * 4, width: u * 3, height: u * 2, background: PAL.white }} />
    </div>
  )
}

function Sun({ top, left, size, color }: { top: number; left: number; size: number; color: string }) {
  return (
    <div
      className="absolute rounded-full"
      style={{ top: `${top}%`, left: `${left}%`, width: size, height: size, background: color, border: `4px solid ${PAL.ink}`, boxShadow: `0 0 0 8px ${color}66` }}
    />
  )
}

function Hill({ left, width, height, bottom, color }: { left: number; width: number; height: number; bottom: number; color: string }) {
  return (
    <div
      className="absolute"
      style={{ left: `${left}%`, width: `${width}%`, height: `${height}%`, bottom: `${bottom}%`, background: color, borderRadius: "50% 50% 0 0" }}
    />
  )
}

function Tuft({ left, top, s = 1 }: { left: number; top: number; s?: number }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: 16 * s,
        height: 12 * s,
        background: GRASS,
        clipPath: "polygon(0 100%, 15% 20%, 30% 100%, 48% 0, 62% 100%, 80% 25%, 100% 100%)",
      }}
    />
  )
}

function Flower({ left, top, color, delay = 0 }: { left: number; top: number; color: string; delay?: number }) {
  return (
    <div
      className="sg-sway absolute"
      style={{ left: `${left}%`, top: `${top}%`, width: 10, height: 24, transformOrigin: "50% 100%", animationDelay: `${-delay}s` }}
    >
      <div className="absolute" style={{ left: 4, bottom: 0, width: 2, height: 14, background: GRASS }} />
      <div className="absolute" style={{ left: 0, top: 0, width: 10, height: 10, background: color, border: `2px solid ${PAL.ink}` }} />
    </div>
  )
}

function Tree({ left, top, s = 1 }: { left: number; top: number; s?: number }) {
  return (
    <div className="absolute" style={{ left: `${left}%`, top: `${top}%`, width: 30 * s, height: 40 * s }}>
      <div className="absolute" style={{ left: 11 * s, bottom: 0, width: 8 * s, height: 16 * s, background: PAL.wood, border: `2px solid ${PAL.ink}` }} />
      <div className="absolute" style={{ left: 0, top: 0, width: 30 * s, height: 26 * s, background: "#2f9e57", border: `3px solid ${PAL.ink}`, borderRadius: 6 }} />
    </div>
  )
}

const FLOWER_COLORS = [PAL.pink, PAL.yellow, PAL.white, PAL.purple, PAL.red]

export function SceneDecor({ kind }: { kind: SceneKind }) {
  const h = HORIZON[kind]
  const sunny = kind !== "sunset"
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {sunny ? <Sun top={6} left={78} size={44} color={PAL.yellow} /> : <Sun top={12} left={42} size={64} color="#ffe27a" />}
      <Cloud top={8} left={6} />
      <Cloud top={24} left={56} u={4} delay={6} />
      <Cloud top={Math.round(h * 0.25)} left={30} u={3} delay={11} />

      {/* Two layers of hills behind the grass. */}
      <Hill left={-12} width={62} height={22} bottom={100 - h} color="#5cc878" />
      <Hill left={40} width={80} height={16} bottom={100 - h} color="#4fb86c" />

      <Tree left={84} top={h - 14} s={0.8} />
      {kind === "meadow" && <Tree left={3} top={h - 10} s={0.7} />}

      {/* Grass tufts and flowers along the ground. */}
      {[4, 16, 34, 52, 68, 88].map((x, i) => (
        <Tuft key={`t${x}`} left={x} top={h + 8 + ((i * 7) % 18)} s={i % 2 ? 1 : 0.8} />
      ))}
      {[10, 26, 45, 62, 78, 92].map((x, i) => (
        <Flower key={`f${x}`} left={x} top={h + 14 + ((i * 11) % 22)} color={FLOWER_COLORS[i % FLOWER_COLORS.length]} delay={i * 0.5} />
      ))}
    </div>
  )
}
