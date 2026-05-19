"use client";

import { useCallback, useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";

export function useSocket() {
	const [socket] = useState<Socket>(() => getSocket());
	const [connected, setConnected] = useState<boolean>(() => socket.connected);

	useEffect(() => {
		const onConnect = () => setConnected(true);
		const onDisconnect = () => setConnected(false);

		socket.on("connect", onConnect);
		socket.on("disconnect", onDisconnect);

		return () => {
			socket.off("connect", onConnect);
			socket.off("disconnect", onDisconnect);
		};
	}, [socket]);

	const subscribe = useCallback(
		(event: string, callback: (...args: unknown[]) => void) => {
			socket.on(event, callback);
		},
		[socket],
	);

	const unsubscribe = useCallback(
		(event: string, callback: (...args: unknown[]) => void) => {
			socket.off(event, callback);
		},
		[socket],
	);

	return { socket, connected, subscribe, unsubscribe };
}
