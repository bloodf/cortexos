/**
 * AI assist for the Incus provisioning wizard (strictly optional).
 *
 * Three touchpoints — repo/new-project analysis, pre-flight advice, and
 * post-create validation advice — each backed by Vercel AI SDK `generateObject`
 * over 9router. The admin-selected model (config key `incus.ai.model`) is used;
 * if it is empty we fall back to NINEROUTER_DEFAULT_MODEL. EVERY function
 * returns `null` on any failure (provider down, unconfigured, parse error) so
 * the deterministic wizard path is never blocked by AI.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { getNineRouterModel } from "./provider-resolver";
import { getConfigValue } from "@/lib/db/config-kv";
import type { IncusInstanceConfig } from "@/lib/incus/instance-config";
import type { PreflightReport } from "@/lib/incus/preflight";

const MODEL_KEY = "incus.ai.model";

async function resolveModel() {
	if (!process.env.NINEROUTER_BASE_URL || !process.env.NINEROUTER_API_KEY) {
		return null;
	}
	try {
		const configured = await getConfigValue(MODEL_KEY, "");
		return getNineRouterModel(configured || undefined);
	} catch {
		return null;
	}
}

// ---- Touchpoint 1: repo / new-project analysis -----------------------------

const analysisSchema = z.object({
	detectedLanguage: z.string(),
	detectedRuntime: z.string(),
	needsGastown: z.boolean(),
	gastownReason: z.string(),
	resourceHints: z.object({ cpu: z.string(), memoryGiB: z.number() }),
	suggestedHermesPort: z.number().int(),
	warnings: z.array(z.string()),
	confidence: z.number().min(0).max(1),
});
export type RepoAnalysis = z.infer<typeof analysisSchema>;

export interface AnalyzeInput {
	mode: "existing" | "new";
	repoUrl?: string;
	branch?: string;
	description?: string;
	/** Optional read-only signals gathered by the caller (e.g. git ls-remote refs). */
	signals?: string;
}

export async function analyzeTarget(input: AnalyzeInput): Promise<RepoAnalysis | null> {
	const model = await resolveModel();
	if (!model) return null;
	try {
		const { object } = await generateObject({
			model,
			schema: analysisSchema,
			prompt:
				`You are advising a CortexOS Incus provisioning wizard. Recommend instance settings ` +
				`for this ${input.mode} project. Hermes ports are in 18695-18749. The "gastown" image ` +
				`variant adds Go, Dolt and the gt CLI — only recommend it for projects that need that ` +
				`orchestration toolchain.\n\n` +
				`repoUrl: ${input.repoUrl ?? "(none)"}\nbranch: ${input.branch ?? "main"}\n` +
				`description: ${input.description ?? "(none)"}\n` +
				`signals:\n${input.signals ?? "(none)"}`,
		});
		return object;
	} catch {
		return null;
	}
}

// ---- Touchpoint 2: pre-flight advice (additive to deterministic checks) -----

const preflightAdviceSchema = z.object({
	willSucceed: z.boolean(),
	blockers: z.array(z.object({ field: z.string(), issue: z.string() })),
	suggestions: z.array(z.string()),
	riskNotes: z.array(z.string()),
});
export type PreflightAdvice = z.infer<typeof preflightAdviceSchema>;

export async function aiPreflightAdvice(
	cfg: IncusInstanceConfig,
	report: PreflightReport,
): Promise<PreflightAdvice | null> {
	const model = await resolveModel();
	if (!model) return null;
	try {
		const { object } = await generateObject({
			model,
			schema: preflightAdviceSchema,
			prompt:
				`Review this CortexOS Incus instance config and the deterministic pre-flight result. ` +
				`The deterministic checks are authoritative; add only advisory observations.\n\n` +
				`config: ${JSON.stringify(cfg)}\n` +
				`preflight: ${JSON.stringify(report)}`,
		});
		return object;
	} catch {
		return null;
	}
}

// ---- Touchpoint 3: post-create validation advice ---------------------------

const postcreateAdviceSchema = z.object({
	healthy: z.boolean(),
	checks: z.array(z.object({ name: z.string(), pass: z.boolean(), detail: z.string() })),
	remediation: z.array(z.string()),
});
export type PostcreateAdvice = z.infer<typeof postcreateAdviceSchema>;

export async function aiPostcreateAdvice(
	probe: Record<string, unknown>,
): Promise<PostcreateAdvice | null> {
	const model = await resolveModel();
	if (!model) return null;
	try {
		const { object } = await generateObject({
			model,
			schema: postcreateAdviceSchema,
			prompt:
				`A CortexOS Incus instance was just provisioned. Assess these post-create probe ` +
				`results and suggest remediation for anything unhealthy.\n\n` +
				`probe: ${JSON.stringify(probe)}`,
		});
		return object;
	} catch {
		return null;
	}
}
