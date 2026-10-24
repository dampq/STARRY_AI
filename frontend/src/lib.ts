import { QueryClient } from "@tanstack/react-query";
import { createClient, type Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Story, Scene, WorldState } from "../../backend/src/domain";
export type { Story, Scene, WorldState };
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const useSession = create<{
  session: Session | null;
  loading: boolean;
  set: (session: Session | null) => void;
}>((set, get) => ({
  session: null,
  loading: !!supabase,
  set: (session) => {
    // Clear private data synchronously before exposing a different identity.
    if (get().session?.user.id !== session?.user.id) queryClient.clear();
    set({ session, loading: false });
  },
}));
if (supabase) {
  let changed = false;
  supabase.auth.onAuthStateChange((_event, session) => {
    changed = true;
    useSession.getState().set(session);
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (!changed) useSession.getState().set(error ? null : data.session);
  });
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = useSession.getState().session;
  const response = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });
  const data =
    response.status === 204
      ? null
      : await response.json().catch(() => ({
          error: "The server returned an unreadable response.",
        }));
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.error || "Something went wrong. Please try again.",
    );
  return data;
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export type Health = {
  provider?: "openai" | "gemini";
  status: string;
  auth: boolean;
  storage: boolean;
  ai: boolean;
  model: string;
};
export type Branch = {
  id: string;
  name: string;
  current_scene_id: string | null;
  parent_branch_id: string | null;
  fork_scene_id: string | null;
};
export type Bundle = {
  story: Story;
  branch: Branch;
  branches: Branch[];
  scenes: Scene[];
  state: WorldState;
};
export function pathFor(scenes: Scene[], head: string | null) {
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const path: Scene[] = [];
  const seen = new Set<string>();
  while (head && !seen.has(head)) {
    seen.add(head);
    const scene = byId.get(head);
    if (!scene) break;
    path.unshift(scene);
    head = scene.parent_scene_id;
  }
  return path;
}
export const useReaderSettings = create(
  persist<{
    size: number;
    spacing: number;
    serif: boolean;
    animations: boolean;
    set: (
      v: Partial<{
        size: number;
        spacing: number;
        serif: boolean;
        animations: boolean;
      }>,
    ) => void;
  }>(
    (set) => ({
      size: 19,
      spacing: 1.9,
      serif: true,
      animations: true,
      set: (v) => set(v),
    }),
    { name: "starry-reading-preferences" },
  ),
);
export const date = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
