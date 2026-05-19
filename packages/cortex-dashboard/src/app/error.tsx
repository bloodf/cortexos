"use client";

import { useEffect } from "react";

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[dashboard:root]", error);
	}, [error]);

	return (
		<html lang="en">
			<body className="bg-[#0a0a0f]">
				<div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
					<div style={{ textAlign: "center", color: "#fff" }}>
						<h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
							Something went wrong
						</h2>
						<p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.5)", marginBottom: "1.5rem" }}>
							{error.message || "An unexpected error occurred."}
						</p>
						<button
							type="button"
							onClick={reset}
							style={{
								padding: "0.5rem 1.5rem",
								borderRadius: "0.5rem",
								background: "rgba(239,68,68,0.2)",
								color: "#f87171",
								border: "none",
								cursor: "pointer",
								fontSize: "0.875rem",
							}}
						>
							Try again
						</button>
					</div>
				</div>
			</body>
		</html>
	);
}
