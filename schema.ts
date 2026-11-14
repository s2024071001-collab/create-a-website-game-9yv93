import { collection, defineSchema, fields } from "@omg-dev/schema"

// Questions the user wrote or imported from their own PDFs. Each row belongs to one corner
// of the town. Memory cards use prompt as the front and answer as the back.
export default defineSchema({
  collections: {
    questions: collection({
      fields: {
        zone: fields.enum(["reef", "forest", "mountain", "meadow"]),
        prompt: fields.string(),
        answer: fields.string(),
        options: fields.array("string"),
        hint: fields.string(),
      },
    }),
  },
})
