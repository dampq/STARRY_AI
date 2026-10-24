import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserRound, ShieldCheck, KeyRound } from "lucide-react";
import { api, supabase, useSession } from "../lib";
import { Button, Field, ErrorBox } from "../components/ui";
export default function Settings() {
  const user = useSession((s) => s.session?.user);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState("");
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<{ display_name: string }>("/profile"),
  });
  const mutation = useMutation({
    mutationFn: async (kind: "profile" | "password") => {
      setSuccess("");
      if (!supabase) throw new Error("Connect Supabase first.");
      if (kind === "profile") {
        await api("/profile", {
          method: "PATCH",
          body: JSON.stringify({ display_name: name }),
        });
        const { error } = await supabase.auth.updateUser({
          data: { display_name: name },
        });
        if (error) throw error;
        await profile.refetch();
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
      }
      setSuccess(
        kind === "profile"
          ? "Your profile is updated."
          : "Your password has been changed.",
      );
    },
  });
  return (
    <main className="shell workspace-page settings-page">
      <div className="page-heading">
        <div className="eyebrow">YOUR PLACE IN THE UNIVERSE</div>
        <h1>
          A little more <em>you.</em>
        </h1>
        <p>Manage your profile, privacy, and account security.</p>
      </div>
      <div className="universe-grid">
        <form
          className="panel form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate("profile");
          }}
        >
          <h2>
            <UserRound size={20} />
            Storyteller profile
          </h2>
          <Field label="Display name">
            <input
              value={name}
              placeholder={
                profile.data?.display_name ||
                user?.user_metadata.display_name ||
                "Your name"
              }
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </Field>
          <Field label="Email">
            <input value={user?.email || ""} disabled />
          </Field>
          <Button disabled={mutation.isPending}>Save profile</Button>
        </form>
        <form
          className="panel form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate("password");
          }}
        >
          <h2>
            <KeyRound size={20} />
            Account security
          </h2>
          <Field
            label="New password"
            hint="At least 8 characters. You may need to reauthenticate for sensitive changes."
          >
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button disabled={mutation.isPending}>Update password</Button>
        </form>
        <section className="panel form-panel full-span">
          <h2>
            <ShieldCheck size={20} />
            Private by design
          </h2>
          <p>
            Your stories are private. Story content needed for generation is
            sent to the configured AI provider. There is no public publishing
            feature. You can export a playthrough from its reader settings or
            permanently delete a story from your library.
          </p>
        </section>
      </div>
      {success && (
        <p role="status" className="success-box">
          {success}
        </p>
      )}
      {mutation.error && <ErrorBox error={mutation.error} />}
      {profile.error && <ErrorBox error={profile.error} />}
    </main>
  );
}
