#!/usr/bin/env node
import http from "node:http";

const listenHost = process.env.HERMES_DASHBOARD_PROXY_HOST || "127.0.0.1";
const listenPort = Number(process.env.HERMES_DASHBOARD_PROXY_PORT || 9120);
const upstreamHost = process.env.HERMES_DASHBOARD_HOST || "127.0.0.1";
const upstreamPort = Number(process.env.HERMES_DASHBOARD_PORT || 9119);

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `${upstreamHost}:${upstreamPort}` };
  const upstream = http.request(
    {
      host: upstreamHost,
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "hermes dashboard proxy failed", message: error.message }));
  });
  req.pipe(upstream);
});

server.listen(listenPort, listenHost, () => {
  console.log(`Hermes Dashboard host proxy listening on http://${listenHost}:${listenPort} -> http://${upstreamHost}:${upstreamPort}`);
});
