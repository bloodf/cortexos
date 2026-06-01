import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { initSocketServer } from "./src/lib/socket-server";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev, port, hostname, turbopack: dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
	const server = createServer((req, res) => {
		handle(req, res);
	});

	const originEnv = process.env.DASHBOARD_ORIGIN;
	const allowedOrigins = dev
		? [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
		: originEnv
			? originEnv.split(",").map((s) => s.trim()).filter(Boolean)
			: [`http://localhost:${port}`];

	const io = new Server(server, {
		path: "/socket.io",
		cors: {
			origin: allowedOrigins,
			methods: ["GET", "POST"],
			credentials: true,
		},
	});

	initSocketServer(io, port);

	server.listen(port, hostname, () => {
		console.log(`> Ready on http://${hostname}:${port}`);
	});
});
