import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Pause, Play, RotateCcw, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { speak } from "@/lib/store"

// Focus helpers for attention difficulties (ADHD and similar). A visible
// timer, clear breaks, and big tasks split into small steps.

export const Route = createFileRoute("/focus")({
  component: FocusPage,
})

type Step = { id: string; text: string; done: boolean }
type Task = { id: string; title: string; steps: Step[] }

const TASKS_KEY = "study-island-tasks"
const FOCUS_OPTIONS = [15, 25] as const
const BREAK_MINUTES = 5

function loadTasks(): Task[] {
  if (typeof localStorage === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY) || "[]")
  } catch {
    return []
  }
}

function FocusPage() {
  const [focusMin, setFocusMin] = useState<number>(25)
  const [mode, setMode] = useState<"focus" | "break">("focus")
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)

  const total = (mode === "focus" ? focusMin : BREAK_MINUTES) * 60
  const pct = Math.round(((total - secondsLeft) / total) * 100)

  // Tick once per second while running.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  // When the time runs out, switch between focus and break.
  useEffect(() => {
    if (secondsLeft > 0) return
    const nextMode = mode === "focus" ? "break" : "focus"
    if (mode === "focus") setSessions((n) => n + 1)
    speak(nextMode === "break" ? "Focus done. Time for a break." : "Break over. Ready to focus?")
    setMode(nextMode)
    setSecondsLeft((nextMode === "focus" ? focusMin : BREAK_MINUTES) * 60)
    setRunning(false)
  }, [secondsLeft, mode, focusMin])

  const reset = () => {
    setRunning(false)
    setSecondsLeft((mode === "focus" ? focusMin : BREAK_MINUTES) * 60)
  }

  const pickFocus = (m: number) => {
    setFocusMin(m)
    setMode("focus")
    setRunning(false)
    setSecondsLeft(m * 60)
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const ss = String(secondsLeft % 60).padStart(2, "0")

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 pb-28 flex flex-col gap-5">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Focus</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Work in short sprints, then take a real break. Small steps beat big plans.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "focus" ? "Focus time" : "Break time"}</CardTitle>
          <CardDescription>
            {mode === "focus" ? `Stay on one thing for ${focusMin} minutes.` : `Stand up, stretch or get water for ${BREAK_MINUTES} minutes.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <p
            className="text-4xl tabular-nums"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
            aria-live="off"
            aria-label={`${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} seconds left`}
          >
            {mm}:{ss}
          </p>
          <Progress value={pct} className="w-full">
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => setRunning((r) => !r)}>
              {running ? <Pause className="size-4" /> : <Play className="size-4" />}
              {running ? "Pause" : "Start"}
            </Button>
            <Button size="lg" variant="outline" onClick={reset}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </div>
          <div className="flex gap-2" role="group" aria-label="Focus length">
            {FOCUS_OPTIONS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={focusMin === m && mode === "focus" ? "default" : "outline"}
                onClick={() => pickFocus(m)}
              >
                {m} min
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Sprints finished today: {sessions}</p>
        </CardContent>
      </Card>

      <TaskList />
    </main>
  )
}

function TaskList() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [title, setTitle] = useState("")
  const [steps, setSteps] = useState("")

  const save = (next: Task[]) => {
    setTasks(next)
    localStorage.setItem(TASKS_KEY, JSON.stringify(next))
  }

  const add = () => {
    const t = title.trim()
    if (!t) return
    // Steps are typed comma-separated. With none, the task is one step.
    const list = steps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ id: crypto.randomUUID(), text, done: false }))
    save([
      ...tasks,
      {
        id: crypto.randomUUID(),
        title: t,
        steps: list.length ? list : [{ id: crypto.randomUUID(), text: t, done: false }],
      },
    ])
    setTitle("")
    setSteps("")
  }

  const toggle = (taskId: string, stepId: string) => {
    save(
      tasks.map((t) => {
        if (t.id !== taskId) return t
        const nextSteps = t.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s))
        if (nextSteps.every((s) => s.done) && !t.steps.every((s) => s.done)) speak("Task complete. Well done!")
        return { ...t, steps: nextSteps }
      }),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My tasks</CardTitle>
        <CardDescription>Break a big task into tiny steps. Tick each step as you finish it.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Big task, e.g. Science report"
            aria-label="Task name"
          />
          <Input
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="Tiny steps, separated by commas"
            aria-label="Tiny steps separated by commas"
          />
          <Button type="submit" disabled={!title.trim()} className="self-end">
            <Plus className="size-4" />
            Add task
          </Button>
        </form>

        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">No tasks yet. Add one above.</p>
        )}

        <ul className="flex flex-col gap-3">
          {tasks.map((task) => {
            const doneCount = task.steps.filter((s) => s.done).length
            return (
              <li key={task.id} className="rounded-md border-2 border-border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${task.title}`}
                    onClick={() => save(tasks.filter((t) => t.id !== task.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doneCount} of {task.steps.length} steps done
                </p>
                <ul className="flex flex-col gap-2">
                  {task.steps.map((step) => (
                    <li key={step.id} className="flex items-center gap-3">
                      <Checkbox
                        id={step.id}
                        checked={step.done}
                        onCheckedChange={() => toggle(task.id, step.id)}
                      />
                      <label htmlFor={step.id} className={step.done ? "text-sm line-through text-muted-foreground" : "text-sm"}>
                        {step.text}
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
