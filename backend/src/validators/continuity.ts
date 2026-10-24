import {
  AppError,
  StateSchema,
  type Proposal,
  type WorldState,
} from "../domain.js";
/** Only this reducer may transform canonical state. Facts and world rules are append-only. */
export function applyProposal(state: WorldState, p: Proposal): WorldState {
  const next = structuredClone(state);
  const fail = (m: string): never => {
    throw new AppError(422, `Continuity check: ${m}`);
  };
  function unique(items: { id: string }[], label: string) {
    if (new Set(items.map((x) => x.id)).size !== items.length)
      fail(`duplicate ${label} identifiers`);
  }
  for (const [list, label] of [
    [p.choices, "choice"],
    [p.character_updates, "character"],
    [p.inventory_changes, "item"],
    [p.new_events, "event"],
    [p.new_locations, "location"],
    [p.quests, "quest"],
    [p.new_world_rules, "rule"],
    [p.new_abilities, "ability"],
  ] as const)
    unique(list, label);
  if (p.new_events.length + state.facts.length > 1200)
    fail("story memory limit reached; start an alternate adventure");
  for (const id of p.used_items)
    if (!state.inventory.some((x) => x.id === id && x.status === "held"))
      fail(`item ${id} is unavailable`);
  for (const id of p.used_abilities)
    if (!state.abilities.some((x) => x.id === id))
      fail(`ability ${id} is not established`);
  for (const loc of p.new_locations) {
    if (next.locations.some((x) => x.id === loc.id))
      fail(`location ${loc.id} already exists`);
    next.locations.push(loc);
  }
  if (!next.locations.some((x) => x.id === p.current_location))
    fail("unknown current location");
  next.currentLocation = p.current_location;
  for (const c of p.character_updates) {
    if (!next.locations.some((x) => x.id === c.location))
      fail("unknown character location");
    const old = next.characters.find((x) => x.id === c.id);
    if (old) {
      if (old.name !== c.name) fail(`identity of ${c.id} changed`);
      if (old.status === "deceased" && c.status !== "deceased")
        fail(`deceased character ${c.id} cannot return`);
      Object.assign(old, c);
    } else next.characters.push(c);
  }
  if (!next.characters.some((c) => c.id === "protagonist"))
    fail("missing protagonist");
  if (
    next.characters.find((c) => c.id === "protagonist")?.location !==
    next.currentLocation
  )
    fail("protagonist and current location disagree");
  for (const item of p.inventory_changes) {
    const old = next.inventory.find((x) => x.id === item.id);
    if (item.operation === "acquire") {
      if (old)
        fail(`item ${item.id} already exists; use recover for lost items`);
      next.inventory.push({
        id: item.id,
        name: item.name,
        description: item.description,
        status: "held",
      });
    } else {
      if (!old)
        throw new AppError(422, `Continuity check: unknown item ${item.id}`);
      if (old.name !== item.name) fail("item identity changed");
      if (item.operation === "recover") {
        if (old.status !== "lost") fail("only lost items can be recovered");
        old.status = "held";
      } else {
        if (old.status !== "held") fail("item is not held");
        old.status = item.operation === "lose" ? "lost" : "consumed";
      }
    }
  }
  for (const r of p.relationship_updates) {
    if (
      !next.characters.some((x) => x.id === r.from) ||
      !next.characters.some((x) => x.id === r.to)
    )
      fail("relationship references unknown character");
    const old = next.relationships.find(
      (x) => x.from === r.from && x.to === r.to,
    );
    if (old) Object.assign(old, r);
    else next.relationships.push(r);
  }
  for (const q of p.quests) {
    const old = next.quests.find((x) => x.id === q.id);
    if (old) {
      if (old.description !== q.description) fail("quest identity changed");
      if (old.status === "completed" && q.status !== "completed")
        fail("completed quest reopened");
      old.status = q.status;
    } else next.quests.push(q);
  }
  for (const [incoming, target, label] of [
    [p.new_events, next.facts, "event"],
    [p.new_world_rules, next.worldRules, "rule"],
    [p.new_abilities, next.abilities, "ability"],
  ] as const) {
    for (const f of incoming) {
      if (target.some((x) => x.id === f.id))
        fail(`${label} history cannot be overwritten`);
      target.push(f as never);
    }
  }
  const entities = new Set(
    [
      ...next.characters,
      ...next.locations,
      ...next.inventory,
      ...next.quests,
      ...next.abilities,
    ].map((x) => x.id),
  );
  for (const fact of [...p.new_events, ...p.new_world_rules])
    for (const entity of fact.entities)
      if (!entities.has(entity))
        fail(`unknown entity ${entity} in historical fact`);
  return StateSchema.parse(next);
}
