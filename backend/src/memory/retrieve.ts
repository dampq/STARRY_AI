import type { Scene, WorldState } from "../domain.js";
/** Bounded lexical retrieval: canonical facts stay intact; summaries never become facts. */
export function retrieveMemory(
  state: WorldState,
  scenes: Scene[],
  action: string,
) {
  const words = new Set(
    action.toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) || [],
  );
  const score = (description: string) =>
    (description.toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) || []).reduce(
      (n, w) => n + Number(words.has(w)),
      0,
    );
  const facts = state.facts
    .map((fact, index) => ({
      fact,
      index,
      score: score(fact.description + " " + fact.entities.join(" ")),
    }))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, 30)
    .map((x) => x.fact);
  const { facts: _, ...current } = state;
  return {
    currentState: current,
    relevantHistoricalFacts: facts,
    recentScenes: scenes.slice(-5).map((s) => ({
      id: s.id,
      title: s.title,
      narrative: s.narrative,
      recap: s.recap,
    })),
    previously: scenes.at(-1)?.recap || "",
    unresolvedThreads: state.quests.filter((x) => x.status === "active"),
  };
}
