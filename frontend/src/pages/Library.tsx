import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  BookOpen,
  ArrowRight,
  Archive,
  Trash2,
  Pencil,
  GitBranch,
  Feather,
  Sparkles,
} from "lucide-react";
import { api, useSession, date, type Story } from "../lib";
import { Button, Field, Modal, ErrorBox, Loading } from "../components/ui";
import { CoverArt } from "../components/Art";
export default function Library({
  dashboard = false,
}: {
  dashboard?: boolean;
}) {
  const user = useSession((s) => s.session?.user);
  const client = useQueryClient();
  const stories = useQuery({
    queryKey: ["stories"],
    queryFn: () => api<Story[]>("/stories"),
  });
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [sort, setSort] = useState("recent");
  const [archived, setArchived] = useState(false);
  const [edit, setEdit] = useState<{
    story: Story;
    kind: "rename" | "delete";
  } | null>(null);
  const [title, setTitle] = useState("");
  const mutation = useMutation({
    mutationFn: ({
      story,
      kind,
      title,
    }: {
      story: Story;
      kind: "rename" | "delete" | "archive";
      title?: string;
    }) =>
      api(`/stories/${story.id}`, {
        method: kind === "delete" ? "DELETE" : "PATCH",
        body:
          kind === "delete"
            ? undefined
            : JSON.stringify(
                kind === "rename"
                  ? { title }
                  : {
                      status:
                        story.status === "archived" ? "active" : "archived",
                    },
              ),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["stories"] });
      setEdit(null);
    },
  });
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () =>
      api<{
        stories: number;
        chapters: number;
        decisions: number;
        playthroughs: number;
      }>("/stats"),
    enabled: dashboard,
  });
  const all = stories.data || [];
  const recent = all.find((s) => s.status === "active");
  const list = all
    .filter(
      (s) =>
        (archived ? s.status === "archived" : s.status === "active") &&
        s.title.toLowerCase().includes(search.toLowerCase()) &&
        (genre === "All genres" || genre === s.genre),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "created"
          ? b.created_at.localeCompare(a.created_at)
          : b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <main className="shell workspace-page">
      <div className="page-heading heading-row">
        <div>
          <div className="eyebrow">YOUR PERSONAL CORNER OF THE COSMOS</div>
          <h1>
            {dashboard ? (
              <>
                Welcome back,{" "}
                <em>{user?.user_metadata.display_name || "storyteller"}.</em>
              </>
            ) : (
              <>
                Your story <em>constellation.</em>
              </>
            )}
          </h1>
          <p>
            {dashboard
              ? "There are worlds only you can bring to life."
              : "Every world you’ve dreamed. Every path you’ve chosen."}
          </p>
        </div>
        <Button asChild>
          <Link to="/create">
            <Plus size={18} />
            Create New Story
          </Link>
        </Button>
      </div>
      {stories.isPending ? (
        <Loading />
      ) : stories.error ? (
        <ErrorBox error={stories.error} retry={() => stories.refetch()} />
      ) : (
        <>
          {dashboard && recent && (
            <Link to={`/story/${recent.id}`} className="continue-banner panel">
              <CoverArt variant={all.indexOf(recent)} />
              <div>
                <div className="eyebrow">CONTINUE YOUR ADVENTURE</div>
                <h2>{recent.title}</h2>
                <p>{recent.theme}</p>
                <span className="text-link">
                  Continue reading <ArrowRight size={17} />
                </span>
              </div>
              <span className="banner-spark">✧</span>
            </Link>
          )}
          {dashboard && (
            <div className="stats-grid">
              <div>
                <BookOpen />
                <strong>{all.length}</strong>
                <span>Worlds created</span>
              </div>
              <div>
                <Feather />
                <strong>{stats.data?.chapters ?? "…"}</strong>
                <span>Chapters completed</span>
              </div>
              <div>
                <GitBranch />
                <strong>{stats.data?.decisions ?? "…"}</strong>
                <span>Decisions made</span>
              </div>
              <div>
                <Sparkles />
                <strong>{stats.data?.playthroughs ?? "…"}</strong>
                <span>Total playthroughs</span>
              </div>
            </div>
          )}
          <div className="library-toolbar">
            <h2>{dashboard ? "Your stories" : "My Library"}</h2>
            <div className="library-filters">
              <label className="search-input">
                <Search size={17} />
                <input
                  aria-label="Search stories"
                  placeholder="Find a universe…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Filter by genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                {["All genres", ...new Set(all.map((s) => s.genre))].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
              <select
                aria-label="Sort stories"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">Recently updated</option>
                <option value="created">Newest created</option>
                <option value="title">Title A–Z</option>
              </select>
              <button
                className={`chip ${archived ? "selected" : ""}`}
                onClick={() => setArchived(!archived)}
                aria-pressed={archived}
              >
                <Archive size={14} />
                Archived
              </button>
            </div>
          </div>
          {stats.error && <ErrorBox error={stats.error} />}
          {mutation.error && <ErrorBox error={mutation.error} />}
          {list.length ? (
            <div className="library-grid">
              {list.map((s, i) => (
                <article className="story-card panel" key={s.id}>
                  <Link to={`/story/${s.id}`}>
                    <CoverArt variant={i} />
                  </Link>
                  <div className="showcase-body">
                    <span className="genre-label">{s.genre}</span>
                    <h3>
                      <Link to={`/story/${s.id}`}>{s.title}</Link>
                    </h3>
                    <p className="clamp">{s.theme}</p>
                    <small>
                      Chapter {s.chapterCount || 0} · Updated{" "}
                      {date(s.updated_at)}
                    </small>
                    <div className="story-actions">
                      <Button asChild size="sm">
                        <Link to={`/story/${s.id}`}>
                          Continue <ArrowRight size={14} />
                        </Link>
                      </Button>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Rename ${s.title}`}
                          onClick={() => {
                            setTitle(s.title);
                            setEdit({ story: s, kind: "rename" });
                          }}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={mutation.isPending}
                          aria-label={
                            s.status === "archived"
                              ? `Restore ${s.title}`
                              : `Archive ${s.title}`
                          }
                          onClick={() =>
                            mutation.mutate({ story: s, kind: "archive" })
                          }
                        >
                          <Archive size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${s.title}`}
                          onClick={() => setEdit({ story: s, kind: "delete" })}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state panel">
              <Sparkles size={36} />
              <h2>
                {all.length
                  ? "No stories in this orbit."
                  : "Your universe is unwritten."}
              </h2>
              <p>
                {all.length
                  ? "Try another search, genre, or archive filter."
                  : "A single idea is all it takes to begin something extraordinary."}
              </p>
              <Button asChild>
                <Link to="/create">
                  Create your first story <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
      <Modal
        open={!!edit}
        onOpenChange={() => setEdit(null)}
        title={
          edit?.kind === "delete"
            ? "Let this universe go?"
            : "Give your story a name"
        }
        description={
          edit?.kind === "delete"
            ? "This permanently deletes the story, all chapters, alternate branches, and bookmarks. This cannot be undone."
            : "The story itself and its history will stay the same."
        }
      >
        {edit?.kind === "rename" && (
          <Field label="Story title">
            <input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setEdit(null)}>
            Cancel
          </Button>
          <Button
            variant={edit?.kind === "delete" ? "danger" : "default"}
            disabled={
              mutation.isPending || (edit?.kind === "rename" && !title.trim())
            }
            onClick={() => edit && mutation.mutate({ ...edit, title })}
          >
            {mutation.isPending
              ? "Saving…"
              : edit?.kind === "delete"
                ? "Delete story"
                : "Save name"}
          </Button>
        </div>
        {mutation.error && <ErrorBox error={mutation.error} />}
      </Modal>
    </main>
  );
}
