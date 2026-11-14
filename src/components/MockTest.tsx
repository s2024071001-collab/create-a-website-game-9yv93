import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ZONES, type Choice, type Zone } from "@/lib/lessons"
import { useCustomQuestions, withCustom, type CustomQuestion } from "@/lib/custom"
import { finishMock, speak } from "@/lib/store"
import { shuffle } from "@/games/shared"

// The mock test in the Exam Hall. It mixes questions from all four corners, one answer at a
// time, with no time limit and no hints. Your questions are used when you have added them.

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PER_ZONE = 2

// Each corner's questions are already multiple choice.
function cornerChoices(zone: Zone): Choice[] {
  return zone.questions
}

// Every question offers at least two answers. If it has fewer, wrong answers are borrowed
// from the other questions in the test, so the choice is never a single button.
function ensureTwo(q: Choice, pool: string[]): Choice {
  const opts = [...new Set([q.answer, ...q.options])]
  const extras = shuffle(pool.filter((o) => !opts.includes(o)))
  while (opts.length < 2 && extras.length > 0) opts.push(extras.shift()!)
  return { ...q, options: shuffle(opts) }
}

function buildTest(rows: CustomQuestion[]): Choice[] {
  const corners = ZONES.map((z) => withCustom(z, rows))
  const pool = corners.flatMap((z) => cornerChoices(z).map((q) => q.answer))
  return shuffle(corners.flatMap((z) => shuffle(cornerChoices(z)).slice(0, PER_ZONE).map((q) => ensureTwo(q, pool))))
}

export function MockTest({ open, onOpenChange }: Props) {
  const { data } = useCustomQuestions()
  const [run, setRun] = useState(0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        {open && (
          <MockBody
            key={run}
            rows={data}
            onClose={() => onOpenChange(false)}
            onAgain={() => setRun((r) => r + 1)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MockBody({ rows, onClose, onAgain }: { rows: CustomQuestion[]; onClose: () => void; onAgain: () => void }) {
  const [test] = useState(() => buildTest(rows))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [answers, setAnswers] = useState<(string | null)[]>([])
  const [finished, setFinished] = useState(false)
  const [score, setScore] = useState(0)

  if (test.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Mock test</DialogTitle>
          <DialogDescription>There are no questions yet. Add some on the My questions page.</DialogDescription>
        </DialogHeader>
        <Button variant="outline" onClick={onClose}>
          Back to the island
        </Button>
      </div>
    )
  }

  const total = test.length

  if (finished) {
    const wrong = test.map((q, i) => ({ q, given: answers[i] })).filter((r) => r.given !== r.q.answer)
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Mock test result</DialogTitle>
          <DialogDescription>Every question here counts. Look at the ones you missed, then try again.</DialogDescription>
        </DialogHeader>
        <p className="text-xl font-semibold">
          {score} of {total} right
        </p>
        {wrong.length > 0 && (
          <ul className="grid gap-2 text-sm">
            {wrong.map(({ q, given }) => (
              <li key={q.prompt} className="border-t pt-2">
                <p className="font-medium">{q.prompt}</p>
                <p className="text-muted-foreground">
                  Your answer: {given ?? "none"}. Right answer: {q.answer}.
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Back to the island
          </Button>
          <Button onClick={onAgain}>Try again</Button>
        </div>
      </div>
    )
  }

  const q = test[index]
  const next = () => {
    const all = [...answers, picked]
    setAnswers(all)
    setPicked(null)
    if (index + 1 < total) {
      setIndex(index + 1)
      return
    }
    const final = all.filter((a, i) => a === test[i].answer).length
    setScore(final)
    finishMock(final, total)
    setFinished(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Mock test: the Practice Hall</DialogTitle>
        <DialogDescription>
          Question {index + 1} of {total}. Take your time. There is no timer.
        </DialogDescription>
      </DialogHeader>

      <div className="h-2 w-full border border-border bg-muted" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <p className="text-lg font-medium">{q.prompt}</p>
      <div className="grid gap-2" role="group" aria-label="Answers">
        {q.options.map((opt) => (
          <Button
            key={opt}
            variant={picked === opt ? "default" : "outline"}
            aria-pressed={picked === opt}
            className="h-auto justify-start whitespace-normal py-3 text-left"
            onClick={() => setPicked(opt)}
          >
            {opt}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => speak([q.prompt, ...q.options].join(". "))}>
          Read aloud
        </Button>
        <Button disabled={picked === null} onClick={next}>
          {index + 1 < total ? "Next question" : "See my result"}
        </Button>
      </div>
    </div>
  )
}
