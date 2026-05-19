"use client";

import * as React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import { ChatPanel } from "@/components/cortex/chat-panel";

interface AppShellProps {
	children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
	return (
		<SidebarProvider defaultOpen={true}>
			<AppSidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<TopBar />
				<main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 pr-16 md:pr-16">
					<div className="mx-auto max-w-[1600px]">{children}</div>
				</main>
			</div>
			<ChatPanel />
		</SidebarProvider>
	);
}
