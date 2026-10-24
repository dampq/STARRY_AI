import { ConfigSchema, type Proposal } from "../backend/src/domain";
export const config = ConfigSchema.parse({
  theme: "A forgotten kingdom among the stars",
  genre: "Fantasy",
  mood: "Magical",
  setting: "The harbor",
  character: {
    name: "Elara",
    personality: "Curious and cautious",
    background: "A mapmaker",
    goals: "Find the kingdom",
  },
  perspective: "Third Person",
  style: "Cinematic",
  length: "Short",
  choiceCount: 3,
});
export const proposal = (n = 1): Proposal => ({
  scene_title: `The silver threshold ${n}`,
  narrative: `Elara paused at the harbor and considered the stranger's message. The stars reflected in the water like a second sky, and somewhere beyond the rooftops a bell began to ring. She would have to choose her next step with care.`,
  choices: [
    { id: "help", text: "Help the stranger" },
    { id: "leave", text: "Follow the lights" },
    { id: "wait", text: "Wait for the bell" },
  ],
  new_events: [
    {
      id: `event_${n}`,
      description: `Elara heard the harbor bell on night ${n}.`,
      entities: ["protagonist", "origin"],
    },
  ],
  character_updates: [],
  relationship_updates: [],
  inventory_changes: [],
  used_items: [],
  used_abilities: [],
  new_locations: [],
  current_location: "origin",
  quests: [],
  new_world_rules: [],
  new_abilities: [],
  recap: "Elara is at the harbor, where a bell is ringing.",
  consequence_summary: "The stranger waits for an answer.",
  story_finished: false,
});
