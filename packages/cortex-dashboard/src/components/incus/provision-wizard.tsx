"use client";

/**
 * Multi-step wizard to create + provision a CortexOS Incus project-instance.
 * Deterministic and fully usable without AI. On finish it: POSTs a draft config,
 * runs deterministic pre-flight validation, then (when validated) provisions via
 * the canonical script and streams progress.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProvisionProgress } from "./provision-progress";

const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;
const STEPS = ["Target", "Image & resources", "Hermes", "Network", "Review"] as const;

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

const DEFAULTS: WizardDefaults = {
	image: "cortexos-base/latest",
	ghOrg: "bloodf",
	bridge: "incusbr0",
	pool: "cortex-zfs",
	branch: "main",
	proxies: ["9router", "honcho", "ollama"],
};

export function ProvisionWizard() {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [_defaults, _setDefaults] = useState<WizardDefaults>(DEFAULTS);

	// form state
	const [mode, setMode] = useState<"existing" | "new">("existing");
	const [repoUrl, setRepoUrl] = useState("");
	const [branch, setBranch] = useState(DEFAULTS.branch);
	const [ghOrg, setGhOrg] = useState(DEFAULTS.ghOrg);
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");

	const [image, setImage] = useState(DEFAULTS.image);
	const [gastown, setGastown] = useState(false);
	const [cpu, setCpu] = useState("");
	const [memory, setMemory] = useState("");
	const [pool, setPool] = useState(DEFAULTS.pool);

	const [hermesEnabled, setHermesEnabled] = useState(true);
	const [hermesProfile, setHermesProfile] = useState("");
	const [hermesPort, setHermesPort] = useState("18700");
	const [hermesModel, setHermesModel] = useState("claude-fallback");
	const [proxies, setProxies] = useState<string[]>(DEFAULTS.proxies);

	const [bridge, setBridge] = useState(DEFAULTS.bridge);
	const [tailscale, setTailscale] = useState(false);
	const [tailscaleKeyRef, setTailscaleKeyRef] = useState("");
	const [webAccess, setWebAccess] = useState("direct-tailscale");

	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [analyzing, setAnalyzing] = useState(false);
	const [analysis, setAnalysis] = useState<string | null>(null);
	const [preflight, setPreflight] = useState<{ ok: boolean; checks: PreflightCheck[] } | null>(null);
	const [provisionId, setProvisionId] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/incus/instances", { cache: "no-store" }).catch(() => {});
		// Load global defaults from admin settings (best-effort).
		fetch("/api/incus/ai/models", { cache: "no-store" }).catch(() => {});
	}, []);

	// Keep gastown toggle in sync with the chosen image.
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setImage(gastown ? "cortexos-gastown-base/latest" : "cortexos-base/latest");
	}, [gastown]);

	// Default hermes profile to slug.
	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (!hermesProfile && slug) setHermesProfile(slug);
	}, [slug, hermesProfile]);

	function buildConfig() {
		return {
			target: {
				mode,
				repoUrl: mode === "existing" ? repoUrl.trim() : undefined,
				branch: branch.trim() || "main",
				ghOrg: ghOrg.trim(),
				slug: slug.trim(),
				description: description.trim() || undefined,
			},
			image: {
				alias: image,
				gastown,
				profiles: [],
				cpu: cpu.trim() || undefined,
				memory: memory.trim() || undefined,
				pool: pool.trim(),
			},
			hermes: {
				enabled: hermesEnabled,
				profile: hermesEnabled ? hermesProfile.trim() : "",
				port: hermesEnabled ? Number(hermesPort) : 0,
				model: hermesEnabled ? hermesModel.trim() : "",
				proxies: hermesEnabled ? proxies : [],
			},
			network: {
				bridge: bridge.trim(),
				tailscale,
				tailscaleKeyRef: tailscale ? tailscaleKeyRef.trim() : undefined,
				webAccess,
			},
		};
	}

	function stepValid(s: number): string | null {
		if (s === 0) {
			if (!SAFE_NAME_RE.test(slug)) return "Enter a valid slug (letter first, alphanumeric/-/_).";
			if (mode === "existing" && !/^(https:\/\/|git@)/.test(repoUrl)) return "Enter a repo URL.";
		}
		if (s === 1) {
			if (!image) return "Choose an image.";
			if (!pool) return "Pool required.";
		}
		if (s === 2 && hermesEnabled) {
			if (!SAFE_NAME_RE.test(hermesProfile)) return "Hermes profile name invalid.";
			const p = Number(hermesPort);
			if (!Number.isInteger(p) || p < 18695 || p > 18749) return "Hermes port must be 18695–18749.";
			if (!hermesModel) return "Hermes model required.";
		}
		if (s === 3 && tailscale && !tailscaleKeyRef) return "Tailscale key reference required.";
		return null;
	}

	function next() {
		const err = stepValid(step);
		if (err) { setError(err); return; }
		setError(null);
		setStep((s) => Math.min(s + 1, STEPS.length - 1));
	}
	function back() { setError(null); setStep((s) => Math.max(s - 1, 0)); }

	function toggleProxy(name: string) {
		setProxies((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
	}

	// Optional AI assist: analyze the repo/description and pre-fill fields. Never
	// blocks the wizard — silently no-ops if AI is unavailable.
	async function analyze() {
		setAnalyzing(true);
		setAnalysis(null);
		try {
			const res = await fetch("/api/incus/ai/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ mode, repoUrl: repoUrl.trim() || undefined, branch, description }),
			});
			const j = await res.json();
			const a = j.analysis;
			if (!a) {
				setAnalysis("AI assist unavailable (configure a model in admin settings).");
				return;
			}
			if (a.needsGastown) setGastown(true);
			if (a.resourceHints?.cpu) setCpu(String(a.resourceHints.cpu));
			if (a.resourceHints?.memoryGiB) setMemory(`${a.resourceHints.memoryGiB}GiB`);
			if (a.suggestedHermesPort && a.suggestedHermesPort >= 18695 && a.suggestedHermesPort <= 18749) {
				setHermesPort(String(a.suggestedHermesPort));
			}
			const warn = Array.isArray(a.warnings) && a.warnings.length ? ` Warnings: ${a.warnings.join("; ")}` : "";
			setAnalysis(`${a.detectedLanguage}/${a.detectedRuntime}; gastown=${a.needsGastown}.${warn}`);
		} catch {
			setAnalysis("AI assist failed.");
		} finally {
			setAnalyzing(false);
		}
	}

	async function saveDraft(): Promise<boolean> {
		setError(null);
		const res = await fetch("/api/incus/instances", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ config: buildConfig() }),
		});
		if (!res.ok) {
			const j = await res.json().catch(() => ({}));
			setError(j.error || `Save failed (${res.status})`);
			return false;
		}
		return true;
	}

	async function runPreflight() {
		setBusy(true); setError(null);
		try {
			if (!(await saveDraft())) return;
			const res = await fetch(`/api/incus/instances/${encodeURIComponent(slug.trim())}/validate`, { method: "POST" });
			const j = await res.json();
			if (!res.ok) { setError(j.error || "Validation failed"); return; }
			setPreflight(j.data.preflight);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Validation error");
		} finally {
			setBusy(false);
		}
	}

	async function provision() {
		setBusy(true); setError(null);
		try {
			const res = await fetch(`/api/incus/instances/${encodeURIComponent(slug.trim())}/provision`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			const j = await res.json();
			if (!res.ok && !j.requestId) { setError(j.error || "Provision failed to start"); return; }
			setProvisionId(j.requestId);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Provision error");
		} finally {
			setBusy(false);
		}
	}

	if (provisionId) {
		return (
			<ProvisionProgress
				name={slug.trim()}
				requestId={provisionId}
				onDone={() => router.push("/incus")}
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				{STEPS.map((label, i) => (
					<Badge key={label} variant={i === step ? "default" : "secondary"}>
						{i + 1}. {label}
					</Badge>
				))}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{STEPS[step]}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{step === 0 && (
						<>
							<div className="flex gap-2">
								<Button type="button" size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>Existing repo</Button>
								<Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>New project</Button>
							</div>
							<Field label="Slug"><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mementry" /></Field>
							{mode === "existing" && (
								<Field label="Repository URL"><Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/bloodf/mementry.git" /></Field>
							)}
							<div className="grid grid-cols-2 gap-3">
								<Field label="Branch"><Input value={branch} onChange={(e) => setBranch(e.target.value)} /></Field>
								<Field label="GitHub org"><Input value={ghOrg} onChange={(e) => setGhOrg(e.target.value)} /></Field>
							</div>
							{mode === "new" && (
								<Field label="Description (used by AI assist)"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
							)}
							<div className="flex items-center gap-3">
								<Button type="button" variant="outline" size="sm" onClick={analyze} disabled={analyzing}>
									{analyzing ? "Analyzing…" : "Analyze with AI"}
								</Button>
								{analysis && <span className="text-xs text-muted-foreground">{analysis}</span>}
							</div>
						</>
					)}

					{step === 1 && (
						<>
							<Field label="Instance / base image">
								<p className="text-sm text-foreground font-mono">{image}</p>
							</Field>
							<Row label="Include gastown toolchain (Go, Dolt, gt)"><Switch checked={gastown} onCheckedChange={setGastown} /></Row>
							<div className="grid grid-cols-2 gap-3">
								<Field label="CPU limit (optional)"><Input value={cpu} onChange={(e) => setCpu(e.target.value)} placeholder="4" /></Field>
								<Field label="Memory limit (optional)"><Input value={memory} onChange={(e) => setMemory(e.target.value)} placeholder="4GiB" /></Field>
							</div>
							<Field label="Storage pool"><Input value={pool} onChange={(e) => setPool(e.target.value)} /></Field>
						</>
					)}

					{step === 2 && (
						<>
							<Row label="Set up Hermes profile"><Switch checked={hermesEnabled} onCheckedChange={setHermesEnabled} /></Row>
							{hermesEnabled && (
								<>
									<div className="grid grid-cols-2 gap-3">
										<Field label="Profile name"><Input value={hermesProfile} onChange={(e) => setHermesProfile(e.target.value)} /></Field>
										<Field label="API port (18695–18749)"><Input value={hermesPort} onChange={(e) => setHermesPort(e.target.value)} /></Field>
									</div>
									<Field label="Model"><Input value={hermesModel} onChange={(e) => setHermesModel(e.target.value)} /></Field>
									<Field label="Service proxies">
										<div className="flex gap-3">
											{["9router", "honcho", "ollama"].map((p) => (
												<label key={p} className="flex items-center gap-2 text-sm">
													<input type="checkbox" checked={proxies.includes(p)} onChange={() => toggleProxy(p)} /> {p}
												</label>
											))}
										</div>
									</Field>
								</>
							)}
						</>
					)}

					{step === 3 && (
						<>
							<Field label="Network bridge"><Input value={bridge} onChange={(e) => setBridge(e.target.value)} /></Field>
							<Row label="Join Tailscale after launch"><Switch checked={tailscale} onCheckedChange={setTailscale} /></Row>
							{tailscale && (
								<Field label="Tailscale auth-key reference (env var name, not the key)"><Input value={tailscaleKeyRef} onChange={(e) => setTailscaleKeyRef(e.target.value)} placeholder="TS_AUTHKEY_MEMENTRY" /></Field>
							)}
							<Field label="Web access mode"><Input value={webAccess} onChange={(e) => setWebAccess(e.target.value)} /></Field>
						</>
					)}

					{step === 4 && (
						<div className="space-y-3">
							<pre className="max-h-72 overflow-auto rounded-md bg-secondary p-3 font-mono text-xs whitespace-pre-wrap">
								{JSON.stringify(buildConfig(), null, 2)}
							</pre>
							<div className="flex gap-2">
								<Button type="button" variant="outline" disabled={busy} onClick={runPreflight}>
									{busy ? "Checking…" : "Run preflight"}
								</Button>
								<Button type="button" disabled={busy || !preflight?.ok} onClick={provision}>
									Provision
								</Button>
							</div>
							{preflight && (
								<div className="space-y-1">
									{preflight.checks.map((c) => (
										<div key={c.id} className="text-sm flex items-center gap-2">
											<Badge variant={c.pass ? "default" : "destructive"}>{c.pass ? "ok" : "fail"}</Badge>
											<span>{c.label}</span>
											{c.detail && <span className="text-muted-foreground text-xs">— {c.detail}</span>}
										</div>
									))}
									{!preflight.ok && (
										<Alert variant="destructive"><AlertDescription>Preflight failed — fix the issues above before provisioning.</AlertDescription></Alert>
									)}
								</div>
							)}
						</div>
					)}

					{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

					<div className="flex justify-between pt-2">
						<Button type="button" variant="ghost" onClick={back} disabled={step === 0 || busy}>Back</Button>
						{step < STEPS.length - 1 && <Button type="button" onClick={next} disabled={busy}>Next</Button>}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="space-y-1">
			<Label className="text-xs text-muted-foreground">{label}</Label>
			{children}
		</div>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between">
			<Label className="text-sm">{label}</Label>
			{children}
		</div>
	);
}
