"use client";

import { useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TriggerCheckButtonProps {
	serviceId: number;
	healthType: string;
	onTrigger?: () => void;
}

export function TriggerCheckButton({
	serviceId,
	healthType,
	onTrigger,
}: TriggerCheckButtonProps) {
	const [loading, setLoading] = useState(false);
	const isProcess = healthType === "process";

	async function handleClick() {
		if (!isProcess || loading) return;
		setLoading(true);
		try {
			await fetch("/api/services/trigger", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ serviceId }),
			});
			onTrigger?.();
		} finally {
			setLoading(false);
		}
	}

	return (
		<Button
			variant="ghost"
			size="icon-xs"
			onClick={handleClick}
			disabled={!isProcess || loading}
			aria-label="Trigger health check"
			title={isProcess ? "Trigger health check" : "Only process checks can be triggered"}
		>
			{loading ? (
				<Loader2 className="animate-spin" />
			) : (
				<Play />
			)}
		</Button>
	);
}
