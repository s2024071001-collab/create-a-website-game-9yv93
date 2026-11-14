import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Zone } from "@/lib/lessons"
import { BubblePop } from "@/games/bubbles"
import { ArcheryRange } from "@/games/archery"
import { MountainClimb } from "@/games/climb"
import { TargetShoot } from "@/games/shoot"
import { useSettings } from "@/lib/store"
import { useCustomQuestions, withCustom } from "@/lib/custom"

// Opens a corner's mini game in a dialog. Each game is its own module.

type Props = {
  zone: Zone | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinish: (zoneId: Zone["id"], points: number) => void
}

export function MiniGameDialog({ zone, open, onOpenChange, onFinish }: Props) {
  // The user's own questions for this corner replace the built-in ones.
  const { data } = useCustomQuestions()
  const game = zone ? withCustom(zone, data) : null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        {game && (
          <GameBody
            key={game.id}
            zone={game}
            onFinish={(points) => onFinish(zone.id, points)}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function GameBody({ zone, onFinish, onClose }: { zone: Zone; onFinish: (points: number) => void; onClose: () => void }) {
  const { calmMode } = useSettings()
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<number | null>(null)
  const total = zone.questions.length

  const onEnd = useCallback(
    (points: number) => {
      setResult(points)
      onFinish(Math.max(1, points))
    },
    [onFinish],
  )

  return (
    <div className={`flex flex-col gap-4 ${calmMode ? "sg-calm" : ""}`}>
      <DialogHeader>
        <DialogTitle>
          {zone.gameName}: {zone.name}
        </DialogTitle>
        <DialogDescription>{zone.blurb}</DialogDescription>
      </DialogHeader>

      {result === null ? (
        <>
          {zone.game === "bubbles" && <BubblePop key={run} zone={zone} onEnd={onEnd} />}
          {zone.game === "archery" && <ArcheryRange key={run} zone={zone} onEnd={onEnd} />}
          {zone.game === "climb" && <MountainClimb key={run} zone={zone} onEnd={onEnd} />}
          {zone.game === "shoot" && <TargetShoot key={run} zone={zone} onEnd={onEnd} />}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="text-xl font-semibold">
            {result} of {total} right
          </p>
          <p className="text-sm text-muted-foreground">Points saved. Play again to beat your score.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Back to the town
            </Button>
            <Button
              onClick={() => {
                setResult(null)
                setRun((r) => r + 1)
              }}
            >
              Play again
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
