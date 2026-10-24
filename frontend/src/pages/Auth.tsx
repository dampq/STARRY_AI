import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, ArrowRight, Mail, Sparkles, Check } from "lucide-react";
import { supabase, api, type Health } from "../lib";
import { Button, Field, ErrorBox, Loading } from "../components/ui";
export function SetupNotice() {
  const q = useQuery({
    queryKey: ["health"],
    queryFn: () => api<Health>("/health"),
    staleTime: 15_000,
  });
  return (
    <div className="setup-notice">
      <KeyRound size={21} />
      <div>
        <strong>Your universe needs a connection</strong>
        <p>
          Live storytelling requires a configured Supabase project and a backend
          Gemini or OpenAI key. This site currently shows the interface and
          editorial story concepts; it does not simulate AI generation.
        </p>
        <ul>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> and set the
            Supabase project values.
          </li>
          <li>
            Apply <code>supabase/migrations/001_starry.sql</code> in the
            Supabase SQL editor.
          </li>
          <li>
            Add the selected AI provider’s backend key and Supabase service role
            key, then restart the app.
          </li>
        </ul>
        {q.data && (
          <div className="connection-status">
            <span>{q.data.auth ? "✓" : "○"} Backend auth</span>
            <span>{q.data.storage ? "✓" : "○"} Database</span>
            <span>{q.data.ai ? "✓" : "○"} AI provider</span>
            <span>{supabase ? "✓" : "○"} Frontend auth</span>
          </div>
        )}
        <p>
          Keys belong in secure environment settings, never in chat. See the
          project README for exact setup steps.
        </p>
        <Button size="sm" variant="secondary" onClick={() => q.refetch()}>
          Check connection
        </Button>
        {q.error && <ErrorBox error={q.error} />}
      </div>
    </div>
  );
}
export default function Auth({ mode }: { mode: "login" | "signup" | "reset" }) {
  const nav = useNavigate();
  const [search] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Connect Supabase first.");
      const redirect = window.location.origin + "/settings";
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirect,
        });
        if (error) throw error;
        setSent(true);
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: window.location.origin + "/dashboard",
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      const next = search.get("next");
      nav(
        next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
        { replace: true },
      );
    },
  });
  return (
    <main className="shell auth-page">
      <div className="auth-intro">
        <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
        <h1>
          A universe
          <br />
          with <em>your name</em>
          <br />
          on it.
        </h1>
        <p>
          Old friends. Uncharted worlds.
          <br />
          The extraordinary is waiting for you.
        </p>
        <div className="auth-constellation">
          ✧<span>✦</span>✧
        </div>
      </div>
      <div className="panel auth-card">
        <span className="feature-icon">
          <Sparkles />
        </span>
        <h2>
          {mode === "login"
            ? "Welcome back, storyteller."
            : mode === "signup"
              ? "Let your story begin."
              : "Find your way back."}
        </h2>
        <p>
          {mode === "login"
            ? "Your worlds are right where you left them."
            : mode === "signup"
              ? "Create a private home for your adventures."
              : "We’ll send you a secure password reset link."}
        </p>
        {!supabase ? (
          <SetupNotice />
        ) : sent ? (
          <div className="success-box">
            <Mail />
            <h3>Check your inbox</h3>
            <p>
              {mode === "reset"
                ? "If an account exists, a password reset link is on its way."
                : "Confirm your email to enter your universe."}
            </p>
            <Link to="/login" className="text-link">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mode === "signup" && (
              <Field label="Your name">
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            {mode !== "reset" && (
              <Field
                label="Password"
                hint={
                  mode === "signup"
                    ? "At least 8 characters. Choose a unique password."
                    : undefined
                }
              >
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </Field>
            )}
            {mutation.error && <ErrorBox error={mutation.error} />}
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="full"
            >
              {mutation.isPending
                ? "Connecting…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
              <ArrowRight size={16} />
            </Button>
            {mode === "login" && (
              <Link className="text-link auth-reset" to="/reset">
                Forgot your password?
              </Link>
            )}
            <p className="auth-switch">
              {mode === "signup"
                ? "Already a storyteller?"
                : "New to this universe?"}{" "}
              <Link to={mode === "signup" ? "/login" : "/signup"}>
                {mode === "signup" ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
