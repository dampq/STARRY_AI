import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { useProviderCooldown } from "../lib";

export function useGeminiCooldown() {
  const until = useProviderCooldown((s) => s.until);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return {
    until,
    seconds: Math.max(0, Math.ceil((until - now) / 1000)),
    blocked: until > now,
  };
}
export function GenerationCooldownNotice({
  cooldown,
}: {
  cooldown: ReturnType<typeof useGeminiCooldown>;
}) {
  if (!cooldown.blocked) return null;
  const s = cooldown.seconds;
  const remaining =
    s >= 3600
      ? `${Math.floor(s / 3600)}h ${Math.ceil((s % 3600) / 60)}m`
      : `${Math.floor(s / 60)}m ${s % 60}s`;
  return (
    <div className="quota-notice" role="note">
      <Clock3 size={19} />
      <div>
        <strong>Gemini cooldown · {remaining}</strong>
        <p>
          Your draft is saved. Generation is paused until{" "}
          {new Date(cooldown.until).toLocaleString()}.
        </p>
      </div>
    </div>
  );
}
