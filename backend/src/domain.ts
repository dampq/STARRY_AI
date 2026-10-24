import { z } from "zod";
export const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const text = z.string().min(1).max(1500);
export const ConfigSchema = z
  .object({
    title: z.string().max(120).default(""),
    theme: z.string().min(10).max(2000),
    genre: z.enum([
      "Fantasy",
      "Mystery",
      "Adventure",
      "Science Fiction",
      "Romance",
      "Horror",
      "Thriller",
      "Historical",
      "Custom",
    ]),
    customGenre: z.string().max(80).default(""),
    mood: z.enum([
      "Magical",
      "Dark",
      "Emotional",
      "Suspenseful",
      "Funny",
      "Inspirational",
      "Mysterious",
    ]),
    setting: z.string().max(1500).default(""),
    character: z.object({
      name: z.string().min(1).max(80),
      personality: z.string().max(500),
      background: z.string().max(1000),
      goals: z.string().max(500),
    }),
    perspective: z.enum(["First Person", "Third Person"]),
    style: z.enum(["Simple", "Descriptive", "Cinematic"]),
    length: z.enum(["Short", "Medium", "Long"]),
    choiceCount: z.number().int().min(2).max(4),
  })
  .strict();
export type StoryConfig = z.infer<typeof ConfigSchema>;
export const CharacterSchema = z.object({
  id: key,
  name: z.string().min(1).max(80),
  personality: text,
  background: text,
  status: z.enum(["alive", "deceased", "missing"]),
  location: key,
});
const ItemSchema = z.object({
  id: key,
  name: text,
  status: z.enum(["held", "lost", "consumed"]),
  description: text,
});
const FactSchema = z.object({
  id: key,
  description: text,
  entities: z.array(key).max(15),
});
const QuestSchema = z.object({
  id: key,
  description: text,
  status: z.enum(["active", "completed"]),
});
const RelationshipSchema = z.object({ from: key, to: key, description: text });
export const StateSchema = z.object({
  currentLocation: key,
  locations: z
    .array(z.object({ id: key, name: text, description: text }))
    .max(150),
  characters: z.array(CharacterSchema).max(100),
  inventory: z.array(ItemSchema).max(150),
  relationships: z.array(RelationshipSchema).max(200),
  quests: z.array(QuestSchema).max(100),
  worldRules: z.array(FactSchema).max(150),
  facts: z.array(FactSchema).max(1200),
  abilities: z.array(z.object({ id: key, description: text })).max(50),
});
export type WorldState = z.infer<typeof StateSchema>;
export const ProposalSchema = z
  .object({
    scene_title: z.string().min(1).max(140),
    narrative: z.string().min(150).max(16000),
    choices: z
      .array(z.object({ id: key, text: z.string().min(1).max(500) }))
      .min(2)
      .max(4),
    new_events: z.array(FactSchema).max(12),
    character_updates: z.array(CharacterSchema).max(10),
    relationship_updates: z.array(RelationshipSchema).max(10),
    inventory_changes: z
      .array(
        z.object({
          id: key,
          name: text,
          description: text,
          operation: z.enum(["acquire", "lose", "consume", "recover"]),
          reason: text,
        }),
      )
      .max(12),
    used_items: z.array(key).max(15),
    used_abilities: z.array(key).max(10),
    new_locations: z
      .array(z.object({ id: key, name: text, description: text }))
      .max(5),
    current_location: key,
    quests: z.array(QuestSchema).max(10),
    new_world_rules: z.array(FactSchema).max(5),
    new_abilities: z.array(z.object({ id: key, description: text })).max(5),
    recap: z.string().min(1).max(1600),
    consequence_summary: z.string().min(1).max(1000),
    story_finished: z.boolean(),
  })
  .strict();
export type Proposal = z.infer<typeof ProposalSchema>;
export type Scene = {
  id: string;
  story_id: string;
  branch_id: string;
  parent_scene_id: string | null;
  scene_number: number;
  title: string;
  narrative: string;
  choices: { id: string; text: string }[];
  state_snapshot: WorldState;
  recap: string;
  story_finished: boolean;
  created_at: string;
};
export type Story = {
  chapterCount?: number;
  id: string;
  user_id: string;
  title: string;
  theme: string;
  genre: string;
  mood: string;
  setting: string;
  preferences: StoryConfig;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};
export function initialState(config: StoryConfig): WorldState {
  return {
    currentLocation: "origin",
    locations: [
      {
        id: "origin",
        name: config.setting || "The beginning",
        description: config.setting || "The starting place of this adventure.",
      },
    ],
    characters: [
      {
        id: "protagonist",
        name: config.character.name,
        personality: config.character.personality || "Curious",
        background:
          config.character.background ||
          "An adventurer at the beginning of a journey.",
        status: "alive",
        location: "origin",
      },
    ],
    inventory: [],
    relationships: [],
    quests: config.character.goals
      ? [
          {
            id: "personal_goal",
            description: config.character.goals,
            status: "active",
          },
        ]
      : [],
    worldRules: [],
    facts: [],
    abilities: [],
  };
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
