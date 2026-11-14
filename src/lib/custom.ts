// The user's own questions (from their PDFs or typed in). A corner that has any of them
// plays with those instead of its built-in questions.
import { useCollection } from "@omg-dev/sdk"
import type { Zone, ZoneId } from "@/lib/lessons"

export type CustomQuestion = {
  id: string
  zone: ZoneId
  prompt: string // the question
  answer: string // the right answer
  options: string[] // wrong and right choices; empty uses the answer alone
  hint: string
}

export function useCustomQuestions() {
  return useCollection<CustomQuestion>({ collection: "questions", api: "/api/questions" })
}

// The corner, with the user's questions in place of the built-in ones when there are any.
export function withCustom(zone: Zone, rows: CustomQuestion[]): Zone {
  const mine = rows.filter((r) => r.zone === zone.id)
  if (mine.length === 0) return zone
  return {
    ...zone,
    questions: mine.map((r) => ({
      prompt: r.prompt,
      options: r.options.length ? r.options : [r.answer],
      answer: r.answer,
      hint: r.hint || "Think about what the question asks.",
    })),
  }
}
