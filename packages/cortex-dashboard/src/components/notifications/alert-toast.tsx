"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useSocket } from "@/hooks/use-socket";
import { TriangleAlertIcon, CircleCheckIcon } from "lucide-react";

interface AlertTriggeredPayload {
	ruleId: number;
	ruleName: string;
	serviceId: number;
	serviceName: string;
	status: string;
	message: string;
	timestamp: number;
}

export function AlertToastListener() {
	const { subscribe, unsubscribe } = useSocket();

	useEffect(() => {
		const handler = (payload: AlertTriggeredPayload) => {
			const isOffline = payload.status === "offline";
			toast(payload.message, {
				icon: isOffline ? (
					<TriangleAlertIcon className="size-4 text-destructive" />
				) : (
					<CircleCheckIcon className="size-4 text-green-500" />
				),
				duration: 8000,
			});
		};

		subscribe("alert:triggered", handler as (...args: unknown[]) => void);
		return () => {
			unsubscribe("alert:triggered", handler as (...args: unknown[]) => void);
		};
	}, [subscribe, unsubscribe]);

	return null;
}
