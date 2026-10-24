import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type Scene,
  type Story,
  type WorldState,
} from "../domain.js";
export function dbError(error: { code?: string; message: string } | null) {
  if (error) {
    if (error.code === "P0002")
      throw new AppError(404, "Story, branch, or chapter not found.");
    if (error.code === "P0001" || error.code === "23505")
      throw new AppError(409, error.message);
    throw new AppError(
      503,
      "Story storage is unavailable. Check the database migration and connection.",
    );
  }
}
export async function rpc<T>(
  db: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  dbError(error);
  return data as T;
}
export class Store {
  constructor(
    public db: SupabaseClient,
    public admin: SupabaseClient,
    public userId: string,
  ) {}
  async story(id: string): Promise<Story> {
    const { data, error } = await this.db
      .from("stories")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    dbError(error);
    if (!data) throw new AppError(404, "Story not found.");
    return data;
  }
  async branch(storyId: string, branchId?: string) {
    let q = this.db.from("story_branches").select("*").eq("story_id", storyId);
    if (branchId) q = q.eq("id", branchId);
    const { data, error } = await q.order("created_at").limit(1).maybeSingle();
    dbError(error);
    if (!data) throw new AppError(404, "Branch not found.");
    return data as {
      id: string;
      current_scene_id: string | null;
      name: string;
      parent_branch_id: string | null;
      fork_scene_id: string | null;
    };
  }
  async scenes(storyId: string): Promise<Scene[]> {
    const scenes: Scene[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.db
        .from("story_scenes")
        .select("*")
        .eq("story_id", storyId)
        .order("created_at")
        .order("id")
        .range(offset, offset + 499);
      dbError(error);
      scenes.push(...(data || []));
      if (!data || data.length < 500) break;
      if (scenes.length >= 10000)
        throw new AppError(
          413,
          "This story exceeds the supported scene limit.",
        );
    }
    return scenes;
  }
  async state(storyId: string, branchId: string): Promise<WorldState> {
    const { data, error } = await this.db
      .from("story_state")
      .select("state")
      .eq("story_id", storyId)
      .eq("branch_id", branchId)
      .single();
    dbError(error);
    if (!data) throw new AppError(503, "Story state could not be loaded.");
    return data.state;
  }
  async bundle(id: string, branchId?: string) {
    const story = await this.story(id);
    const branch = await this.branch(id, branchId);
    const [scenes, state, b] = await Promise.all([
      this.scenes(id),
      this.state(id, branch.id),
      this.db
        .from("story_branches")
        .select("*")
        .eq("story_id", id)
        .order("created_at"),
    ]);
    dbError(b.error);
    return { story, branch, branches: b.data || [], scenes, state };
  }
}
export function scenePath(scenes: Scene[], head: string | null): Scene[] {
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const path: Scene[] = [];
  const seen = new Set<string>();
  while (head) {
    if (seen.has(head)) throw new AppError(500, "Invalid story history.");
    seen.add(head);
    const scene = byId.get(head);
    if (!scene)
      throw new AppError(
        503,
        "The complete chapter history could not be loaded.",
      );
    path.unshift(scene);
    head = scene.parent_scene_id;
  }
  return path;
}
