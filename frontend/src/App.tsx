import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Menu,
  X,
  Sparkles,
  ArrowUpRight,
  LogOut,
  UserRound,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Button, Modal, Loading } from "./components/ui";
import { useSession, supabase, useReaderSettings } from "./lib";
export function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!session)
    return (
      <Navigate
        replace
        to={
          "/login?next=" +
          encodeURIComponent(location.pathname + location.search)
        }
      />
    );
  return children;
}
export default function App() {
  const session = useSession((s) => s.session);
  const client = useQueryClient();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState("");
  const animations = useReaderSettings((s) => s.animations);
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.animations = String(animations);
  }, [animations]);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="starfield" aria-hidden="true">
        {Array.from({ length: 70 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37.37) % 100}%`,
              top: `${(i * 17.43) % 100}%`,
              opacity: 0.12 + (i % 5) * 0.12,
              width: i % 8 === 0 ? 3 : 1.5,
              height: i % 8 === 0 ? 3 : 1.5,
            }}
          />
        ))}
      </div>
      <header className="site-header">
        <div className="shell nav-shell">
          <Link className="brand" to="/" aria-label="Starry AI home">
            <span className="brand-mark">
              ✧<i>✦</i>
            </span>
            <span>
              STARRY <b>AI</b>
              <small>YOUR UNIVERSE, YOUR STORY</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <a href="/#features">Features</a>
            <a href="/#explore">Explore Stories</a>
            <NavLink to="/library">My Library</NavLink>
          </nav>
          <div className="nav-actions">
            {session ? (
              <>
                <Link to="/dashboard" className="nav-dashboard">
                  Dashboard
                </Link>
                <Link
                  to="/settings"
                  aria-label="Profile and settings"
                  className="nav-profile"
                >
                  <UserRound size={18} />
                </Link>
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  onClick={async () => {
                    const { error } = await supabase!.auth.signOut();
                    if (error) setLogoutError(error.message);
                    else {
                      client.clear();
                      setLogoutError("");
                    }
                  }}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <Link className="login-link" to="/login">
                Log in
              </Link>
            )}
            <Button asChild size="sm">
              <Link to="/create">
                Begin Your Story
                <Sparkles size={14} />
              </Link>
            </Button>
            <button
              className="mobile-menu-toggle icon-button"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            <Link to="/">Home</Link>
            <a href="/#features" onClick={() => setMenu(false)}>
              Features
            </a>
            <a href="/#explore" onClick={() => setMenu(false)}>
              Explore Stories
            </a>
            <Link to="/library">My Library</Link>
            <Link to={session ? "/dashboard" : "/login"}>
              {session ? "Dashboard" : "Sign in"}
            </Link>
            <Link to="/settings">Settings</Link>
          </nav>
        )}
      </header>
      {logoutError && (
        <p role="alert" className="error-box shell">
          {logoutError}
        </p>
      )}
      <div id="main-content" tabIndex={-1}>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </div>
      <footer className="site-footer shell">
        <div className="footer-top">
          <div>
            <Link className="brand footer-brand" to="/">
              <span className="brand-mark">✧</span>
              <span>
                STARRY <b>AI</b>
              </span>
            </Link>
            <p>A little imagination. A universe of possibilities.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => setInfo("About Starry AI")}>About</button>
            <a href="/#features">Features</a>
            <button onClick={() => setInfo("Privacy")}>Privacy</button>
            <button onClick={() => setInfo("Contact")}>Contact</button>
            <button onClick={() => setInfo("Terms")}>Terms</button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Starry AI. Your universe, your story.
          </span>
          <span>
            Made for the worlds within you. <span className="gold">✦</span>
          </span>
        </div>
      </footer>
      <Modal
        open={!!info}
        onOpenChange={() => setInfo(null)}
        title={info || ""}
        description="Starry AI — Your Universe, Your Story."
      >
        <p>
          {info === "Privacy"
            ? "Stories are private to their owner. The backend sends relevant story context to the configured OpenAI model to generate continuations. Supabase stores account and story data. Reading preferences are stored on this device. No analytics or advertising trackers are included. Delete individual stories from your library. Review your hosting provider and OpenAI data policies before deploying."
            : info === "Terms"
              ? "AI stories are fictional and may contain errors or unexpected themes. You control what you enter and should avoid sharing sensitive personal information. Availability and generation costs depend on the deployment’s AI and database providers. Before public launch, the operator should publish jurisdiction-specific terms and content policies."
              : info === "Contact"
                ? "This is a self-hosted project. Contact the operator of this deployment for account or privacy requests. Developers can use the repository issue tracker for technical reports; do not include credentials or private story text."
                : "Starry AI combines interactive fiction, persistent world memory, and branching journeys. You bring the spark; the storyteller follows your choices while preserving the world’s history."}
        </p>
        {info === "Contact" && (
          <Button variant="secondary" asChild>
            <a
              href="https://github.com/dampq/STARRY_AI/issues"
              target="_blank"
              rel="noreferrer"
            >
              Repository issues <ArrowUpRight size={16} />
            </a>
          </Button>
        )}
      </Modal>
    </div>
  );
}
export function NotFound() {
  return (
    <main className="shell empty-state">
      <span className="heading-star">✧</span>
      <h1>An uncharted corner of the cosmos.</h1>
      <p>That page doesn’t exist. Your next chapter is closer to home.</p>
      <Button asChild>
        <Link to="/">
          Back home <ArrowRight size={17} />
        </Link>
      </Button>
    </main>
  );
}
