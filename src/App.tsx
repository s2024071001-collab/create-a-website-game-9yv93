import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { BookOpen, Brain, Calculator, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GraduationCap, Lock, Target, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IslandScene, type IslandCommands } from "@/game/IslandScene"
import { MOCK_TILE, START } from "@/game/island"
import { MiniGameDialog } from "@/components/MiniGames"
import { MockTest } from "@/components/MockTest"
import { ZONES, getZone, zoneNear, type ZoneId } from "@/lib/lessons"
import { allLessonsDone, finishLesson, useProgress, useSettings } from "@/lib/store"
import { dayClock, phaseName } from "@/game/daylight"

// The home page is the 3D island. Walk with the arrow keys, WASD, the on-screen
// buttons, or tap a tile. Step onto a landmark beacon to start its lesson.
// Finish all four lessons to open the bridge to the Exam Hall and its mock test.

function App() {
  const settings = useSettings()
  const progress = useProgress()
  const commands = useRef<IslandCommands | null>(null)
  const markers = useRef<Record<string, HTMLElement | null>>({})

  const [tile, setTile] = useState(START)
  const [lessonZone, setLessonZone] = useState<ZoneId | null>(null)
  const [lessonOpen, setLessonOpen] = useState(false)
  const [mockOpen, setMockOpen] = useState(false)
  const [cutscene, setCutscene] = useState(false)
  const [phase, setPhase] = useState("")

  // The time of day, refreshed every 15 seconds (set after mount, so the page can prerender).
  useEffect(() => {
    const tick = () => setPhase(phaseName(dayClock()))
    tick()
    const id = window.setInterval(tick, 15000)
    return () => window.clearInterval(id)
  }, [])

  const unlocked = allLessonsDone(progress, ZONES.map((z) => z.id))
  const doneCount = ZONES.filter((z) => progress.done.includes(z.id)).length
  const nearZone = zoneNear(tile.x, tile.z)
  const atHall = unlocked && tile.x === MOCK_TILE.x && tile.z === MOCK_TILE.z

  // Called by the scene each time the player reaches a tile.
  const handleArrive = useCallback(
    (x: number, z: number) => {
      setTile({ x, z })
      const landmark = ZONES.find((zn) => zn.tile.x === x && zn.tile.z === z)
      // Open a lesson automatically the first time; later visits use the button.
      if (landmark && !progress.done.includes(landmark.id)) {
        setLessonZone(landmark.id)
        setLessonOpen(true)
      }
      // The first time at the hall, the mock test opens by itself.
      if (unlocked && x === MOCK_TILE.x && z === MOCK_TILE.z && progress.mockTotal === 0) setMockOpen(true)
    },
    [progress.done, progress.mockTotal, unlocked],
  )

  const openLesson = (id: ZoneId) => {
    setLessonZone(id)
    setLessonOpen(true)
  }

  return (
    <div className="relative flex-1 min-h-[70svh] overflow-hidden" style={{ background: "#8fd3ff" }}>
      <IslandScene
        calm={settings.calmMode}
        paused={lessonOpen || mockOpen}
        commands={commands}
        onArrive={handleArrive}
        markers={markers}
        bridgeOpen={unlocked}
        onCutscene={setCutscene}
      />

      {/* Arena markers: an icon and name above each study building. Tap to walk there. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {ZONES.map((zone) => {
          const Icon = ZONE_ICONS[zone.id]
          return (
            <button
              key={zone.id}
              type="button"
              ref={(el) => {
                markers.current[zone.id] = el
              }}
              onClick={() => commands.current?.walkTo(zone.tile.x, zone.tile.z)}
              aria-label={`Go to ${zone.name}`}
              className="pointer-events-auto absolute left-0 top-0 flex flex-col items-center gap-1 will-change-transform"
            >
              <span
                className="flex items-center gap-1.5 rounded-md border-2 border-border bg-background/95 px-2 py-1 text-xs font-semibold shadow-sm"
              >
                <span className="flex size-6 items-center justify-center border border-border" style={{ background: zone.color }}>
                  <Icon className="size-4 text-foreground" aria-hidden="true" />
                </span>
                {zone.name}
                {progress.done.includes(zone.id) && <Check className="size-4" aria-label="done" />}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          ref={(el) => {
            markers.current.mock = el
          }}
          onClick={() => (unlocked ? commands.current?.walkTo(MOCK_TILE.x, MOCK_TILE.z) : commands.current?.showBridge())}
          aria-label={unlocked ? "Go to the Practice Hall" : "Practice Hall, locked"}
          className="pointer-events-auto absolute left-0 top-0 flex flex-col items-center gap-1 will-change-transform"
        >
          <span className="flex items-center gap-1.5 rounded-md border-2 border-border bg-background/95 px-2 py-1 text-xs font-semibold shadow-sm">
            <span className="flex size-6 items-center justify-center border border-border bg-[#ffd43b]">
              {unlocked ? <GraduationCap className="size-4 text-foreground" aria-hidden="true" /> : <Lock className="size-4 text-foreground" aria-hidden="true" />}
            </span>
            Practice Hall
          </span>
        </button>
      </div>

      {/* Score and bridge status, top left */}
      <div className="absolute left-3 top-3 flex flex-col items-start gap-2">
        <div className="pointer-events-none rounded-md border-2 border-border bg-background/95 px-3 py-2 text-sm font-medium shadow-sm">
          <div className="text-xs text-muted-foreground">
            {phase && `${phase} · `}{progress.points} points · {doneCount}/{ZONES.length} zones
          </div>
          <div className="mt-1 text-xs">
            {unlocked ? "Bridge open to the Practice Hall" : `Bridge locked: ${doneCount} of ${ZONES.length} lessons done`}
          </div>
        </div>
        {unlocked && (
          <Button size="sm" variant="outline" className="bg-background/95" onClick={() => commands.current?.showBridge()}>
            Tour the bridge
          </Button>
        )}
      </div>

      {/* Caption during the bridge cutscene */}
      {cutscene && (
        <div role="status" className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-4">
          <p className="rounded-md border-2 border-border bg-background/95 px-4 py-2 text-center text-sm font-semibold shadow-md">
            The Practice Hall. Take the mock test here to show what you have learned.
          </p>
        </div>
      )}

      {/* Study button, when standing at a landmark or at the Exam Hall */}
      {atHall ? (
        <div className="absolute inset-x-0 bottom-24 flex justify-center px-4">
          <Button size="lg" className="shadow-md" onClick={() => setMockOpen(true)}>
            Start the mock test
          </Button>
        </div>
      ) : (
        nearZone && (
          <div className="absolute inset-x-0 bottom-24 flex justify-center px-4">
            <Button size="lg" className="shadow-md" onClick={() => openLesson(nearZone.id)}>
              Play {nearZone.gameName}
            </Button>
          </div>
        )
      )}

      {/* Movement pad, bottom left */}
      <div className="absolute bottom-24 left-3 grid w-36 grid-cols-3 gap-1.5" aria-label="Move">
        <div />
        <DPadButton label="Move up" dx={0} dz={-1} commands={commands}>
          <ChevronUp />
        </DPadButton>
        <div />
        <DPadButton label="Move left" dx={-1} dz={0} commands={commands}>
          <ChevronLeft />
        </DPadButton>
        <div />
        <DPadButton label="Move right" dx={1} dz={0} commands={commands}>
          <ChevronRight />
        </DPadButton>
        <div />
        <DPadButton label="Move down" dx={0} dz={1} commands={commands}>
          <ChevronDown />
        </DPadButton>
        <div />
      </div>

      <p className="pointer-events-none absolute right-3 bottom-24 max-w-[9rem] text-right text-xs text-background drop-shadow">
        Arrows or WASD to walk. Tap a tile to go there.
      </p>

      <MiniGameDialog
        zone={lessonZone ? getZone(lessonZone) : null}
        open={lessonOpen}
        onOpenChange={setLessonOpen}
        onFinish={finishLesson}
      />
      <MockTest open={mockOpen} onOpenChange={setMockOpen} />
    </div>
  )
}

const ZONE_ICONS: Record<ZoneId, LucideIcon> = {
  reef: BookOpen,
  forest: Target,
  mountain: Brain,
  meadow: Calculator,
}

// A walk button that keeps walking while held down.
function DPadButton({
  label,
  dx,
  dz,
  commands,
  children,
}: {
  label: string
  dx: number
  dz: number
  commands: { current: IslandCommands | null }
  children: ReactNode
}) {
  // Holding the button keeps walking; the scene handles the steps each frame.
  const id = `pad-${label}`
  return (
    <Button
      variant="secondary"
      aria-label={label}
      className="size-11 bg-background/95 touch-none select-none"
      onPointerDown={(e) => {
        e.preventDefault()
        commands.current?.hold(id, dx, dz, true)
      }}
      onPointerUp={() => commands.current?.hold(id, dx, dz, false)}
      onPointerLeave={() => commands.current?.hold(id, dx, dz, false)}
      onPointerCancel={() => commands.current?.hold(id, dx, dz, false)}
    >
      {children}
    </Button>
  )
}

export default App
