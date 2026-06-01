import type { Metadata } from "next";

export const metadata: Metadata = { title: "Instance Detail" };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
