import { createFileRoute, redirect, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import brandMark from "@/assets/cortexos-mark.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";

interface LoginSearch {
  redirect?: string;
}

function LoginPage() {
  const { login, user } = useAuth();
  const t = useT();
  const router = useRouter();
  const search = useSearch({ from: "/login" });
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    throw redirect({ to: search.redirect || "/overview" });
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(u, p);
      router.navigate({ to: search.redirect || "/overview" });
    } catch (caught: unknown) {
      const caughtErr = caught as { message?: string };
      setErr(caughtErr.message || t.auth.invalid);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[oklch(0.93_0.045_277)] via-background to-[oklch(0.91_0.04_230)] dark:from-[oklch(0.24_0.06_277)] dark:via-background dark:to-[oklch(0.17_0.03_260)]"
      />
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border/60 bg-card/80 p-8 backdrop-blur-xl elev-sheet"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={brandMark} alt="" className="size-12" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t.auth.signIn}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.app.tagline}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="u">{t.auth.username}</Label>
          <Input
            id="u"
            value={u}
            onChange={(e) => setU(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p">{t.auth.password}</Label>
          <div className="relative">
            <Input
              id="p"
              type={show ? "text" : "password"}
              value={p}
              onChange={(e) => setP(e.target.value)}
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? t.auth.hide : t.auth.show}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "…" : t.auth.signIn}
        </Button>
      </form>
      <footer className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
        <span>© CortexOS</span>
      </footer>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});
