import { useState, type ChangeEvent } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { FileText, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ZONES, type ZoneId } from "@/lib/lessons"
import { useCustomQuestions, type CustomQuestion } from "@/lib/custom"

// Your own questions: make them from a PDF or pasted text, or type them in. Each corner
// plays with your questions once you add some for it.

export const Route = createFileRoute("/questions")({
  component: QuestionsPage,
})

// The file's bytes as base64, the form the server takes.
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function QuestionsPage() {
  const { data, create, remove } = useCustomQuestions()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [pasted, setPasted] = useState("")
  const [zone, setZone] = useState<ZoneId>("reef")
  const [prompt, setPrompt] = useState("")
  const [answer, setAnswer] = useState("")
  const [wrong, setWrong] = useState("")
  const [hint, setHint] = useState("")
  const isMemory = zone === "mountain"

  // Sends the study material (a PDF or pasted text) to the server, then saves the questions it makes.
  async function makeQuestions(material: { text?: string; pdf?: string }) {
    setBusy(true)
    setMessage("Making questions. This can take a moment.")
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(material),
      })
      const body = (await res.json()) as { questions?: Omit<CustomQuestion, "id">[]; error?: string }
      if (!res.ok || !body.questions) throw new Error(body.error ?? "Could not make questions.")
      for (const q of body.questions) await create(q as CustomQuestion)
      setMessage(`Saved ${body.questions.length} questions. They now play in the corners.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Choose a PDF file.")
      return
    }
    const pdf = await readBase64(file)
    await makeQuestions({ pdf })
  }

  async function addOne() {
    const p = prompt.trim()
    const a = answer.trim()
    if (!p || !a) {
      setMessage(isMemory ? "Fill in the card front and back." : "Fill in the question and the right answer.")
      return
    }
    const options = isMemory ? [] : [...new Set([a, ...wrong.split(",").map((s) => s.trim()).filter(Boolean)])].slice(0, 4)
    if (!isMemory && options.length < 2) {
      setMessage("Add at least one wrong answer, separated by commas.")
      return
    }
    await create({ zone, prompt: p, answer: a, options, hint: hint.trim() } as CustomQuestion)
    setPrompt("")
    setAnswer("")
    setWrong("")
    setHint("")
    setMessage("Added.")
  }

  const mine = (id: ZoneId) => data.filter((q) => q.zone === id)

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 pb-28">
      <header className="mb-6">
        <Link to="/lessons" className="text-sm text-muted-foreground underline">
          Back to lessons
        </Link>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">My questions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your own study material. Add questions for a corner and it plays with them.
        </p>
      </header>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" /> Make questions from a PDF
            </CardTitle>
            <CardDescription>Choose a PDF with text in it. Questions are made for every corner.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Label htmlFor="pdf-file">PDF file</Label>
            <Input id="pdf-file" type="file" accept="application/pdf" disabled={busy} onChange={onFile} />
            <Label htmlFor="pasted">Or paste study text</Label>
            <Textarea id="pasted" rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} disabled={busy} />
            <Button variant="outline" disabled={busy || !pasted.trim()} onClick={() => makeQuestions({ text: pasted.trim() })}>
              Make questions from this text
            </Button>
            {message && (
              <p role="status" className="text-sm">
                {message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add one by hand</CardTitle>
            <CardDescription>
              {isMemory ? "Memory cards: a term on the front, its meaning on the back." : "A question with one right answer and wrong ones."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Corner">
              {ZONES.map((z) => (
                <Button key={z.id} size="sm" variant={zone === z.id ? "default" : "outline"} aria-pressed={zone === z.id} onClick={() => setZone(z.id)}>
                  {z.name}
                </Button>
              ))}
            </div>
            <Label htmlFor="q-prompt">{isMemory ? "Card front" : "Question"}</Label>
            <Input id="q-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <Label htmlFor="q-answer">{isMemory ? "Card back" : "Right answer"}</Label>
            <Input id="q-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            {!isMemory && (
              <>
                <Label htmlFor="q-wrong">Wrong answers (separate with commas)</Label>
                <Input id="q-wrong" value={wrong} onChange={(e) => setWrong(e.target.value)} />
              </>
            )}
            <Label htmlFor="q-hint">Hint (optional)</Label>
            <Input id="q-hint" value={hint} onChange={(e) => setHint(e.target.value)} />
            <Button onClick={addOne}>
              <Plus className="size-4" /> Add question
            </Button>
          </CardContent>
        </Card>

        <section aria-label="Your questions" className="grid gap-3">
          <h3 className="text-base font-semibold">Your questions</h3>
          {data.length === 0 && <p className="text-sm text-muted-foreground">None yet. The built-in questions are used until you add some.</p>}
          {ZONES.map((z) => {
            const rows = mine(z.id)
            if (rows.length === 0) return null
            return (
              <Card key={z.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {z.name} ({rows.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {rows.map((q) => (
                    <div key={q.id} className="flex items-start justify-between gap-2 border-t pt-2 text-sm">
                      <p>
                        <span className="font-medium">{q.prompt}</span>
                        <span className="text-muted-foreground"> → {q.answer}</span>
                      </p>
                      <Button size="icon" variant="ghost" aria-label={`Remove ${q.prompt}`} onClick={() => remove(q.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </section>
      </div>
    </main>
  )
}
