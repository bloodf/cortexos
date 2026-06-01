#!/usr/bin/env node
import http from "node:http";

const listenHost = process.env.NINEROUTER_DOCKER_PROXY_HOST || "172.17.0.1";
const listenPort = Number(process.env.NINEROUTER_DOCKER_PROXY_PORT || 11434);
const targetHost = process.env.NINEROUTER_TARGET_HOST || "127.0.0.1";
const targetPort = Number(process.env.NINEROUTER_TARGET_PORT || 11434);

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `${targetHost}:${targetPort}` };
  const upstream = http.request(
    {
      host: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  });
  req.pipe(upstream);
});

server.listen(listenPort, listenHost, () => {
  console.log(`9router docker proxy listening on ${listenHost}:${listenPort}`);
});
