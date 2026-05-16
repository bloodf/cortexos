import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { initSocketServer } from "./src/lib/socket-server";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
	const server = createServer((req, res) => {
		handle(req, res);
	});

	const allowedOrigins = dev
		? [`http://localhost:${port}`]
		: [process.env.DASHBOARD_ORIGIN || `http://localhost:${port}`];

	const io = new Server(server, {
		path: "/socket.io",
		cors: {
			origin: allowedOrigins,
			methods: ["GET", "POST"],
		},
	});

	initSocketServer(io, port);

	server.listen(port, () => {
		console.log(`> Ready on http://localhost:${port}`);
	});
});
