import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  initialState,
  type Proposal,
  type WorldState,
  type Scene,
} from "../backend/src/domain";
import { applyProposal } from "../backend/src/validators/continuity";
import {
  tellStory,
  type CreativeProvider,
} from "../backend/src/agents/storyteller";
import { retrieveMemory } from "../backend/src/memory/retrieve";
import { config, proposal } from "./fixtures";
function provider(p: () => unknown): CreativeProvider {
  return {
    plan: async () => ({
      pacing: "gentle",
      objectives: ["Discover the source of the bell"],
      continuity_constraints: ["Elara is a mapmaker"],
      user_decision_boundary: "Wait for the user",
    }),
    generate: async () => p(),
    review: async () => ({ valid: true, issues: [] }),
  };
}
describe("canonical continuity", () => {
  it("preserves character identity and append-only history across ten scenes", async () => {
    let state = initialState(config);
    const scenes: Scene[] = [];
    for (let n = 1; n <= 10; n++) {
      const result = await tellStory(
        provider(() => proposal(n)),
        config,
        state,
        scenes,
        "Wait for the bell",
      );
      state = result.nextState;
      scenes.push({
        id: `scene${n}`,
        story_id: "s",
        branch_id: "b",
        parent_scene_id: n > 1 ? `scene${n - 1}` : null,
        scene_number: n,
        title: result.proposal.scene_title,
        narrative: result.proposal.narrative,
        choices: result.proposal.choices,
        state_snapshot: state,
        recap: result.proposal.recap,
        story_finished: false,
        created_at: new Date().toISOString(),
      });
    }
    expect(state.characters[0].name).toBe("Elara");
    expect(state.facts).toHaveLength(10);
    expect(state.facts[0].id).toBe("event_1");
  });
  it("rejects nonexistent, lost, and consumed inventory and unearned abilities", () => {
    const state = initialState(config);
    expect(() =>
      applyProposal(state, { ...proposal(), used_items: ["magic_key"] }),
    ).toThrow("unavailable");
    state.inventory = [
      { id: "key", name: "Key", description: "Silver", status: "lost" },
      {
        id: "potion",
        name: "Potion",
        description: "Healing",
        status: "consumed",
      },
    ];
    for (const id of ["key", "potion"])
      expect(() =>
        applyProposal(state, { ...proposal(), used_items: [id] }),
      ).toThrow("unavailable");
    expect(() =>
      applyProposal(state, { ...proposal(), used_abilities: ["teleport"] }),
    ).toThrow("not established");
  });
  it("allows acquisition and consumption only from a valid before-state", () => {
    const state = initialState(config);
    const acquired = applyProposal(state, {
      ...proposal(),
      inventory_changes: [
        {
          id: "key",
          name: "Key",
          description: "Silver",
          operation: "acquire",
          reason: "Found on the pier",
        },
      ],
    });
    expect(state.inventory).toHaveLength(0);
    const lost = applyProposal(acquired, {
      ...proposal(2),
      inventory_changes: [
        {
          id: "key",
          name: "Key",
          description: "Silver",
          operation: "lose",
          reason: "Dropped into the bay",
        },
      ],
    });
    expect(() =>
      applyProposal(lost, {
        ...proposal(3),
        inventory_changes: [
          {
            id: "key",
            name: "Key",
            description: "Silver",
            operation: "consume",
            reason: "Opened a door",
          },
        ],
      }),
    ).toThrow("not held");
  });
  it("rejects renamed characters, resurrection, facts being replaced, and unknown locations", () => {
    const state = initialState(config);
    const c = state.characters[0];
    expect(() =>
      applyProposal(state, {
        ...proposal(),
        character_updates: [{ ...c, name: "Someone else" }],
      }),
    ).toThrow("identity");
    c.status = "deceased";
    expect(() =>
      applyProposal(state, {
        ...proposal(),
        character_updates: [{ ...c, status: "alive" }],
      }),
    ).toThrow("deceased");
    state.facts = proposal().new_events;
    expect(() => applyProposal(state, proposal())).toThrow("history cannot");
    expect(() =>
      applyProposal(state, { ...proposal(2), current_location: "mars" }),
    ).toThrow("unknown");
  });
  it("repairs an invalid structured scene with a bounded retry and leaves input untouched", async () => {
    const state = initialState(config);
    let calls = 0;
    const p = provider(() =>
      ++calls === 1
        ? { ...proposal(), used_items: ["imaginary_key"] }
        : proposal(),
    );
    const result = await tellStory(p, config, state, [], "Open the gate");
    expect(calls).toBe(2);
    expect(result.nextState.facts).toHaveLength(1);
    expect(state.facts).toHaveLength(0);
  });
  it("refuses to save a scene rejected by narrative review", async () => {
    const state = initialState(config);
    let calls = 0;
    const p = provider(() => {
      calls++;
      return proposal();
    });
    p.review = async () => ({
      valid: false,
      issues: ["Prose uses an unreported magical compass"],
    });
    await expect(
      tellStory(p, config, state, [], "Use a compass"),
    ).rejects.toThrow("two attempts");
    expect(calls).toBe(2);
    expect(state.facts).toHaveLength(0);
  });
  it("does not retry provider outages or mutate state on failure", async () => {
    const state = initialState(config);
    const p = provider(() => {
      throw new Error("Provider unavailable");
    });
    await expect(tellStory(p, config, state, [], "Wait")).rejects.toThrow(
      "Provider unavailable",
    );
    expect(state.facts).toHaveLength(0);
  });
  it("retrieves bounded relevant historical facts, not the full transcript", () => {
    const state = initialState(config);
    state.facts = Array.from({ length: 100 }, (_, i) => ({
      id: `e_${i}`,
      description:
        i === 2 ? "The silver compass belongs to Elara" : `Event ${i}`,
      entities: ["protagonist"],
    }));
    const m = retrieveMemory(state, [], "Inspect the silver compass");
    expect(m.relevantHistoricalFacts).toHaveLength(30);
    expect(m.relevantHistoricalFacts[0].id).toBe("e_2");
    expect(m.currentState).not.toHaveProperty("facts");
  });
});
