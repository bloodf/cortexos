import { createFileRoute, Link, redirect, useRouter, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import brandLogo from "@/assets/cortexos-logo.svg";
import brandMark from "@/assets/cortexos-mark.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { useUI } from "@/hooks/useUI";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/i18n";

interface LoginSearch { redirect?: string }

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user } = useAuth();
  const t = useT();
  const { locale, setLocale } = useUI();
  const router = useRouter();
  const search = useSearch({ from: "/login" });
  const [u, setU] = useState("admin");
  const [p, setP] = useState("admin");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) { throw redirect({ to: search.redirect || "/overview" }); }

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await login(u, p); router.navigate({ to: search.redirect || "/overview" }); }
    catch (e: any) { setErr(e?.message || t.auth.invalid); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[oklch(0.22_0.08_277)] to-[oklch(0.14_0.02_260)] p-12 flex-col justify-between">
        <div className="flex items-center gap-2 text-white">
          <img src={brandLogo} alt={t.app.name} className="h-9 w-auto" />
        </div>
        <div className="text-white/90 max-w-md">
          <p className="text-3xl font-semibold leading-tight">One pane of glass for your home server.</p>
          <p className="mt-3 text-white/60">Native systemd · Docker · Incus · agents. Keyboard-first, observable, calm.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-white/80 text-xs">
          {["29 services", "live metrics", "audit chain"].map((x) => (
            <div key={x} className="rounded-md bg-white/5 border border-white/10 px-3 py-2 backdrop-blur">{x}</div>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <form onSubmit={submit} className="w-full max-w-sm space-y-5">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <img src={brandMark} alt="" className="size-7" aria-hidden />
              <span className="font-semibold">{t.app.name}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{t.auth.signIn}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t.app.tagline}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u">{t.auth.username}</Label>
              <Input id="u" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p">{t.auth.password}</Label>
              <div className="relative">
                <Input id="p" type={show ? "text" : "password"} value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" className="pr-10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? t.auth.hide : t.auth.show}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : t.auth.signIn}</Button>
            <p className="text-xs text-muted-foreground text-center">
              Try <span className="font-mono">admin</span> for admin role, anything else for standard.
            </p>
          </form>
        </div>
        <footer className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
          <span>© CortexOS</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="bg-transparent border rounded px-2 py-1"
          >
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABEL[l]}</option>)}
          </select>
        </footer>
      </div>
    </div>
  );
}
