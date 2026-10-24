import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Shuffle,
  ArrowRight,
  Feather,
  UserRound,
  SlidersHorizontal,
} from "lucide-react";
import { ConfigSchema, type StoryConfig } from "../../../backend/src/domain";
import { api, post, type Health } from "../lib";
import { Button, Field, ErrorBox, Loading } from "../components/ui";
import {
  GenerationCooldownNotice,
  useGeminiCooldown,
} from "../components/GenerationCooldown";
import { SetupNotice } from "./Auth";
const ideas = [
  {
    theme:
      "A forgotten kingdom hidden among the stars sends a message to the only person who can find it.",
    genre: "Fantasy",
    mood: "Magical",
    setting: "A sky-bound kingdom above a sleeping seaside town",
  },
  {
    theme:
      "A signal from a lost space observatory carries a warning recorded in your own voice, sixty years in the future.",
    genre: "Science Fiction",
    mood: "Suspenseful",
    setting: "The last observatory on a remote lunar outpost",
  },
  {
    theme:
      "A forest knows your name and every path leads to a door that should not exist.",
    genre: "Mystery",
    mood: "Mysterious",
    setting: "The ancient Moonwood, where memories take root",
  },
  {
    theme:
      "A retired dragon opens a bakery and accidentally starts a revolution with a recipe for courage.",
    genre: "Fantasy",
    mood: "Funny",
    setting: "A cozy mountain village on the eve of a royal visit",
  },
] as const;
export default function CreateStory() {
  const cooldown = useGeminiCooldown();
  const [params] = useSearchParams();
  const premise = Number(params.get("premise") || 0);
  const idea = ideas[premise % ideas.length] || ideas[0];
  const [config, setConfig] = useState<StoryConfig>({
    title: "",
    theme: params.has("premise") ? idea.theme : "",
    genre: idea.genre,
    customGenre: "",
    mood: idea.mood,
    setting: "",
    character: { name: "", personality: "", background: "", goals: "" },
    perspective: "Third Person",
    style: "Cinematic",
    length: "Medium",
    choiceCount: 3,
  });
  const [validation, setValidation] = useState("");
  const navigate = useNavigate();
  const [created, setCreated] = useState<{
    id: string;
    branchId: string;
    requestId: string;
  } | null>(null);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api<Health>("/health"),
  });
  const update = <K extends keyof StoryConfig>(key: K, value: StoryConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const generation = useMutation({
    retry: false,
    mutationFn: async () => {
      setValidation("");
      const result = ConfigSchema.safeParse(config);
      if (!result.success) {
        setValidation(
          result.error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join(" · "),
        );
        throw new Error("Please complete the highlighted story details.");
      }
      let record = created;
      if (!record) {
        const value = await post<{ id: string; branchId: string }>(
          "/stories",
          result.data,
        );
        record = { ...value, requestId: crypto.randomUUID() };
        setCreated(record);
      }
      await post(`/stories/${record.id}/start`, {
        branchId: record.branchId,
        baseSceneId: null,
        requestId: record.requestId,
      });
      return record;
    },
    onSuccess: (record) =>
      navigate(`/story/${record.id}?branch=${record.branchId}`),
  });
  return (
    <main className="shell workspace-page">
      <div className="page-heading">
        <div className="eyebrow">A BLANK PAGE. INFINITE POSSIBILITIES.</div>
        <h1>
          What’s your <em>spark?</em>
        </h1>
        <p>Give your imagination a direction. Let the story surprise you.</p>
      </div>
      {health.data?.status !== "ready" && <SetupNotice />}
      <form
        className="create-layout"
        onSubmit={(e) => {
          e.preventDefault();
          if (!cooldown.blocked) generation.mutate();
        }}
      >
        <div className="create-main">
          <fieldset
            className="panel form-panel"
            disabled={generation.isPending || !!created}
          >
            <legend>
              <Feather size={19} />
              The beginning of everything
            </legend>
            <Field
              label="Your story’s spark *"
              hint="A place, a question, a wild idea. At least 10 characters."
            >
              <textarea
                placeholder="A forgotten kingdom hidden among the stars…"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={config.theme}
                onChange={(e) => update("theme", e.target.value)}
              />
            </Field>
            <div className="form-row">
              <Field
                label="Story title"
                hint="Leave blank and the storyteller will choose."
              >
                <input
                  placeholder="An adventure yet unnamed"
                  maxLength={120}
                  value={config.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </Field>
              <Field label="Genre">
                <select
                  value={config.genre}
                  onChange={(e) =>
                    update("genre", e.target.value as StoryConfig["genre"])
                  }
                >
                  {ConfigSchema.shape.genre.options.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
            {config.genre === "Custom" && (
              <Field label="Your genre">
                <input
                  required
                  maxLength={80}
                  value={config.customGenre}
                  onChange={(e) => update("customGenre", e.target.value)}
                />
              </Field>
            )}
            <Field label="How should your story feel?">
              <div className="chip-group">
                {ConfigSchema.shape.mood.options.map((x) => (
                  <button
                    type="button"
                    className={`chip ${config.mood === x ? "selected" : ""}`}
                    aria-pressed={config.mood === x}
                    onClick={() => update("mood", x)}
                    key={x}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="World / setting">
              <textarea
                rows={2}
                maxLength={1500}
                placeholder="Where does your adventure unfold?"
                value={config.setting}
                onChange={(e) => update("setting", e.target.value)}
              />
            </Field>
          </fieldset>
          <fieldset
            className="panel form-panel"
            disabled={generation.isPending || !!created}
          >
            <legend>
              <UserRound size={19} />
              Someone worth following
            </legend>
            <div className="form-row">
              <Field label="Main character’s name *">
                <input
                  required
                  maxLength={80}
                  placeholder="What should we call you?"
                  value={config.character.name}
                  onChange={(e) =>
                    update("character", {
                      ...config.character,
                      name: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Personality">
                <input
                  maxLength={500}
                  placeholder="Curious, brave, a little reckless…"
                  value={config.character.personality}
                  onChange={(e) =>
                    update("character", {
                      ...config.character,
                      personality: e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Background">
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="Everyone has a past…"
                value={config.character.background}
                onChange={(e) =>
                  update("character", {
                    ...config.character,
                    background: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="A goal to chase">
              <input
                maxLength={500}
                placeholder="Find a lost friend. Break a curse. Find yourself."
                value={config.character.goals}
                onChange={(e) =>
                  update("character", {
                    ...config.character,
                    goals: e.target.value,
                  })
                }
              />
            </Field>
          </fieldset>
        </div>
        <aside className="create-aside">
          <div className="panel form-panel">
            <h3>
              <SlidersHorizontal size={18} />
              Make it your own
            </h3>
            <fieldset disabled={generation.isPending || !!created}>
              {(["perspective", "style", "length", "choiceCount"] as const).map(
                (key, i) => (
                  <Field
                    key={key}
                    label={
                      [
                        "Narrative perspective",
                        "Writing style",
                        "Chapter length",
                        "Suggested decisions",
                      ][i]
                    }
                  >
                    <select
                      value={config[key]}
                      onChange={(e) =>
                        update(
                          key,
                          (key === "choiceCount"
                            ? Number(e.target.value)
                            : e.target.value) as never,
                        )
                      }
                    >
                      {(key === "choiceCount"
                        ? [2, 3, 4]
                        : key === "perspective"
                          ? ["First Person", "Third Person"]
                          : key === "style"
                            ? ["Simple", "Descriptive", "Cinematic"]
                            : ["Short", "Medium", "Long"]
                      ).map((x) => (
                        <option key={x} value={x}>
                          {x}
                          {key === "choiceCount" ? " choices" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                ),
              )}
            </fieldset>
            <Button
              variant="secondary"
              type="button"
              className="full"
              disabled={generation.isPending || !!created}
              onClick={() => {
                const idea = ideas[Math.floor(Math.random() * ideas.length)];
                setConfig((c) => ({
                  ...c,
                  ...idea,
                  character: {
                    ...c.character,
                    name: c.character.name || "Elara",
                  },
                }));
              }}
            >
              <Shuffle size={16} />
              Surprise me
            </Button>
            <div className="form-divider" />
            <p className="quiet-note">
              Your adventure is private. Every chapter is saved only after the
              story and its memory pass validation.
            </p>
            <Button
              type="submit"
              className="full"
              disabled={
                generation.isPending ||
                health.data?.status !== "ready" ||
                cooldown.blocked
              }
            >
              <Sparkles size={17} />
              {generation.isPending
                ? "Weaving your universe…"
                : created
                  ? "Retry opening chapter"
                  : "Generate My Story"}
            </Button>
            {created && !generation.isPending && (
              <Button
                variant="ghost"
                className="full"
                type="button"
                onClick={() =>
                  navigate(`/story/${created.id}?branch=${created.branchId}`)
                }
              >
                Open saved draft <ArrowRight size={15} />
              </Button>
            )}
            {generation.isPending && (
              <Loading text="Planning, writing, and checking continuity. This can take a few minutes." />
            )}
            {validation && <ErrorBox error={validation} />}
            {health.data?.provider === "gemini" &&
              health.data.generationMode === "free_tier" && (
                <p className="quiet-note">
                  Free-tier mode: normally 2 AI requests per chapter, spaced at
                  least 15 seconds apart.
                </p>
              )}
            <GenerationCooldownNotice cooldown={cooldown} />
            {generation.error && <ErrorBox error={generation.error} />}
          </div>
          <div className="aside-quote">
            “Every great adventure began with someone wondering…
            <br />
            <em>what if?</em>”<span>✦</span>
          </div>
        </aside>
      </form>
    </main>
  );
}
