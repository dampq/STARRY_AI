import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  ConfigSchema,
  initialState,
  type Proposal,
} from "../backend/src/domain";
import { applyProposal } from "../backend/src/validators/continuity";
const db = new PGlite();
const user = randomUUID(),
  other = randomUUID();
const config = ConfigSchema.parse({
  theme: "An ancient harbor beneath the stars",
  genre: "Fantasy",
  mood: "Magical",
  setting: "Harbor",
  character: {
    name: "Elara",
    personality: "Curious",
    background: "Mapmaker",
    goals: "",
  },
  perspective: "Third Person",
  style: "Cinematic",
  length: "Short",
  choiceCount: 2,
});
const p = (n: number): Proposal => ({
  scene_title: `Harbor ${n}`,
  narrative: "Elara waits by the harbor. ".repeat(10),
  choices: [
    { id: "help", text: "Help the stranger" },
    { id: "leave", text: "Walk away" },
  ],
  new_events: [
    {
      id: `event_${n}`,
      description: `The bell rang ${n} times.`,
      entities: ["protagonist"],
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
  recap: `Night ${n} at the harbor.`,
  consequence_summary: "A bell rang.",
  story_finished: false,
});
async function create(owner = user) {
  return (
    await db.query<{ result: { id: string; branchId: string } }>(
      "select create_adventure($1,$2::jsonb,$3::jsonb) result",
      [owner, JSON.stringify(config), JSON.stringify(initialState(config))],
    )
  ).rows[0].result;
}
async function reserve(
  story: { id: string; branchId: string },
  base: string | null = null,
  request = randomUUID(),
  hash = "action",
  owner = user,
) {
  return {
    request,
    ...(
      await db.query<{
        result: { token?: string; sceneId?: string; replayed: boolean };
      }>("select reserve_generation($1,$2,$3,$4,$5,$6,30) result", [
        owner,
        story.id,
        story.branchId,
        base,
        request,
        hash,
      ])
    ).rows[0].result,
  };
}
async function commit(
  request: string,
  token: string,
  proposal: Proposal,
  state: unknown,
  owner = user,
) {
  return (
    await db.query<{ id: string }>(
      "select commit_generation($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7) id",
      [
        owner,
        request,
        token,
        JSON.stringify(proposal),
        JSON.stringify(state),
        "Help the stranger",
        "help",
      ],
    )
  ).rows[0].id;
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(await readFile("supabase/migrations/001_starry.sql", "utf8"));
  await db.query("insert into auth.users values($1),($2)", [user, other]);
}, 30_000);
afterAll(() => db.close());
describe("PostgreSQL atomic story lifecycle", () => {
  it("commits an opening exactly once, safely replays requests, and survives a fresh query", async () => {
    const story = await create();
    const r = await reserve(story);
    const state = applyProposal(initialState(config), p(1));
    const scene = await commit(r.request, r.token!, p(1), state);
    const replay = await reserve(story, null, r.request);
    expect(replay.sceneId).toBe(scene);
    const count = await db.query<{ count: number }>(
      "select count(*)::int count from story_scenes where story_id=$1",
      [story.id],
    );
    expect(count.rows[0].count).toBe(1);
    const persisted = await db.query<{ state: typeof state }>(
      "select state from story_state where branch_id=$1",
      [story.branchId],
    );
    expect(persisted.rows[0].state.facts).toEqual(state.facts);
  });
  it("prevents concurrent generation, stale heads, and idempotency key collisions", async () => {
    const story = await create();
    const r = await reserve(story);
    await expect(reserve(story)).rejects.toThrow("already generating");
    await expect(reserve(story, null, r.request, "different")).rejects.toThrow(
      "different action",
    );
    const scene = await commit(
      r.request,
      r.token!,
      p(1),
      applyProposal(initialState(config), p(1)),
    );
    await expect(reserve(story, null)).rejects.toThrow("Chapter changed");
    const r2 = await reserve(story, scene);
    await db.query("select fail_generation($1,$2,$3)", [
      user,
      r2.request,
      r2.token,
    ]);
    const retried = await reserve(story, scene, r2.request);
    expect(retried.token).not.toBe(r2.token);
    await expect(commit(r2.request, r2.token!, p(2), {})).rejects.toThrow(
      "expired",
    );
  });
  it("forks a checkpoint with isolated state and preserves original history", async () => {
    const story = await create();
    const state1 = applyProposal(initialState(config), p(1));
    const r = await reserve(story);
    const first = await commit(r.request, r.token!, p(1), state1);
    const r2 = await reserve(story, first);
    const state2 = applyProposal(state1, p(2));
    const second = await commit(r2.request, r2.token!, p(2), state2);
    const bid = (
      await db.query<{ id: string }>("select fork_adventure($1,$2,$3,$4) id", [
        user,
        story.id,
        first,
        "Alternate",
      ])
    ).rows[0].id;
    const alt = { id: story.id, branchId: bid };
    const ar = await reserve(alt, first);
    const altProposal = {
      ...p(3),
      consequence_summary: "The stranger was left behind.",
    };
    await commit(
      ar.request,
      ar.token!,
      altProposal,
      applyProposal(state1, altProposal),
    );
    const states = (
      await db.query<{
        branch_id: string;
        state: { facts: { id: string }[] };
        current_scene_id: string;
      }>(
        "select branch_id,state,current_scene_id from story_state where story_id=$1",
        [story.id],
      )
    ).rows;
    expect(
      states.find((s) => s.branch_id === story.branchId)?.current_scene_id,
    ).toBe(second);
    expect(
      states
        .find((s) => s.branch_id === story.branchId)
        ?.state.facts.map((f) => f.id),
    ).toEqual(["event_1", "event_2"]);
    expect(
      states.find((s) => s.branch_id === bid)?.state.facts.map((f) => f.id),
    ).toEqual(["event_1", "event_3"]);
  });
  it("rolls the whole transaction back when persistence fails", async () => {
    const story = await create();
    const r = await reserve(story);
    const invalid = { ...p(1), scene_title: null };
    await expect(
      commit(r.request, r.token!, invalid as unknown as Proposal, {}),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from story_scenes where story_id=$1",
          [story.id],
        )
      ).rows[0].count,
    ).toBe(0);
    expect(
      (
        await db.query<{ state: unknown }>(
          "select state from story_state where branch_id=$1",
          [story.branchId],
        )
      ).rows[0].state,
    ).toEqual(initialState(config));
  });
  it("checks ownership inside privileged mutation functions", async () => {
    const story = await create();
    await expect(
      reserve(story, null, randomUUID(), "action", other),
    ).rejects.toThrow("Story not found");
  });
  it("enforces RLS on every private table and denies canonical RPCs to user JWT roles", async () => {
    const story = await create();
    const r = await reserve(story);
    await commit(
      r.request,
      r.token!,
      p(1),
      applyProposal(initialState(config), p(1)),
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    await db.exec("set role authenticated");
    try {
      for (const table of [
        "stories",
        "story_branches",
        "story_scenes",
        "story_choices",
        "story_characters",
        "story_events",
        "story_state",
        "story_summaries",
        "story_bookmarks",
        "generation_requests",
      ]) {
        const result = await db.query<{ n: number }>(
          `select count(*)::int n from ${table} where ${table === "stories" ? "id" : "story_id"}=$1`,
          [story.id],
        );
        expect(result.rows[0].n, table).toBe(0);
      }
      await expect(
        db.query("select create_adventure($1,$2::jsonb,$3::jsonb)", [
          other,
          JSON.stringify(config),
          "{}",
        ]),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query(
          "insert into stories(user_id,title,theme,genre,mood,preferences) values($1,$2,$3,$4,$5,$6::jsonb)",
          [other, "X", "X", "X", "X", "{}"],
        ),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec("set role authenticated");
    try {
      expect(
        (await db.query("select id from stories where id=$1", [story.id])).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("reset role");
    }
  });
  it("counts failed retries toward a durable generation budget", async () => {
    const owner = randomUUID();
    await db.query("insert into auth.users values($1)", [owner]);
    const story = await create(owner),
      request = randomUUID();
    for (let n = 0; n < 2; n++) {
      const r = (
        await db.query<{ result: { token: string } }>(
          "select reserve_generation($1,$2,$3,null,$4,$5,2) result",
          [owner, story.id, story.branchId, request, "action"],
        )
      ).rows[0].result;
      await db.query("select fail_generation($1,$2,$3)", [
        owner,
        request,
        r.token,
      ]);
    }
    await expect(
      db.query("select reserve_generation($1,$2,$3,null,$4,$5,2)", [
        owner,
        story.id,
        story.branchId,
        request,
        "action",
      ]),
    ).rejects.toThrow("Hourly generation limit");
  });
  it("recovers an expired lease while denying the obsolete token", async () => {
    const story = await create(),
      old = await reserve(story);
    await db.query(
      "update generation_requests set updated_at=now()-interval '11 minutes' where id=$1",
      [old.request],
    );
    const fresh = await reserve(story);
    await expect(commit(old.request, old.token!, p(1), {})).rejects.toThrow(
      "expired",
    );
    expect(
      await commit(
        fresh.request,
        fresh.token!,
        p(1),
        applyProposal(initialState(config), p(1)),
      ),
    ).toBeTruthy();
  });
  it("isolates profiles and denies anonymous access", async () => {
    await db.query("insert into profiles(id,display_name) values($1,$2)", [
      user,
      "Private name",
    ]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    await db.exec("set role authenticated");
    try {
      expect(
        (await db.query("select * from profiles where id=$1", [user])).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from stories")).rejects.toThrow(
        "permission denied",
      );
    } finally {
      await db.exec("reset role");
    }
  });
});
