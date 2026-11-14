// Turns study material (a PDF file, or pasted text) into questions for each corner of the town.
// The model reads the PDF itself. Returns the questions; the app saves them in the questions collection.
import { anthropic, generateText } from "@omg-dev/ai"

type Zone = "reef" | "forest" | "mountain" | "meadow"
type Question = { zone: Zone; prompt: string; answer: string; options: string[]; hint: string }
type Body = { text?: string; pdf?: string }

const MAX_TEXT = 9000
const MAX_PDF_CHARS = 6_000_000 // base64 characters, about 4.5 MB of PDF
const PER_ZONE = 4

const INSTRUCTIONS = `You make short study questions for children with learning differences.
Use ONLY the study material. Keep every sentence short and clear.

Return ONLY JSON in this exact shape, with no other words:
{
  "reef": [ { "prompt": "...", "options": ["right", "wrong", "wrong"], "answer": "right", "hint": "..." } ],
  "forest": [ same shape ],
  "meadow": [ same shape ],
  "mountain": [ { "prompt": "front of the card (a term)", "answer": "back of the card (its meaning)", "options": [], "hint": "" } ]
}
Rules:
- reef, forest and meadow: multiple-choice. "options" has 3 short choices, one of them equal to "answer".
- mountain: memory cards that pair a term with its meaning.
- Give each question a one-line hint that helps without giving the answer away.
- Use about ${PER_ZONE} items per corner. Fewer is fine if the material is short.`

function clean(s: unknown, max: number) {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : ""
}

// Pulls the JSON object out of the model's reply and keeps only well-formed questions.
function parseQuestions(reply: string): Question[] {
  const start = reply.indexOf("{")
  const end = reply.lastIndexOf("}")
  if (start < 0 || end < 0) throw new Error("No questions could be made from this material.")
  // Models sometimes leave trailing commas; remove them before reading the JSON.
  const raw = reply.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1")
  const data = JSON.parse(raw) as Record<string, unknown>
  const out: Question[] = []
  for (const zone of ["reef", "forest", "mountain", "meadow"] as Zone[]) {
    const items = Array.isArray(data[zone]) ? (data[zone] as Record<string, unknown>[]) : []
    for (const item of items.slice(0, 8)) {
      const prompt = clean(item.prompt, 200)
      const answer = clean(item.answer, 120)
      if (!prompt || !answer) continue
      const options = Array.isArray(item.options) ? item.options.map((o) => clean(o, 60)).filter(Boolean) : []
      if (zone !== "mountain") {
        if (!options.includes(answer)) options.unshift(answer)
        if (options.length < 2) continue
      }
      out.push({ zone, prompt, answer, options: zone === "mountain" ? [] : options.slice(0, 4), hint: clean(item.hint, 200) })
    }
  }
  if (out.length === 0) throw new Error("No questions could be made from this material. Try a page with more text.")
  return out
}

export async function POST(arg: Request | Body) {
  try {
    const body = arg instanceof Request ? ((await arg.json()) as Body) : arg
    const pdf = typeof body.pdf === "string" ? body.pdf : ""
    const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : ""
    if (pdf.length > MAX_PDF_CHARS) {
      return Response.json({ error: "This PDF is too big. Try a smaller file, or paste the text." }, { status: 400 })
    }
    if (!pdf && text.length < 40) {
      return Response.json({ error: "There is not enough text to make questions. Paste more text, or try another PDF." }, { status: 400 })
    }
    const content = pdf
      ? [
          { type: "file" as const, data: pdf, mediaType: "application/pdf" },
          { type: "text" as const, text: INSTRUCTIONS },
        ]
      : [{ type: "text" as const, text: `${INSTRUCTIONS}\n\nStudy material:\n"""\n${text}\n"""` }]
    // One retry: a reply that is not clean JSON is asked again.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { text: reply } = await generateText({
        model: anthropic("omg/auto"),
        messages: [{ role: "user", content }],
      })
      try {
        return Response.json({ questions: parseQuestions(reply) })
      } catch (err) {
        if (attempt === 1) throw err
      }
    }
    throw new Error("No questions could be made from this material.")
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read this file."
    return Response.json({ error: message }, { status: 400 })
  }
}
