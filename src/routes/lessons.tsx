import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Check, FileText, Play } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MiniGameDialog } from "@/components/MiniGames"
import { ZONES, type Zone, type ZoneId } from "@/lib/lessons"
import { finishLesson, useProgress } from "@/lib/store"

// Every lesson, without walking the island. Same lessons as the landmarks.

export const Route = createFileRoute("/lessons")({
  component: LessonsPage,
})

function LessonsPage() {
  const progress = useProgress()
  const [active, setActive] = useState<Zone | null>(null)
  const [open, setOpen] = useState(false)

  const start = (zone: Zone) => {
    setActive(zone)
    setOpen(true)
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 pb-28">
      <header className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Lessons</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Short steps, one at a time. Every lesson can be read aloud, and you can stop at any step.
        </p>
        <Link
          to="/questions"
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"
        >
          <FileText className="size-4" /> Use my own questions
        </Link>
      </header>

      <div className="grid gap-3">
        {ZONES.map((zone) => {
          const done = progress.done.includes(zone.id as ZoneId)
          return (
            <Card key={zone.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <span className="size-3 border border-border" style={{ background: zone.color }} aria-hidden="true" />
                    {zone.name}
                  </CardTitle>
                  {done ? (
                    <Badge variant="secondary">
                      <Check className="size-3" /> Done
                    </Badge>
                  ) : (
                    <Badge variant="outline">{zone.subject}</Badge>
                  )}
                </div>
                <CardDescription>{zone.blurb}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => start(zone)}>
                  <Play className="size-4" />
                  {done ? `Play ${zone.gameName} again` : `Play ${zone.gameName}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <MiniGameDialog
        zone={active}
        open={open}
        onOpenChange={setOpen}
        onFinish={finishLesson}
      />
    </main>
  )
}
