import json
import os
import subprocess
import sys
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def request(method: str, url: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as err:
        body = err.read().decode()
        err.close()
        return err.code, json.loads(body)


class AgentGatewayTest(unittest.TestCase):
    def test_http_surface(self):
        env = {
            **os.environ,
            "AGENTGATEWAY_PORT": "18881",
            "AGENTGATEWAY_CONFIG": str(ROOT / "config" / "tools.json"),
        }
        proc = subprocess.Popen(
            [sys.executable, str(ROOT / "app.py")],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            base = "http://127.0.0.1:18881"
            for _ in range(50):
                try:
                    status, body = request("GET", f"{base}/health")
                    if status == 200 and body["ok"]:
                        break
                except OSError:
                    pass
                time.sleep(0.1)
            else:
                raise AssertionError("AgentGateway did not start")

            status, body = request("GET", f"{base}/tools")
            self.assertEqual(status, 200)
            self.assertEqual(body["auth"], "network-trust-no-token")
            self.assertTrue(any(tool["name"] == "service.status" for tool in body["tools"]))

            status, body = request("POST", f"{base}/mcp/invoke", {
                "tool": "service.status",
                "arguments": {"service": "postgresql"},
                "agent_id": "cortex",
            })
            self.assertEqual(status, 200)
            self.assertTrue(body["ok"])

            status, body = request("POST", f"{base}/mcp/invoke", {
                "tool": "service.restart",
                "arguments": {"service": "postgresql"},
            })
            self.assertEqual(status, 403)
            self.assertEqual(body["error"], "tool_not_allowed")
        finally:
            proc.terminate()
            proc.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
