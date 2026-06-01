import type { Metadata } from "next";

export const metadata: Metadata = { title: "Env Browser" };

export default function Layout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
