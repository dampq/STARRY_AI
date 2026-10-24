import { systemPrompt } from "./prompts.js";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  AppError,
  ProposalSchema,
  type Proposal,
  type WorldState,
  type Scene,
  type StoryConfig,
} from "../domain.js";
import { applyProposal } from "../validators/continuity.js";
import { retrieveMemory } from "../memory/retrieve.js";
const PlanSchema = z.object({
  pacing: z.string(),
  objectives: z.array(z.string()).max(4),
  continuity_constraints: z.array(z.string()).max(10),
  user_decision_boundary: z.string(),
});
const ReviewSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string()).max(10),
});
const PlannedSceneSchema = z.object({
  plan: PlanSchema,
  proposal: ProposalSchema,
});
export interface CreativeProvider {
  planAndGenerate?(context: unknown): Promise<unknown>;
  plan(context: unknown): Promise<unknown>;
  generate(context: unknown): Promise<unknown>;
  review(context: unknown): Promise<unknown>;
}
export abstract class StructuredProvider implements CreativeProvider {
  protected abstract call<T extends z.ZodType>(
    schema: T,
    name: string,
    instruction: string,
    context: unknown,
  ): Promise<z.infer<T>>;
  plan(context: unknown) {
    return this.call(
      PlanSchema,
      "plan",
      "Plan the next scene from the canonical context and requested action. Track unresolved goals, meaningful consequences, and boundaries of user control. Keep this private.",
      context,
    );
  }
  generate(context: unknown) {
    return this.call(
      ProposalSchema,
      "scene",
      `Write an engaging scene incorporating the action and plan. Short: 150–250 words; Medium: 300–450; Long: 500–700. Respect the configured perspective, style, and exact choiceCount (2–4). Supply meaningful distinct choices even when ending a story (e.g. epilogue paths). used_items and used_abilities must truthfully list all items and abilities used in the prose, and must already exist and be usable in the BEFORE state. A newly found item may be acquired but not used until the next scene. Only append NEW historical facts/events and immutable world rules. Never re-send old facts or locations as new. Character updates are full records, preserving names; existing deceased characters must remain deceased. new_abilities are earned discoveries, not retroactive justification for the action. All used entities must be grounded. The protagonist location must equal current_location; update their full character record when moving. Use customGenre when genre is Custom. recap summarizes known events and never replaces canonical facts. Invent the opening title from the premise, not generic chapter numbering.`,
      context,
    );
  }
  planAndGenerate(context: unknown) {
    return this.call(
      PlannedSceneSchema,
      "planned_scene",
      `Plan the next development and then write its scene in a single structured response. The plan is private: identify pacing, objectives, continuity constraints and the boundary of user control before composing the proposal. Follow the preferences and canonical memory. Incorporate the user action with meaningful consequences. Keep all entity IDs stable and use only established held items/abilities; list every used item/ability. Acquired items cannot be used until a later scene. Character updates must be full records preserving names and irreversible deaths; protagonist.location must equal current_location. Add only NEW events, rules, locations and abilities. All event entity references must exist in the resulting state. Return exactly the configured choiceCount of distinct choices. Short chapters: 150–250 words, Medium: 300–450, Long: 500–700. Respect perspective, style, mood, and customGenre. Keep recaps faithful to known events; never expose the private plan or future spoilers in narrative or recap. Correct any repairIssues from a rejected proposal.`,
      context,
    );
  }
  review(context: unknown) {
    return this.call(
      ReviewSchema,
      "review",
      `Act as an independent continuity editor. Compare narrative AND structured proposal to canonical state, retrieved history and user action. Reject contradictions, unreported item/ability use, renamed characters, resurrection, unexplained knowledge, inconsistent world rules, ignored decisions or major decisions made for the player. Check personality changes are earned. Allow reasonable consequences when a requested action is impossible; do not grant nonexistent inventory. Validate new events faithfully reflect prose. Return concise issues without private reasoning.`,
      context,
    );
  }
}
export class OpenAIProvider extends StructuredProvider {
  private client: OpenAI;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    super();
    this.client = new OpenAI({ apiKey, timeout: 55_000, maxRetries: 1 });
  }
  protected async call<T extends z.ZodType>(
    schema: T,
    name: string,
    instruction: string,
    context: unknown,
  ): Promise<z.infer<T>> {
    if (JSON.stringify(context).length > 120_000)
      throw new AppError(
        413,
        "This story has reached the supported context size. Export your journey and start a new adventure.",
      );
    const response = await this.client.chat.completions.parse({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt + "\n" + instruction },
        { role: "user", content: JSON.stringify(context) },
      ],
      response_format: zodResponseFormat(schema, name),
      max_completion_tokens:
        name === "scene" || name === "planned_scene" ? 6500 : 1800,
    });
    const result = response.choices[0];
    if (
      !result ||
      result.finish_reason !== "stop" ||
      result.message.refusal ||
      !result.message.parsed
    )
      throw new AppError(
        502,
        "The storyteller could not complete a safe, structured response. Your saved chapters are unchanged.",
      );
    return schema.parse(result.message.parsed);
  }
}

export async function tellStory(
  provider: CreativeProvider,
  config: StoryConfig,
  state: WorldState,
  scenes: Scene[],
  action: string,
  options: { mode?: "free_tier" | "standard" } = {},
) {
  const memory = retrieveMemory(state, scenes, action);
  const context = {
    preferences: config,
    memory,
    userAction: action,
    chapter: scenes.length + 1,
  };
  const combined =
    options.mode === "free_tier" && Boolean(provider.planAndGenerate);
  const plan = combined
    ? undefined
    : PlanSchema.parse(await provider.plan(context));
  let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const proposal = combined
        ? PlannedSceneSchema.parse(
            await provider.planAndGenerate!({
              ...context,
              repairIssues: issues,
            }),
          ).proposal
        : ProposalSchema.parse(
            await provider.generate({ ...context, plan, repairIssues: issues }),
          );
      if (proposal.choices.length !== config.choiceCount)
        throw new AppError(422, "Incorrect number of choices");
      const nextState = applyProposal(state, proposal);
      const review = ReviewSchema.parse(
        await provider.review({ ...context, proposal }),
      );
      if (!review.valid) {
        issues = review.issues.length
          ? review.issues
          : ["Continuity review rejected the scene"];
        continue;
      }
      return { proposal, nextState };
    } catch (error) {
      if (
        (error instanceof AppError && error.status === 422) ||
        error instanceof z.ZodError
      ) {
        issues = [error instanceof Error ? error.message : "Invalid response"];
        continue;
      }
      throw error;
    }
  }
  throw new AppError(
    422,
    "The scene failed continuity validation after two attempts. Nothing was saved. Please try a different action.",
  );
}
