import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError, ConfigSchema, initialState, type Scene } from "./domain.js";
import { Store, rpc, dbError, scenePath } from "./database/store.js";
import {
  OpenAIProvider,
  tellStory,
  type CreativeProvider,
} from "./agents/storyteller.js";
import { GeminiProvider } from "./agents/gemini.js";
import type { AIProviderName } from "./ai-config.js";
export interface AppConfig {
  provider?: AIProviderName;
  geminiKey?: string;
  supabaseUrl?: string;
  anonKey?: string;
  serviceKey?: string;
  openaiKey?: string;
  model: string;
  origin: string;
  generationLimit: number;
  production?: boolean;
}
export function createApp(
  config: AppConfig,
  overrideProvider?: CreativeProvider,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            ...(config.supabaseUrl ? [config.supabaseUrl] : []),
          ],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a minute." },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== config.origin
    )
      return res
        .status(403)
        .json({ error: "Unrecognized application origin." });
    next();
  });
  const configured = Boolean(
    config.supabaseUrl && config.anonKey && config.serviceKey,
  );
  const admin = configured
    ? createClient(config.supabaseUrl!, config.serviceKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  const provider =
    overrideProvider ||
    (config.provider === "gemini"
      ? config.geminiKey
        ? new GeminiProvider(config.geminiKey, config.model)
        : null
      : config.openaiKey
        ? new OpenAIProvider(config.openaiKey, config.model)
        : null);
  app.get("/api/health", async (_req, res) => {
    let storage = false;
    if (admin) {
      try {
        const { error } = await admin.from("stories").select("id").limit(1);
        storage = !error;
      } catch {
        storage = false;
      }
    }
    res.json({
      status: storage && provider ? "ready" : "setup_required",
      auth: configured,
      storage,
      ai: Boolean(provider),
      provider: config.provider || "openai",
      model: config.model,
    });
  });
  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!configured || !admin)
        throw new AppError(
          503,
          "Connect Supabase and apply the migration before using your private library.",
        );
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new AppError(401, "Please sign in to continue.");
      const db = createClient(config.supabaseUrl!, config.anonKey!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user)
        throw new AppError(
          401,
          "Your session has expired. Please sign in again.",
        );
      res.locals.store = new Store(db, admin, data.user.id);
      next();
    } catch (e) {
      next(e);
    }
  });
  const getStore = (res: Response): Store => res.locals.store;
  const id = (req: Request) => z.uuid().parse(req.params.id);
  const branchQuery = (req: Request) =>
    req.query.branch ? z.uuid().parse(req.query.branch) : undefined;
  app.get("/api/stats", async (_req, res) => {
    const s = getStore(res);
    const names = [
      "stories",
      "story_scenes",
      "story_choices",
      "story_branches",
    ] as const;
    const results = await Promise.all(
      names.map((t) =>
        s.db.from(t).select("id", { count: "exact", head: true }),
      ),
    );
    results.forEach((r) => dbError(r.error));
    res.json({
      stories: results[0].count || 0,
      chapters: results[1].count || 0,
      decisions: results[2].count || 0,
      playthroughs: results[3].count || 0,
    });
  });
  app.get("/api/stories", async (_req, res) => {
    const { data, error } = await getStore(res)
      .db.from("stories")
      .select("*,story_scenes(scene_number)")
      .order("updated_at", { ascending: false })
      .limit(500);
    dbError(error);
    res.json(
      (data || []).map(({ story_scenes, ...story }) => ({
        ...story,
        chapterCount: Math.max(
          0,
          ...story_scenes.map((s: { scene_number: number }) => s.scene_number),
        ),
      })),
    );
  });
  app.post("/api/stories", async (req, res) => {
    const preferences = ConfigSchema.parse(req.body);
    if (preferences.genre === "Custom" && !preferences.customGenre.trim())
      throw new AppError(400, "Enter a custom genre.");
    const s = getStore(res);
    res.status(201).json(
      await rpc(s.admin, "create_adventure", {
        p_user_id: s.userId,
        p_config: preferences,
        p_state: initialState(preferences),
      }),
    );
  });
  app.get("/api/stories/:id", async (req, res) =>
    res.json(await getStore(res).bundle(id(req), branchQuery(req))),
  );
  app.patch("/api/stories/:id", async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1).max(120).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .strict()
      .refine((x) => Object.keys(x).length > 0)
      .parse(req.body);
    const s = getStore(res);
    await s.story(id(req));
    const { error } = await s.admin
      .from("stories")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id(req))
      .eq("user_id", s.userId);
    dbError(error);
    res.json({ ok: true });
  });
  app.delete("/api/stories/:id", async (req, res) => {
    const s = getStore(res);
    await s.story(id(req));
    const { error } = await s.admin
      .from("stories")
      .delete()
      .eq("id", id(req))
      .eq("user_id", s.userId);
    dbError(error);
    res.status(204).end();
  });
  app.get("/api/stories/:id/scenes", async (req, res) => {
    const s = getStore(res);
    await s.story(id(req));
    res.json(await s.scenes(id(req)));
  });
  app.get("/api/stories/:id/scenes/:sceneId", async (req, res) => {
    const s = getStore(res);
    await s.story(id(req));
    const scene = (await s.scenes(id(req))).find(
      (x) => x.id === z.uuid().parse(req.params.sceneId),
    );
    if (!scene) throw new AppError(404, "Chapter not found.");
    res.json(scene);
  });
  const generate = async (req: Request, res: Response) => {
    if (!provider)
      throw new AppError(
        503,
        "Add the selected AI provider’s backend API key to enable real storytelling. No chapter was generated.",
      );
    const body = z
      .object({
        branchId: z.uuid(),
        baseSceneId: z.uuid().nullable(),
        requestId: z.uuid(),
        choiceId: z.string().max(64).optional(),
        action: z.string().trim().min(1).max(2000).optional(),
      })
      .strict()
      .parse(req.body);
    const s = getStore(res);
    const story = await s.story(id(req));
    const branch = await s.branch(story.id, body.branchId);
    const all = await s.scenes(story.id);
    const base = body.baseSceneId
      ? all.find((x) => x.id === body.baseSceneId)
      : null;
    if (body.baseSceneId && !base)
      throw new AppError(404, "Chapter not found.");
    const opening = req.path.endsWith("/start");
    if (opening !== !body.baseSceneId)
      throw new AppError(
        400,
        "Use start for an opening and continue for an existing chapter.",
      );
    if (base?.story_finished)
      throw new AppError(
        409,
        "This journey is complete. Fork an earlier checkpoint to explore another path.",
      );
    let action = "Begin the story from the provided premise.";
    if (!opening) {
      if (body.choiceId) {
        const choice = base?.choices.find((x) => x.id === body.choiceId);
        if (!choice)
          throw new AppError(
            400,
            "That choice does not belong to this chapter.",
          );
        action = choice.text;
      } else if (body.action) action = body.action;
      else
        throw new AppError(400, "Choose a decision or write your next move.");
    }
    const hash = createHash("sha256")
      .update(JSON.stringify({ action, choiceId: body.choiceId || null }))
      .digest("hex");
    const reservation = await rpc<{
      replayed: boolean;
      sceneId?: string;
      token?: string;
    }>(s.admin, "reserve_generation", {
      p_user_id: s.userId,
      p_story_id: story.id,
      p_branch_id: branch.id,
      p_base_scene_id: body.baseSceneId,
      p_request_id: body.requestId,
      p_action_hash: hash,
      p_limit: config.generationLimit,
    });
    if (reservation.replayed)
      return res.json({ sceneId: reservation.sceneId, replayed: true });
    try {
      const state = await s.state(story.id, branch.id);
      const path = scenePath(all, body.baseSceneId);
      if (path.length >= 200)
        throw new AppError(
          409,
          "This journey reached its 200-chapter limit. Begin another story or fork an earlier checkpoint.",
        );
      const { proposal, nextState } = await tellStory(
        provider,
        story.preferences,
        state,
        path,
        action,
      );
      const sceneId = await rpc<string>(s.admin, "commit_generation", {
        p_user_id: s.userId,
        p_request_id: body.requestId,
        p_token: reservation.token,
        p_proposal: proposal,
        p_state: nextState,
        p_action: action,
        p_choice_id: body.choiceId || null,
      });
      res.status(201).json({ sceneId, replayed: false });
    } catch (error) {
      try {
        await rpc(s.admin, "fail_generation", {
          p_user_id: s.userId,
          p_request_id: body.requestId,
          p_token: reservation.token,
        });
      } catch {
        /* Lease expiry permits recovery when storage is temporarily unavailable. */
      }
      throw error;
    }
  };
  app.post("/api/stories/:id/start", generate);
  app.post("/api/stories/:id/continue", generate);
  app.post("/api/stories/:id/branches", async (req, res) => {
    const { sceneId, name } = z
      .object({ sceneId: z.uuid(), name: z.string().trim().min(1).max(80) })
      .strict()
      .parse(req.body);
    const s = getStore(res);
    await s.story(id(req));
    res.status(201).json({
      branchId: await rpc(s.admin, "fork_adventure", {
        p_user_id: s.userId,
        p_story_id: id(req),
        p_scene_id: sceneId,
        p_name: name,
      }),
    });
  });
  app.get("/api/stories/:id/branches", async (req, res) => {
    const s = getStore(res);
    await s.story(id(req));
    const { data, error } = await s.db
      .from("story_branches")
      .select("*")
      .eq("story_id", id(req))
      .order("created_at");
    dbError(error);
    res.json(data);
  });
  for (const kind of ["memory", "characters", "timeline", "state"])
    app.get(`/api/stories/:id/${kind}`, async (req, res) => {
      const s = getStore(res);
      const bundle = await s.bundle(id(req), branchQuery(req));
      res.json(
        kind === "characters"
          ? bundle.state.characters
          : kind === "timeline"
            ? scenePath(bundle.scenes, bundle.branch.current_scene_id).map(
                (x) => ({
                  id: x.id,
                  title: x.title,
                  recap: x.recap,
                  created_at: x.created_at,
                }),
              )
            : bundle.state,
      );
    });
  app.get("/api/stories/:id/bookmarks", async (req, res) => {
    const s = getStore(res);
    await s.story(id(req));
    const { data, error } = await s.db
      .from("story_bookmarks")
      .select("*")
      .eq("story_id", id(req));
    dbError(error);
    res.json(data);
  });
  app.post("/api/stories/:id/bookmarks", async (req, res) => {
    const { sceneId } = z
      .object({ sceneId: z.uuid() })
      .strict()
      .parse(req.body);
    const s = getStore(res);
    await s.story(id(req));
    if (!(await s.scenes(id(req))).some((x) => x.id === sceneId))
      throw new AppError(404, "Chapter not found.");
    const { data, error } = await s.admin
      .from("story_bookmarks")
      .upsert(
        { user_id: s.userId, story_id: id(req), scene_id: sceneId },
        { onConflict: "user_id,scene_id" },
      )
      .select()
      .single();
    dbError(error);
    res.status(201).json(data);
  });
  app.delete("/api/stories/:id/bookmarks/:bookmarkId", async (req, res) => {
    const s = getStore(res);
    await s.story(id(req));
    const { error } = await s.admin
      .from("story_bookmarks")
      .delete()
      .eq("id", z.uuid().parse(req.params.bookmarkId))
      .eq("story_id", id(req))
      .eq("user_id", s.userId);
    dbError(error);
    res.status(204).end();
  });
  app.get("/api/profile", async (_req, res) => {
    const s = getStore(res);
    const { data, error } = await s.db
      .from("profiles")
      .select("*")
      .eq("id", s.userId)
      .maybeSingle();
    dbError(error);
    res.json(data || { id: s.userId, display_name: "" });
  });
  app.patch("/api/profile", async (req, res) => {
    const body = z
      .object({ display_name: z.string().trim().min(1).max(80) })
      .strict()
      .parse(req.body);
    const s = getStore(res);
    const { error } = await s.db
      .from("profiles")
      .upsert({ id: s.userId, ...body });
    dbError(error);
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError)
        return res.status(400).json({
          error: "Please check your input.",
          fields: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      if (error instanceof AppError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof SyntaxError && "body" in error)
        return res.status(400).json({ error: "Invalid JSON request." });
      const status =
        error && typeof error === "object" && "status" in error
          ? Number(error.status)
          : 0;
      // Do not log prompts, story text, auth headers, provider bodies, or credentials.
      console.error(
        "Request failed:",
        error instanceof Error ? error.constructor.name : "UnknownError",
      );
      return res.status(status === 413 ? 413 : 502).json({
        error:
          status === 413
            ? "The request is too large."
            : "The storyteller is temporarily unavailable. Saved chapters are unchanged; please retry shortly.",
      });
    },
  );
  return app;
}
