import {
  GenerationCooldownNotice,
  useGeminiCooldown,
} from "../components/GenerationCooldown";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Users,
  GitBranch,
  Clock,
  MapPin,
  Package,
  Flag,
  Bookmark,
  Settings2,
  Volume2,
  Pause,
  Play,
  Square,
  Download,
  Check,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import {
  api,
  post,
  type Bundle,
  type Scene,
  type WorldState,
  pathFor,
  useReaderSettings,
  download,
} from "../lib";
import { Button, Field, Modal, ErrorBox, Loading } from "../components/ui";
function StatePanel({ state, view }: { state: WorldState; view: string }) {
  return (
    <div className="universe-grid">
      {(view === "universe" || view === "characters") && (
        <section className="panel memory-panel">
          <h2>
            <Users size={20} />
            Characters
          </h2>
          {state.characters.map((c) => (
            <article className="character-entry" key={c.id}>
              <div className="avatar">{c.name[0]}</div>
              <div>
                <h3>
                  {c.name}{" "}
                  <span className={`status status-${c.status}`}>
                    {c.status}
                  </span>
                </h3>
                <p>{c.personality}</p>
                <p>{c.background}</p>
                <small>
                  Last seen:{" "}
                  {state.locations.find((l) => l.id === c.location)?.name ||
                    c.location}
                </small>
                {state.relationships
                  .filter((r) => r.from === c.id || r.to === c.id)
                  .map((r, i) => (
                    <p key={i} className="relationship">
                      {
                        state.characters.find(
                          (c) => c.id === (r.from === c.id ? r.to : r.from),
                        )?.name
                      }
                      : {r.description}
                    </p>
                  ))}
              </div>
            </article>
          ))}
        </section>
      )}
      {view === "universe" && (
        <>
          <section className="panel memory-panel">
            <h2>
              <Package size={20} />
              Inventory
            </h2>
            {state.inventory.length ? (
              state.inventory.map((x) => (
                <article className="memory-entry" key={x.id}>
                  <h3>
                    {x.name}
                    <span className="status">{x.status}</span>
                  </h3>
                  <p>{x.description}</p>
                </article>
              ))
            ) : (
              <p className="muted">
                Your pockets hold only possibility. No objects acquired yet.
              </p>
            )}
          </section>
          <section className="panel memory-panel">
            <h2>
              <MapPin size={20} />
              Your world
            </h2>
            <p className="current-location">
              Current location:{" "}
              {
                state.locations.find((l) => l.id === state.currentLocation)
                  ?.name
              }
            </p>
            {state.locations.map((l) => (
              <article className="memory-entry" key={l.id}>
                <h3>{l.name}</h3>
                <p>{l.description}</p>
              </article>
            ))}
            {state.worldRules.length > 0 && (
              <>
                <h3>Established world rules</h3>
                {state.worldRules.map((r) => (
                  <p key={r.id}>{r.description}</p>
                ))}
              </>
            )}
          </section>
          <section className="panel memory-panel">
            <h2>
              <Flag size={20} />
              Quests & mysteries
            </h2>
            {state.quests.length ? (
              state.quests.map((q) => (
                <article className="memory-entry" key={q.id}>
                  <span className="status">{q.status}</span>
                  <p>{q.description}</p>
                </article>
              ))
            ) : (
              <p className="muted">No quests discovered yet.</p>
            )}
            <h3>Achievements</h3>
            <p>✦ First Adventure</p>
            {state.facts.length >= 1 && <p>✦ A World That Remembers</p>}
            {state.quests.some((q) => q.status === "completed") && (
              <p>✦ Quest Completed</p>
            )}
            <h3>Abilities</h3>
            {state.abilities.length ? (
              state.abilities.map((a) => <p key={a.id}>{a.description}</p>)
            ) : (
              <p className="muted">No special abilities established.</p>
            )}
          </section>
          <section className="panel memory-panel full-span">
            <h2>
              <Brain size={20} />
              Canonical memories
            </h2>
            <p className="muted">
              Historical facts stay separate from chapter recaps.
            </p>
            {state.facts.length ? (
              state.facts.map((f) => (
                <p className="fact" key={f.id}>
                  ✦ {f.description}
                </p>
              ))
            ) : (
              <p>No events recorded yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
function Constellation({
  bundle,
  onSelect,
}: {
  bundle: Bundle;
  onSelect: (s: Scene) => void;
}) {
  const settings = useReaderSettings();
  const active = new Set(
    pathFor(bundle.scenes, bundle.branch.current_scene_id).map((s) => s.id),
  );
  const lanes = new Map(bundle.branches.map((b, i) => [b.id, i]));
  const pos = (s: Scene) => ({
    x: 90 + (s.scene_number - 1) * 160,
    y: 100 + (lanes.get(s.branch_id) || 0) * 130,
  });
  const width = Math.max(700, ...bundle.scenes.map((s) => pos(s).x + 120));
  const height = Math.max(360, bundle.branches.length * 130 + 100);
  return (
    <>
      <div className="map-legend">
        <span>✦ Active journey</span>
        <span>◇ Alternate paths</span>
        <span>Choose a star to read its saved chapter.</span>
      </div>
      <div
        className="constellation-scroll panel"
        data-motion={settings.animations}
      >
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Story constellation. An accessible chapter list follows."
        >
          <defs>
            <filter id="star-glow">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {bundle.scenes.map((s) => {
            const parent = bundle.scenes.find(
              (p) => p.id === s.parent_scene_id,
            );
            return parent ? (
              <line
                key={s.id}
                x1={pos(parent).x}
                y1={pos(parent).y}
                x2={pos(s).x}
                y2={pos(s).y}
                stroke={active.has(s.id) ? "#b6a4e8" : "#494462"}
                strokeWidth="1.5"
              />
            ) : null;
          })}
          {bundle.scenes.map((s) => (
            <g
              key={s.id}
              className="star-node"
              transform={`translate(${pos(s).x} ${pos(s).y})`}
              onClick={() => onSelect(s)}
            >
              <title>
                {s.title}: {s.recap}
              </title>
              <circle
                r="19"
                fill={active.has(s.id) ? "#b6a4e8" : "#77668d"}
                opacity=".5"
                filter="url(#star-glow)"
              />
              <path
                d="M0 -13L3 -3L13 0L3 3L0 13L-3 3L-13 0L-3 -3Z"
                fill={
                  s.id === bundle.branch.current_scene_id
                    ? "#f5d78e"
                    : active.has(s.id)
                      ? "#d7c7ff"
                      : "#877b9e"
                }
              />
              <text y="35" textAnchor="middle" fill="#d5cbe9" fontSize="12">
                Chapter {s.scene_number}
              </text>
              <text y="53" textAnchor="middle" fill="#a29bb7" fontSize="10">
                {s.title.slice(0, 24)}
                {s.title.length > 24 ? "…" : ""}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <details className="panel chapter-list">
        <summary>
          Accessible chapter list · {bundle.scenes.length} saved stars
        </summary>
        {bundle.scenes.map((s) => (
          <button key={s.id} onClick={() => onSelect(s)}>
            <span>
              Chapter {s.scene_number} ·{" "}
              {bundle.branches.find((b) => b.id === s.branch_id)?.name}
            </span>
            <strong>{s.title}</strong>
            <small>{s.recap}</small>
          </button>
        ))}
      </details>
    </>
  );
}
export default function StoryPage({
  view = "reader",
}: {
  view?: "reader" | "universe" | "characters" | "timeline" | "constellation";
}) {
  const cooldown = useGeminiCooldown();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const branchId = params.get("branch") || undefined;
  const selectedId = params.get("scene");
  const query = useQuery({
    queryKey: ["story", id, branchId],
    queryFn: () =>
      api<Bundle>(`/stories/${id}${branchId ? "?branch=" + branchId : ""}`),
  });
  const bundle = query.data;
  const settings = useReaderSettings();
  const [action, setAction] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [forkScene, setForkScene] = useState<Scene | null>(null);
  const [branchName, setBranchName] = useState("Another possibility");
  const [speech, setSpeech] = useState<"idle" | "playing" | "paused">("idle");
  const [retryRequest, setRetryRequest] = useState<{
    key: string;
    requestId: string;
  } | null>(null);
  const scene = bundle?.scenes.find(
    (s) => s.id === (selectedId || bundle.branch.current_scene_id),
  );
  const path = bundle
    ? pathFor(bundle.scenes, bundle.branch.current_scene_id)
    : [];
  const index = path.findIndex((s) => s.id === scene?.id);
  const isHead =
    !!bundle && (!scene || scene.id === bundle.branch.current_scene_id);
  const suffix = `?branch=${bundle?.branch.id || ""}${scene ? "&scene=" + scene.id : ""}`;
  useEffect(() => {
    setSpeech("idle");
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [scene?.id]);
  const bookmarks = useQuery({
    queryKey: ["bookmarks", id],
    queryFn: () =>
      api<{ id: string; scene_id: string }[]>(`/stories/${id}/bookmarks`),
    enabled: !!bundle,
  });
  const bookmark = bookmarks.data?.find((b) => b.scene_id === scene?.id);
  const toggleBookmark = useMutation({
    mutationFn: () =>
      bookmark
        ? api(`/stories/${id}/bookmarks/${bookmark.id}`, { method: "DELETE" })
        : post(`/stories/${id}/bookmarks`, { sceneId: scene?.id }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["bookmarks", id] }),
  });
  const generation = useMutation({
    retry: false,
    mutationFn: async (choiceId?: string) => {
      if (!bundle) throw new Error("Load the story first.");
      const key = JSON.stringify({
        branch: bundle.branch.id,
        base: scene?.id || null,
        choiceId,
        action: choiceId ? undefined : action,
      });
      const requestId =
        retryRequest?.key === key
          ? retryRequest.requestId
          : crypto.randomUUID();
      setRetryRequest({ key, requestId });
      return post<{ sceneId: string }>(
        `/stories/${id}/${scene ? "continue" : "start"}`,
        {
          branchId: bundle.branch.id,
          baseSceneId: scene?.id || null,
          requestId,
          ...(choiceId ? { choiceId } : scene ? { action } : {}),
        },
      );
    },
    onSuccess: async (result) => {
      setAction("");
      setRetryRequest(null);
      await client.invalidateQueries({ queryKey: ["story", id] });
      client.invalidateQueries({ queryKey: ["stories"] });
      client.invalidateQueries({ queryKey: ["stats"] });
      setParams({ branch: bundle!.branch.id, scene: result.sceneId });
    },
  });
  const fork = useMutation({
    mutationFn: () =>
      post<{ branchId: string }>(`/stories/${id}/branches`, {
        sceneId: forkScene?.id,
        name: branchName,
      }),
    onSuccess: (result) => {
      setForkScene(null);
      setParams({ branch: result.branchId });
      client.invalidateQueries({ queryKey: ["story", id] });
    },
  });
  function select(s: Scene) {
    setParams({ branch: bundle!.branch.id, scene: s.id });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function speak() {
    if (!scene || !("speechSynthesis" in window)) return;
    if (speech === "paused") {
      speechSynthesis.resume();
      setSpeech("playing");
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      scene.title + ". " + scene.narrative,
    );
    u.onend = () => setSpeech("idle");
    u.onerror = () => setSpeech("idle");
    speechSynthesis.speak(u);
    setSpeech("playing");
  }
  function exportStory(format: "txt" | "md") {
    if (!bundle) return;
    const text = path
      .map(
        (s) =>
          `${format === "md" ? "## " : ""}Chapter ${s.scene_number}: ${s.title}\n\n${s.narrative}`,
      )
      .join("\n\n---\n\n");
    download(
      `${bundle.story.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "story"}.${format}`,
      `${format === "md" ? "# " : ""}${bundle.story.title}\n${bundle.branch.name}\n\n${text}`,
    );
  }
  if (query.isPending) return <Loading text="Opening your universe…" />;
  if (query.error || !bundle)
    return (
      <main className="shell workspace-page">
        <ErrorBox
          error={query.error || "Story not found"}
          retry={() => query.refetch()}
        />
      </main>
    );
  const state = scene?.state_snapshot || bundle.state;
  const navItems = [
    { v: "reader", path: "", icon: BookOpen, label: "Read" },
    { v: "universe", path: "/universe", icon: Brain, label: "Story Universe" },
    { v: "characters", path: "/characters", icon: Users, label: "Characters" },
    { v: "timeline", path: "/timeline", icon: Clock, label: "Timeline" },
    {
      v: "constellation",
      path: "/constellation",
      icon: GitBranch,
      label: "Constellation",
    },
  ];
  return (
    <main className="shell workspace-page story-workspace">
      <Link to="/library" className="back-link">
        <ArrowLeft size={15} />
        Back to Library
      </Link>
      <div className="story-top">
        <div>
          <div className="eyebrow">
            {bundle.story.genre} · {bundle.story.mood}
          </div>
          <h1>{bundle.story.title}</h1>
          <p className="saved-status">
            <Check size={13} />{" "}
            {generation.isPending
              ? "Previously saved chapters are safe · new chapter not yet saved"
              : "Loaded from your private story storage"}{" "}
            · {path.length} {path.length === 1 ? "chapter" : "chapters"}
          </p>
        </div>
        <div className="story-top-controls">
          <select
            aria-label="Story branch"
            value={bundle.branch.id}
            disabled={generation.isPending}
            onChange={(e) => setParams({ branch: e.target.value })}
          >
            {bundle.branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            aria-label="Reading settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} />
          </Button>
        </div>
      </div>
      <nav className="story-tabs" aria-label="Story views">
        {navItems.map((n) => (
          <Link
            className={view === n.v ? "active" : ""}
            key={n.v}
            to={`/story/${id}${n.path}${suffix}`}
          >
            <n.icon size={16} />
            {n.label}
          </Link>
        ))}
      </nav>
      {view === "reader" ? (
        <div className="reader-layout">
          <aside className="reader-sidebar panel">
            <div className="eyebrow">YOUR JOURNEY</div>
            <h3>{bundle.branch.name}</h3>
            <ol>
              {path.map((s) => (
                <li key={s.id}>
                  <button
                    className={s.id === scene?.id ? "selected" : ""}
                    onClick={() => select(s)}
                  >
                    <span>{String(s.scene_number).padStart(2, "0")}</span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
            {path.length === 0 && <p>Your first page is waiting.</p>}
            <Link
              to={`/story/${id}/constellation${suffix}`}
              className="text-link"
            >
              <GitBranch size={15} />
              View constellation
            </Link>
            <div className="sidebar-memory">
              <MapPin size={17} />
              <span>
                {
                  state.locations.find((l) => l.id === state.currentLocation)
                    ?.name
                }
              </span>
            </div>
            <div className="sidebar-memory">
              <Package size={17} />
              <span>
                {state.inventory.filter((x) => x.status === "held").length}{" "}
                items carried
              </span>
            </div>
            <div className="sidebar-memory">
              <Flag size={17} />
              <span>
                {state.quests.filter((x) => x.status === "active").length}{" "}
                active quests
              </span>
            </div>
          </aside>
          <div className="reader-main">
            {scene ? (
              <article className="reader-paper panel">
                <div className="reader-chapter">
                  CHAPTER {String(scene.scene_number).padStart(2, "0")}{" "}
                  <span>✦</span>
                  <div className="reader-tools">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={toggleBookmark.isPending}
                      aria-label={
                        bookmark ? "Remove bookmark" : "Bookmark chapter"
                      }
                      onClick={() => toggleBookmark.mutate()}
                    >
                      <Bookmark
                        size={17}
                        fill={bookmark ? "currentColor" : "none"}
                      />
                    </Button>
                    {"speechSynthesis" in window && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={
                            speech === "paused"
                              ? "Resume narration"
                              : "Read aloud"
                          }
                          onClick={speak}
                        >
                          {speech === "paused" ? (
                            <Play size={17} />
                          ) : (
                            <Volume2 size={17} />
                          )}
                        </Button>
                        {speech !== "idle" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Pause narration"
                              onClick={() => {
                                speechSynthesis.pause();
                                setSpeech("paused");
                              }}
                            >
                              <Pause size={17} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Stop narration"
                              onClick={() => {
                                speechSynthesis.cancel();
                                setSpeech("idle");
                              }}
                            >
                              <Square size={15} />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <h2>{scene.title}</h2>
                <div className="chapter-flourish">──── ✧ ────</div>
                {scene.scene_number > 1 && (
                  <details className="recap">
                    <summary>Previously in your story</summary>
                    <p>
                      {path.find((s) => s.id === scene.parent_scene_id)
                        ?.recap ||
                        "You arrived here along another branch of your story."}
                    </p>
                  </details>
                )}
                <div
                  className={`narrative ${settings.serif ? "serif" : ""}`}
                  style={{
                    fontSize: settings.size,
                    lineHeight: settings.spacing,
                  }}
                >
                  {scene.narrative.split(/\n\s*\n/).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                <div className="chapter-flourish end-flourish">✦</div>
                <div className="chapter-navigation">
                  <Button
                    variant="ghost"
                    disabled={index <= 0}
                    onClick={() => select(path[index - 1])}
                  >
                    <ArrowLeft size={16} />
                    Previous chapter
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={index < 0 || index >= path.length - 1}
                    onClick={() => select(path[index + 1])}
                  >
                    Next saved chapter
                    <ArrowRight size={16} />
                  </Button>
                </div>
                {toggleBookmark.error && (
                  <ErrorBox error={toggleBookmark.error} />
                )}
              </article>
            ) : (
              <div className="panel empty-state">
                <Sparkles size={35} />
                <h2>Your opening is waiting.</h2>
                <p>
                  This story draft is saved, but it has no generated chapters
                  yet.
                </p>
                <Button
                  disabled={
                    generation.isPending ||
                    cooldown.blocked ||
                    bundle.story.status === "archived"
                  }
                  onClick={() => generation.mutate(undefined)}
                >
                  Generate opening chapter
                </Button>
              </div>
            )}
            {generation.isPending ? (
              <div className="panel generation-progress" role="status">
                <Loading text="Following your choice through the stars…" />
                <p>
                  Retrieving memories · Planning consequences · Writing ·
                  Checking continuity
                </p>
                <small>
                  Your next chapter is not saved until all checks and the
                  database commit succeed.
                </small>
              </div>
            ) : (
              scene && (
                <section className="decision-section">
                  <div className="eyebrow">
                    {scene.story_finished
                      ? "THE END OF THIS CONSTELLATION"
                      : "EVERY CHOICE WRITES A NEW CONSTELLATION"}
                  </div>
                  <h2>
                    {scene.story_finished
                      ? "A journey worth remembering."
                      : !isHead
                        ? "Another path is always possible."
                        : "What will you do next?"}
                  </h2>
                  {bundle.story.status === "archived" ? (
                    <p>
                      This story is archived. Restore it from your library
                      before continuing.
                    </p>
                  ) : !isHead || scene.story_finished ? (
                    <>
                      <p>
                        {scene.story_finished
                          ? "Export this journey or revisit an earlier star to discover another ending."
                          : "This is a saved chapter. Create an alternate branch to make a different choice without changing the original."}
                      </p>
                      {!scene.story_finished && (
                        <Button onClick={() => setForkScene(scene)}>
                          <GitBranch size={17} />
                          Branch from this chapter
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="choices">
                        {scene.choices.map((c, i) => (
                          <button
                            key={c.id}
                            disabled={cooldown.blocked}
                            onClick={() => generation.mutate(c.id)}
                          >
                            <span>{String.fromCharCode(65 + i)}</span>
                            {c.text}
                            <ArrowRight size={17} />
                          </button>
                        ))}
                      </div>
                      <form
                        className="custom-action"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!cooldown.blocked) generation.mutate(undefined);
                        }}
                      >
                        <Field label="Or write your own next move…">
                          <textarea
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            placeholder="What does your imagination tell you?"
                            minLength={1}
                            maxLength={2000}
                            required
                            rows={3}
                          />
                        </Field>
                        <Button
                          type="submit"
                          disabled={!action.trim() || cooldown.blocked}
                        >
                          <FeatherIcon />
                          Continue Story
                          <ArrowRight size={16} />
                        </Button>
                      </form>
                    </>
                  )}
                </section>
              )
            )}
            <GenerationCooldownNotice cooldown={cooldown} />
            {generation.error && <ErrorBox error={generation.error} />}
          </div>
        </div>
      ) : (
        <>
          <div className="subpage-heading">
            <h2>
              {view === "universe"
                ? "A world that remembers."
                : view === "characters"
                  ? "The souls of your story."
                  : view === "timeline"
                    ? "Every moment left a mark."
                    : "Your story, written in stars."}
            </h2>
            <p>
              {scene
                ? `Snapshot at chapter ${scene.scene_number} · ${scene.title}`
                : "The beginning of your journey"}
            </p>
          </div>
          {view === "timeline" ? (
            <div className="timeline">
              {path.map((s) => (
                <article key={s.id} className="panel timeline-item">
                  <span className="timeline-star">✦</span>
                  <span className="eyebrow">CHAPTER {s.scene_number}</span>
                  <h3>{s.title}</h3>
                  <p>{s.recap}</p>
                  <Link
                    to={`/story/${id}?branch=${bundle.branch.id}&scene=${s.id}`}
                    className="text-link"
                  >
                    Read this chapter <ArrowRight size={14} />
                  </Link>
                </article>
              ))}
              {!path.length && <p>No events recorded yet.</p>}
            </div>
          ) : view === "constellation" ? (
            <Constellation
              bundle={bundle}
              onSelect={(s) => {
                window.location.assign(
                  `/story/${id}?branch=${bundle.branch.id}&scene=${s.id}`,
                );
              }}
            />
          ) : (
            <StatePanel state={state} view={view} />
          )}
        </>
      )}
      <Modal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Make yourself at home"
        description="Reading preferences are saved on this device."
      >
        <Field label={`Font size · ${settings.size}px`}>
          <input
            type="range"
            min="15"
            max="28"
            value={settings.size}
            onChange={(e) => settings.set({ size: Number(e.target.value) })}
          />
        </Field>
        <Field label="Line spacing">
          <select
            value={settings.spacing}
            onChange={(e) => settings.set({ spacing: Number(e.target.value) })}
          >
            <option value="1.6">Compact</option>
            <option value="1.9">Comfortable</option>
            <option value="2.2">Spacious</option>
          </select>
        </Field>
        <label className="check-field">
          <input
            type="checkbox"
            checked={settings.serif}
            onChange={(e) => settings.set({ serif: e.target.checked })}
          />
          Serif reading font
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={settings.animations}
            onChange={(e) => settings.set({ animations: e.target.checked })}
          />
          Gentle animations (respects system reduced motion)
        </label>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => exportStory("txt")}>
            <Download size={16} />
            Text
          </Button>
          <Button variant="secondary" onClick={() => exportStory("md")}>
            <Download size={16} />
            Markdown
          </Button>
        </div>
        {path[0] && bundle.story.status === "active" && (
          <Button
            variant="ghost"
            onClick={() => {
              setSettingsOpen(false);
              setForkScene(path[0]);
            }}
          >
            <RotateCcw size={16} />
            Restart from opening in a new branch
          </Button>
        )}
      </Modal>
      <Modal
        open={!!forkScene}
        onOpenChange={() => setForkScene(null)}
        title="Let another possibility unfold"
        description="The original journey stays intact. A new branch starts with the exact memory snapshot of this saved chapter."
      >
        <Field label="Branch name">
          <input
            value={branchName}
            maxLength={80}
            onChange={(e) => setBranchName(e.target.value)}
          />
        </Field>
        <Button
          disabled={!branchName.trim() || fork.isPending}
          onClick={() => fork.mutate()}
        >
          <GitBranch size={16} />
          {fork.isPending ? "Creating branch…" : "Create alternate journey"}
        </Button>
        {fork.error && <ErrorBox error={fork.error} />}
      </Modal>
    </main>
  );
}
function FeatherIcon() {
  return <Sparkles size={16} />;
}
