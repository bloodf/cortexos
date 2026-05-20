import { listAgentFactories } from "@/lib/db/agent-factories";
import { FactoryChat } from "@/components/agent-factory/factory-chat";

export default async function AdminAgentFactoryPage() {
	const factories = await listAgentFactories({});
	const safe = factories.map((factory) => ({ id: factory.id, slug: factory.slug, name: factory.name, kind: factory.kind, schema_version: factory.schema_version }));
	return <div className="space-y-4"><div><h1 className="text-2xl font-semibold">Admin · Agent Factory</h1><p className="mt-1 text-sm text-muted-foreground">Create Paperclip-aligned project factories, seats, positions, and OpenClaw agents through 9Router.</p></div><FactoryChat factories={safe} /></div>;
}

export const dynamic = "force-dynamic";
