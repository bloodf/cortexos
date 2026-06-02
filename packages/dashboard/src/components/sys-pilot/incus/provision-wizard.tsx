"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KNOWN_PROXIES, HERMES_PORT_MIN, type IncusInstanceConfig, type ProxyName } from "@/lib/incus/instance-config";

interface WizardDefaults {
	image: string;
	ghOrg: string;
	bridge: string;
	pool: string;
	branch: string;
	proxies: string[];
}

interface PreflightCheck {
	id: string;
	label: string;
	pass: boolean;
	detail?: string;
}

interface PreflightReport {
	ok: boolean;
	checks: PreflightCheck[];
}

interface ProgressStep {
	step: string;
	status: string;
	n?: number;
	total?: number;
	detail?: string;
}

const FALLBACK_DEFAULTS: WizardDefaults = {
	image: "cortexos-base/latest",
	ghOrg: "bloodf",
	bridge: "incusbr0",
	pool: "cortex-zfs",
	branch: "main",
	proxies: ["9router", "honcho", "ollama"],
};

type Phase = "form" | "validating" | "provisioning" | "done" | "failed";

const STEP_LABELS = ["Target", "Image", "Hermes", "Network", "Review"];

export function ProvisionWizard() {
	const [step, setStep] = React.useState(0);
	const [phase, setPhase] = React.useState<Phase>("form");
	const [defaultsLoaded, setDefaultsLoaded] = React.useState(false);

	// target
	const [mode, setMode] = React.useState<"existing" | "new">("new");
	const [slug, setSlug] = React.useState("");
	const [repoUrl, setRepoUrl] = React.useState("");
	const [branch, setBranch] = React.useState("main");
	const [ghOrg, setGhOrg] = React.useState("bloodf");
	const [description, setDescription] = React.useState("");

	// image
	const [imageAlias, setImageAlias] = React.useState("cortexos-base/latest");
	const [pool, setPool] = React.useState("cortex-zfs");
	const [cpu, setCpu] = React.useState("");
	const [memory, setMemory] = React.useState("");
	const [profilesText, setProfilesText] = React.useState("default");
	const [availableImages, setAvailableImages] = React.useState<string[]>([]);

	// hermes
	const [hermesEnabled, setHermesEnabled] = React.useState(true);
	const [hermesProfile, setHermesProfile] = React.useState("");
	const [hermesPort, setHermesPort] = React.useState(HERMES_PORT_MIN);
	const [hermesModel, setHermesModel] = React.useState("");
	const [proxies, setProxies] = React.useState<ProxyName[]>([...KNOWN_PROXIES]);

	// network
	const [bridge, setBridge] = React.useState("incusbr0");
	const [tailscale, setTailscale] = React.useState(true);
	const [tailscaleKeyRef, setTailscaleKeyRef] = React.useState("");
	const [webAccess, setWebAccess] = React.useState("none");

	// run state
	const [preflight, setPreflight] = React.useState<PreflightReport | null>(null);
	const [progress, setProgress] = React.useState<ProgressStep[]>([]);
	const [runStatus, setRunStatus] = React.useState("");
	const [requestId, setRequestId] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);
	const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

	// Load wizard defaults + available images once.
	React.useEffect(() => {
		let alive = true;
		(async () => {
			try {
				const res = await fetch("/api/incus/settings");
				if (res.ok) {
					const json = await res.json();
					const d = (json?.data?.defaults ?? FALLBACK_DEFAULTS) as WizardDefaults;
					if (alive) {
						setImageAlias(d.image ?? FALLBACK_DEFAULTS.image);
						setGhOrg(d.ghOrg ?? FALLBACK_DEFAULTS.ghOrg);
						setBridge(d.bridge ?? FALLBACK_DEFAULTS.bridge);
						setPool(d.pool ?? FALLBACK_DEFAULTS.pool);
						setBranch(d.branch ?? FALLBACK_DEFAULTS.branch);
						setProxies((d.proxies ?? FALLBACK_DEFAULTS.proxies).filter((p): p is ProxyName => (KNOWN_PROXIES as readonly string[]).includes(p)));
					}
				}
			} catch {
				/* keep fallbacks */
			}
			try {
				const res = await fetch("/api/incus/images");
				if (res.ok) {
					const json = await res.json();
					const aliases = (json?.data ?? [])
						.flatMap((i: { aliases?: string[] }) => i.aliases ?? [])
						.filter(Boolean) as string[];
					if (alive) setAvailableImages([...new Set(aliases)]);
				}
			} catch {
				/* optional */
			}
			if (alive) setDefaultsLoaded(true);
		})();
		return () => {
			alive = false;
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	function buildConfig(): IncusInstanceConfig {
		const profiles = profilesText.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
		return {
			target: {
				mode,
				repoUrl: mode === "existing" ? repoUrl.trim() || undefined : undefined,
				branch: branch.trim(),
				ghOrg: ghOrg.trim(),
				slug: slug.trim(),
				description: description.trim() || undefined,
			},
			image: {
				alias: imageAlias.trim(),
				gastown: false,
				profiles: profiles.length ? profiles : ["default"],
				cpu: cpu.trim() || undefined,
				memory: memory.trim() || undefined,
				pool: pool.trim(),
			},
			hermes: {
				enabled: hermesEnabled,
				profile: hermesEnabled ? hermesProfile.trim() || slug.trim() : "",
				port: hermesEnabled ? hermesPort : 0,
				model: hermesEnabled ? hermesModel.trim() : "",
				proxies: hermesEnabled ? proxies : [],
			},
			network: {
				bridge: bridge.trim(),
				tailscale,
				tailscaleKeyRef: tailscale ? tailscaleKeyRef.trim() || undefined : undefined,
				webAccess: webAccess.trim() || "none",
			},
		};
	}

	function toggleProxy(p: ProxyName) {
		setProxies((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
	}

	function startPolling(name: string) {
		if (pollRef.current) clearInterval(pollRef.current);
		pollRef.current = setInterval(async () => {
			try {
				const res = await fetch(`/api/incus/instances/${encodeURIComponent(name)}/provision/status`);
				if (!res.ok) return;
				const json = await res.json();
				const data = json?.data as { status: string; requestId: string; steps: ProgressStep[] } | undefined;
				if (!data) return;
				setProgress(data.steps ?? []);
				setRunStatus(data.status);
				if (data.status === "active" || data.status === "failed") {
					if (pollRef.current) clearInterval(pollRef.current);
					pollRef.current = null;
				}
			} catch {
				/* transient; keep polling */
			}
		}, 2000);
	}

	async function run() {
		const cfg = buildConfig();
		const name = cfg.target.slug;
		if (!name) {
			toast.error("Instance slug is required");
			setStep(0);
			return;
		}
		setError(null);
		setPreflight(null);
		setProgress([]);

		// 1) Save draft config.
		setPhase("validating");
		try {
			const createRes = await fetch("/api/incus/instances", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ config: cfg }),
			});
			if (!createRes.ok && createRes.status !== 409) {
				const j = await createRes.json().catch(() => ({}));
				throw new Error(j.error || `Failed to save config (${createRes.status})`);
			}
			// 409 = config already exists; reuse it.

			// 2) Validate (deterministic preflight gate).
			const valRes = await fetch(`/api/incus/instances/${encodeURIComponent(name)}/validate`, { method: "POST" });
			const valJson = await valRes.json().catch(() => ({}));
			if (!valRes.ok) throw new Error(valJson.error || `Validation request failed (${valRes.status})`);
			const report = valJson?.data?.preflight as PreflightReport | undefined;
			setPreflight(report ?? null);
			if (!report?.ok) {
				setPhase("form");
				toast.error("Preflight validation failed. Review the checks below.");
				setStep(STEP_LABELS.length - 1);
				return;
			}
		} catch (e) {
			setPhase("failed");
			setError(e instanceof Error ? e.message : "Validation failed");
			return;
		}

		// 3) Provision (blocking on the server; we poll status concurrently).
		setPhase("provisioning");
		setRunStatus("provisioning");
		startPolling(name);
		try {
			const provRes = await fetch(`/api/incus/instances/${encodeURIComponent(name)}/provision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			const provJson = await provRes.json().catch(() => ({}));
			if (pollRef.current) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
			if (provJson?.requestId) setRequestId(provJson.requestId);
			// Final status poll to capture the last progress lines.
			await fetch(`/api/incus/instances/${encodeURIComponent(name)}/provision/status${provJson?.requestId ? `?requestId=${encodeURIComponent(provJson.requestId)}` : ""}`)
				.then((r) => (r.ok ? r.json() : null))
				.then((j) => {
					if (j?.data?.steps) setProgress(j.data.steps);
				})
				.catch(() => {});
			if (!provRes.ok || provJson?.success !== true) {
				throw new Error(provJson.error || `Provisioning failed (${provRes.status})`);
			}
			setPhase("done");
			setRunStatus("active");
			toast.success(`Instance "${name}" provisioned`);
		} catch (e) {
			if (pollRef.current) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
			setPhase("failed");
			setRunStatus("failed");
			setError(e instanceof Error ? e.message : "Provisioning failed");
		}
	}

	function reset() {
		if (pollRef.current) clearInterval(pollRef.current);
		pollRef.current = null;
		setPhase("form");
		setStep(0);
		setPreflight(null);
		setProgress([]);
		setError(null);
		setRequestId("");
		setRunStatus("");
	}

	const busy = phase === "validating" || phase === "provisioning";

	// ----- Run / progress view -----
	if (phase !== "form") {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						{phase === "done" ? <CheckCircle2 className="size-5 text-emerald-500" /> : phase === "failed" ? <XCircle className="size-5 text-destructive" /> : <Loader2 className="size-5 animate-spin" />}
						{phase === "validating" && "Validating configuration…"}
						{phase === "provisioning" && "Provisioning instance…"}
						{phase === "done" && "Instance provisioned"}
						{phase === "failed" && "Provisioning failed"}
					</CardTitle>
					<CardDescription>
						{slug}{requestId ? ` · request ${requestId.slice(0, 8)}` : ""}{runStatus ? ` · ${runStatus}` : ""}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2">
					{error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
					{progress.length === 0 && busy && <p className="text-sm text-muted-foreground">Waiting for the provisioning script to report progress…</p>}
					<ol className="space-y-1.5">
						{progress.map((s, i) => (
							<li key={`${s.step}-${i}`} className="flex items-center gap-2 text-sm">
								{s.status === "ok" || s.status === "done" ? (
									<CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
								) : s.status === "error" || s.status === "failed" ? (
									<XCircle className="size-4 shrink-0 text-destructive" />
								) : (
									<Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
								)}
								<span className="font-medium">{s.step}</span>
								{typeof s.n === "number" && typeof s.total === "number" && (
									<span className="tabular-nums text-xs text-muted-foreground">{s.n}/{s.total}</span>
								)}
								{s.detail && <span className="truncate text-xs text-muted-foreground">{s.detail}</span>}
							</li>
						))}
					</ol>
				</CardContent>
				<CardFooter className="justify-end gap-2">
					{(phase === "done" || phase === "failed") && (
						<Button variant="outline" onClick={reset}>Provision another</Button>
					)}
				</CardFooter>
			</Card>
		);
	}

	// ----- Form / wizard view -----
	return (
		<Card>
			<CardHeader>
				<div className="flex flex-wrap items-center gap-2">
					{STEP_LABELS.map((label, i) => (
						<React.Fragment key={label}>
							{i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
							<button
								type="button"
								onClick={() => setStep(i)}
								className={`rounded-md px-2 py-1 text-sm transition-colors ${i === step ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
							>
								{label}
							</button>
						</React.Fragment>
					))}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{step === 0 && (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>Source</Label>
							<Select value={mode} onValueChange={(v) => setMode((v as "existing" | "new") ?? "new")}>
								<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="new">New project (no clone)</SelectItem>
									<SelectItem value="existing">Existing repo (clone)</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Slug / instance name</Label>
							<Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-project" />
						</div>
						{mode === "existing" && (
							<div className="space-y-2">
								<Label>Repository URL</Label>
								<Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo.git" />
							</div>
						)}
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label>Branch</Label>
								<Input value={branch} onChange={(e) => setBranch(e.target.value)} />
							</div>
							<div className="space-y-2">
								<Label>GitHub org</Label>
								<Input value={ghOrg} onChange={(e) => setGhOrg(e.target.value)} />
							</div>
						</div>
						<div className="space-y-2">
							<Label>Description (optional)</Label>
							<Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
						</div>
					</div>
				)}

				{step === 1 && (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>Image alias</Label>
							{availableImages.length > 0 ? (
								<Select value={imageAlias} onValueChange={(v) => setImageAlias(v ?? "")}>
									<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
									<SelectContent>
										{availableImages.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
									</SelectContent>
								</Select>
							) : (
								<Input value={imageAlias} onChange={(e) => setImageAlias(e.target.value)} />
							)}
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label>Storage pool</Label>
								<Input value={pool} onChange={(e) => setPool(e.target.value)} />
							</div>
							<div className="space-y-2">
								<Label>Profiles (comma/space-separated)</Label>
								<Input value={profilesText} onChange={(e) => setProfilesText(e.target.value)} />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label>CPU limit (optional)</Label>
								<Input value={cpu} onChange={(e) => setCpu(e.target.value)} placeholder="e.g. 4" />
							</div>
							<div className="space-y-2">
								<Label>Memory limit (optional)</Label>
								<Input value={memory} onChange={(e) => setMemory(e.target.value)} placeholder="e.g. 8GiB" />
							</div>
						</div>
					</div>
				)}

				{step === 2 && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label>Enable Hermes profile</Label>
								<p className="text-xs text-muted-foreground">Provision an isolated Hermes assistant profile.</p>
							</div>
							<Switch checked={hermesEnabled} onCheckedChange={setHermesEnabled} />
						</div>
						{hermesEnabled && (
							<>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label>Profile name</Label>
										<Input value={hermesProfile} onChange={(e) => setHermesProfile(e.target.value)} placeholder={slug || "profile"} />
									</div>
									<div className="space-y-2">
										<Label>API port</Label>
										<Input type="number" value={hermesPort} onChange={(e) => setHermesPort(Number(e.target.value))} />
									</div>
								</div>
								<div className="space-y-2">
									<Label>Model</Label>
									<Input value={hermesModel} onChange={(e) => setHermesModel(e.target.value)} placeholder="e.g. glm-4.6" />
								</div>
								<div className="space-y-2">
									<Label>Proxies</Label>
									<div className="flex flex-wrap gap-2">
										{KNOWN_PROXIES.map((p) => (
											<button
												key={p}
												type="button"
												onClick={() => toggleProxy(p)}
												className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${proxies.includes(p) ? "border-primary bg-primary/10 text-foreground" : "border-input text-muted-foreground hover:text-foreground"}`}
											>
												{p}
											</button>
										))}
									</div>
								</div>
							</>
						)}
					</div>
				)}

				{step === 3 && (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label>Network bridge</Label>
							<Input value={bridge} onChange={(e) => setBridge(e.target.value)} />
						</div>
						<div className="flex items-center justify-between">
							<div className="space-y-0.5">
								<Label>Join Tailscale</Label>
								<p className="text-xs text-muted-foreground">Required for SSH access to the container.</p>
							</div>
							<Switch checked={tailscale} onCheckedChange={setTailscale} />
						</div>
						{tailscale && (
							<div className="space-y-2">
								<Label>Tailscale auth-key reference (name)</Label>
								<Input value={tailscaleKeyRef} onChange={(e) => setTailscaleKeyRef(e.target.value)} placeholder="key-ref name (never the key value)" />
							</div>
						)}
						<div className="space-y-2">
							<Label>Web access</Label>
							<Input value={webAccess} onChange={(e) => setWebAccess(e.target.value)} placeholder="none" />
						</div>
					</div>
				)}

				{step === 4 && (
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
							<Field label="Mode" value={mode} />
							<Field label="Slug" value={slug || "—"} />
							{mode === "existing" && <Field label="Repo" value={repoUrl || "—"} />}
							<Field label="Branch" value={branch} />
							<Field label="GitHub org" value={ghOrg} />
							<Field label="Image" value={imageAlias} />
							<Field label="Pool" value={pool} />
							<Field label="Profiles" value={profilesText} />
							<Field label="Hermes" value={hermesEnabled ? `${hermesProfile || slug} :${hermesPort}` : "disabled"} />
							{hermesEnabled && <Field label="Proxies" value={proxies.join(", ") || "—"} />}
							<Field label="Bridge" value={bridge} />
							<Field label="Tailscale" value={tailscale ? `yes (${tailscaleKeyRef || "no key-ref"})` : "no"} />
						</div>
						{preflight && (
							<div className="space-y-1.5">
								<div className="flex items-center gap-2">
									<Label>Preflight</Label>
									<Badge variant={preflight.ok ? "secondary" : "destructive"}>{preflight.ok ? "passed" : "failed"}</Badge>
								</div>
								<ul className="space-y-1">
									{preflight.checks.map((c) => (
										<li key={c.id} className="flex items-center gap-2 text-sm">
											{c.pass ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-destructive" />}
											<span className="font-medium">{c.label}</span>
											{c.detail && <span className="text-xs text-muted-foreground">{c.detail}</span>}
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				)}
			</CardContent>
			<CardFooter className="justify-between">
				<Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>Back</Button>
				<div className="flex gap-2">
					{step < STEP_LABELS.length - 1 ? (
						<Button onClick={() => setStep((s) => Math.min(STEP_LABELS.length - 1, s + 1))} disabled={!defaultsLoaded}>Next</Button>
					) : (
						<Button onClick={run} disabled={busy || !slug.trim()}>
							{busy && <Loader2 className="size-4 animate-spin" />}
							Validate &amp; provision
						</Button>
					)}
				</div>
			</CardFooter>
		</Card>
	);
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="truncate font-medium">{value}</span>
		</div>
	);
}
