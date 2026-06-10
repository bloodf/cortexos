import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { useUI } from "@/hooks/useUI";
import { ACCENTS } from "@/hooks/accents";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/mocks/api";
import { live } from "@/mocks/drift";
import { NAV, PINNED } from "./NavConfig";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/i18n";
import {
  Lock,
  Moon,
  Sun,
  Palette,
  Globe,
  UserCog,
  AlertTriangle,
  Heart,
  Keyboard,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpenHelp?: () => void;
}

const RECENT_KEY = "cortex.palette.recent";

export function CommandPalette({ open, onOpenChange, onOpenHelp }: Props) {
  const t = useT();
  const { user, logout } = useAuth();
  const { theme, setTheme, accent, setAccent, locale, setLocale } = useUI();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const { data: containers = [] } = useQuery({
    queryKey: ["docker", "containers"],
    queryFn: api.docker.containers,
  });
  const { data: units = [] } = useQuery({ queryKey: ["systemd"], queryFn: api.systemd });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: api.users });
  const { data: audit = [] } = useQuery({ queryKey: ["audit"], queryFn: api.audit });
  const [recent, setRecent] = useState<string[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      /* noop */
    }
  }, [open]);

  const navItems = useMemo(() => [PINNED, ...NAV.flatMap((g) => g.items)], []);

  const close = () => onOpenChange(false);

  const runNav = (to: string) => {
    const next = [to, ...recent.filter((r) => r !== to)].slice(0, 5);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
    close();
    navigate({ to });
  };

  const actions: {
    id: string;
    label: string;
    icon: LucideIcon;
    admin?: boolean;
    run: () => void;
  }[] = [
    {
      id: "act-theme",
      label: `Switch theme to ${theme === "dark" ? "light" : "dark"}`,
      icon: theme === "dark" ? Sun : Moon,
      run: () => {
        setTheme(theme === "dark" ? "light" : "dark");
        toast.success("Theme switched");
      },
    },
    { id: "act-help", label: "Show keyboard shortcuts", icon: Keyboard, run: () => onOpenHelp?.() },
    {
      id: "act-crash",
      label: "Simulate: crash random service",
      icon: AlertTriangle,
      admin: true,
      run: () => {
        const target = live.crashRandom();
        qc.invalidateQueries({ queryKey: ["services"] });
        toast.error(target ? `Simulated outage: ${target.name}` : "Nothing online to crash");
      },
    },
    {
      id: "act-heal",
      label: "Simulate: heal all services",
      icon: Heart,
      admin: true,
      run: () => {
        live.healAll();
        qc.invalidateQueries({ queryKey: ["services"] });
        toast.success("All services back online");
      },
    },
    {
      id: "act-restart-caddy",
      label: "Restart caddy.service",
      icon: Lock,
      admin: true,
      run: () => toast.success("Restart queued: caddy.service"),
    },
    {
      id: "act-prune-docker",
      label: "Docker prune (dry-run)",
      icon: Lock,
      admin: true,
      run: () => toast.info("Dry-run: would reclaim 4.2 GB"),
    },
    {
      id: "act-new-incus",
      label: "New Incus instance",
      icon: Lock,
      admin: true,
      run: () => runNav("/incus"),
    },
    {
      id: "act-mark-read",
      label: "Mark all notifications read",
      icon: Lock,
      run: () => toast.success("Notifications cleared"),
    },
    {
      id: "act-logout",
      label: "Sign out",
      icon: LogOut,
      run: () => {
        void logout().finally(() => {
          window.location.href = "/login";
        });
      },
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search apps, pages, actions…" value={q} onValueChange={setQ} />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No results.</CommandEmpty>

        {!q && recent.length > 0 && (
          <CommandGroup heading={t.palette.recent}>
            {recent.map((r) => {
              const nav = navItems.find((n) => n.to === r);
              if (!nav) return null;
              return (
                <CommandItem key={r} onSelect={() => runNav(r)}>
                  <nav.icon className="size-4 mr-2" />
                  {t.nav[nav.key]}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandGroup heading={t.palette.nav}>
          {navItems.map((it) => (
            <CommandItem
              key={it.to}
              onSelect={() => runNav(it.to)}
              value={`nav ${t.nav[it.key]} ${it.to}`}
            >
              <it.icon className="size-4 mr-2" />
              <span className="flex-1">{t.nav[it.key]}</span>
              <span className="text-xs text-muted-foreground">{it.to}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading={t.palette.actions}>
          {actions
            .filter((a) => !a.admin || user?.is_admin)
            .map((a) => (
              <CommandItem
                key={a.id}
                onSelect={() => {
                  a.run();
                  close();
                }}
                value={`action ${a.label}`}
              >
                <a.icon className="size-3.5 mr-2 text-muted-foreground" />
                <span>{a.label}</span>
                {a.admin && (
                  <span className="ml-auto text-[10px] text-muted-foreground">admin</span>
                )}
              </CommandItem>
            ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Accent">
          {ACCENTS.map((a) => (
            <CommandItem
              key={a.id}
              onSelect={() => {
                setAccent(a.id);
                toast.success(`Accent: ${a.label}`);
                close();
              }}
              value={`accent ${a.label}`}
            >
              <span className="size-3 rounded-full mr-2" style={{ background: a.color }} />
              <Palette className="size-3.5 mr-2 text-muted-foreground" />
              {a.label}
              {accent === a.id && (
                <span className="ml-auto text-[10px] text-muted-foreground">current</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Language">
          {LOCALES.map((l) => (
            <CommandItem
              key={l}
              onSelect={() => {
                setLocale(l as Locale);
                toast.success(`Language: ${LOCALE_LABEL[l]}`);
                close();
              }}
              value={`lang ${LOCALE_LABEL[l]}`}
            >
              <Globe className="size-3.5 mr-2 text-muted-foreground" />
              {LOCALE_LABEL[l]}
              {locale === l && (
                <span className="ml-auto text-[10px] text-muted-foreground">current</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading={t.palette.services}>
          {services.slice(0, 20).map((s) => (
            <CommandItem
              key={s.slug}
              onSelect={() => {
                window.open(s.open_url, "_blank");
                close();
              }}
              value={`svc ${s.name} ${s.slug} ${s.category}`}
            >
              <span
                className="size-2 rounded-full mr-2"
                style={{ background: s.icon_color ?? "var(--primary)" }}
              />
              <span className="flex-1">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.category}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Containers">
          {containers.slice(0, 15).map((c) => (
            <CommandItem
              key={c.id}
              onSelect={() => {
                runNav(`/docker/${c.id}`);
              }}
              value={`container ${c.name} ${c.image}`}
            >
              <span
                className="size-2 rounded-full mr-2"
                style={{
                  background: c.state === "running" ? "var(--success)" : "var(--muted-foreground)",
                }}
              />
              <span className="flex-1">{c.name}</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                {c.image}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Systemd units">
          {units.slice(0, 15).map((u) => (
            <CommandItem
              key={u.name}
              onSelect={() => {
                runNav(`/systemd/${u.name}`);
              }}
              value={`unit ${u.name} ${u.description}`}
            >
              <span
                className="size-2 rounded-full mr-2"
                style={{
                  background:
                    u.active === "active"
                      ? "var(--success)"
                      : u.active === "failed"
                        ? "var(--destructive)"
                        : "var(--muted-foreground)",
                }}
              />
              <span className="flex-1 font-mono text-xs">{u.name}</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                {u.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {user?.is_admin && (
          <CommandGroup heading="Users">
            {users.slice(0, 10).map((u) => (
              <CommandItem
                key={u.username}
                onSelect={() => {
                  runNav("/admin/users");
                }}
                value={`user ${u.username} ${u.groups.join(" ")}`}
              >
                <UserCog className="size-3.5 mr-2 text-muted-foreground" />
                <span className="flex-1">{u.username}</span>
                {u.is_admin && <span className="text-[10px] text-muted-foreground">admin</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {user?.is_admin && (
          <CommandGroup heading="Recent audit">
            {audit.slice(0, 8).map((a) => (
              <CommandItem
                key={a.id}
                onSelect={() => {
                  runNav("/audit");
                }}
                value={`audit ${a.tool} ${a.actor} ${a.decision_reason}`}
              >
                <span
                  className="size-2 rounded-full mr-2"
                  style={{
                    background: a.decision === "allow" ? "var(--success)" : "var(--destructive)",
                  }}
                />
                <span className="flex-1 truncate">{a.tool}</span>
                <span className="text-[10px] text-muted-foreground">{a.actor}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="border-t px-3 py-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{t.palette.hints.move}</span>
        <span>{t.palette.hints.select}</span>
        <span>{t.palette.hints.close}</span>
      </div>
    </CommandDialog>
  );
}
