import type { Metadata } from "next";

export const metadata: Metadata = { title: "Container Detail" };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
