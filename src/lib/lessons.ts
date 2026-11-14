// Study content for each corner of the town. Each corner has its own mini game
// and teaches one skill area, built for a different learning need:
//   reef      -> reading and dyslexia      -> Bubble Pop (pop the right word)
//   forest    -> focus and ADHD            -> Arrow Archery (shoot the right answer)
//   mountain  -> memory                    -> Mountain Climb (answer to climb)
//   meadow    -> maths                     -> Target Shoot (shoot the right answer)

export type ZoneId = "reef" | "forest" | "mountain" | "meadow"
export type GameKind = "bubbles" | "archery" | "climb" | "shoot"

export type Choice = {
  prompt: string
  options: string[]
  answer: string
  hint: string
}

export type Zone = {
  id: ZoneId
  name: string
  subject: string
  blurb: string
  game: GameKind
  gameName: string
  color: string // hex, used for the roof and beacon
  tile: { x: number; z: number } // walkable tile in front of the building
  questions: Choice[]
}

export const ZONES: Zone[] = [
  {
    id: "reef",
    name: "Reading Reef",
    subject: "Reading",
    blurb: "Sounds and spelling. Pop the bubble with the right word.",
    game: "bubbles",
    gameName: "Bubble Pop",
    color: "#ffd43b",
    tile: { x: 4, z: 6 },
    questions: [
      { prompt: "Which word rhymes with CAT?", options: ["Dog", "Hat", "Sun"], answer: "Hat", hint: "Listen to the end of the word: -at." },
      { prompt: "Which word starts with the B sound?", options: ["Apple", "Ball", "Sun"], answer: "Ball", hint: "Say each word slowly. Which one starts with buh?" },
      { prompt: "Which spelling is correct?", options: ["frend", "friend", "freind"], answer: "friend", hint: "Sound it out in parts: fr-i-end." },
      { prompt: "Which spelling is correct?", options: ["iland", "island", "ilsand"], answer: "island", hint: "Two parts: is-land." },
    ],
  },
  {
    id: "forest",
    name: "Archer's Grove",
    subject: "Focus",
    blurb: "Big jobs become small steps. Aim at the first step you can do.",
    game: "archery",
    gameName: "Arrow Archery",
    color: "#51cf66",
    tile: { x: 21, z: 6 },
    questions: [
      { prompt: "Your big job is 'clean my room'. What is a tiny first step?", options: ["Clean everything at once", "Pick up one sock", "Give up"], answer: "Pick up one sock", hint: "Choose the smallest thing you could do in one minute." },
      { prompt: "Your brain feels wobbly. What helps most?", options: ["Scroll for an hour", "A one-minute stretch break", "Skip the lesson"], answer: "A one-minute stretch break", hint: "A short movement break resets your focus." },
      { prompt: "Which task has the smallest first step?", options: ["Write the whole essay", "Open the document and type a title", "Finish the project"], answer: "Open the document and type a title", hint: "Pick the one you could start in under a minute." },
      { prompt: "Where is the best place to study?", options: ["A quiet desk", "Bed with the TV on", "A noisy playground"], answer: "A quiet desk", hint: "Think about where your brain can focus." },
    ],
  },
  {
    id: "mountain",
    name: "Memory Mountain",
    subject: "Memory",
    blurb: "Answer each question to climb the mountain. Take your time.",
    game: "climb",
    gameName: "Mountain Climb",
    color: "#adb5bd",
    tile: { x: 4, z: 19 },
    questions: [
      { prompt: "Water freezes at", options: ["100 °C (212 °F)", "0 °C (32 °F)", "50 °C (122 °F)"], answer: "0 °C (32 °F)", hint: "Ice is water that has turned solid in the cold." },
      { prompt: "Plants use sunlight to make", options: ["Rain", "Food", "Rocks"], answer: "Food", hint: "Plants are like little kitchens that cook their own meals." },
      { prompt: "Capital of France", options: ["Lyon", "Paris", "Rome"], answer: "Paris", hint: "It is home to the famous Eiffel Tower." },
      { prompt: "Legs on a spider", options: ["6", "8", "10"], answer: "8", hint: "Spiders have more legs than insects." },
    ],
  },
  {
    id: "meadow",
    name: "Math Meadow",
    subject: "Maths",
    blurb: "Numbers with small steps. Shoot the right answer.",
    game: "shoot",
    gameName: "Target Shoot",
    color: "#f783ac",
    tile: { x: 21, z: 19 },
    questions: [
      { prompt: "7 + 5 = ?", options: ["11", "12", "13"], answer: "12", hint: "Make 10 first: 7 + 3 = 10, then add 2 more." },
      { prompt: "12 − 4 = ?", options: ["6", "8", "9"], answer: "8", hint: "Count back 4 from 12." },
      { prompt: "3 × 4 = ?", options: ["7", "12", "14"], answer: "12", hint: "Three groups of four: 4, 8, 12." },
      { prompt: "Which number is bigger?", options: ["39", "26", "62"], answer: "62", hint: "Compare the tens digit first." },
    ],
  },
]

export function getZone(id: ZoneId): Zone {
  return ZONES.find((z) => z.id === id)!
}

// The zone whose building door is on this tile (or right next to it), if any.
export function zoneNear(x: number, z: number): Zone | undefined {
  return ZONES.find((zone) => Math.abs(zone.tile.x - x) <= 1 && Math.abs(zone.tile.z - z) <= 1)
}
