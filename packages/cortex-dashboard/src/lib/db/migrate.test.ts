import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLanIp, replaceVpsLanIp } from "./migrate";
import os from "os";

describe("getLanIp", () => {
	let networkInterfacesSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
	networkInterfacesSpy = vi.spyOn(os, "networkInterfaces");
	});

	afterEach(() => {
	vi.restoreAllMocks();
	});

	it("returns undefined when no interfaces", () => {
	networkInterfacesSpy.mockReturnValue({});
	expect(getLanIp()).toBeUndefined();
	});

	it("prefers eth over wlan", () => {
	networkInterfacesSpy.mockReturnValue({
		wlan0: [{ address: "192.168.1.50", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
		eth0: [{ address: "192.168.1.10", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
	});
	expect(getLanIp()).toBe("192.168.1.10");
	});

	it("prefers en over wl", () => {
	networkInterfacesSpy.mockReturnValue({
		wlp2s0: [{ address: "10.0.0.20", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
		enp3s0: [{ address: "10.0.0.10", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
	});
	expect(getLanIp()).toBe("10.0.0.10");
	});

	it("prefers wlan over tailscale", () => {
	networkInterfacesSpy.mockReturnValue({
		tailscale0: [{ address: "100.64.0.1", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
		wlan0: [{ address: "192.168.1.5", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
	});
	expect(getLanIp()).toBe("192.168.1.5");
	});

	it("prefers other unknown over tailscale", () => {
		networkInterfacesSpy.mockReturnValue({
			docker0: [{ address: "172.17.0.1", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
			tailscale0: [{ address: "100.64.0.1", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
		});
		expect(getLanIp()).toBe("172.17.0.1");
	});

	it("skips internal and IPv6 addresses", () => {
	networkInterfacesSpy.mockReturnValue({
		lo: [{ address: "127.0.0.1", family: "IPv4", internal: true } as os.NetworkInterfaceInfo],
		eth0: [
		{ address: "fe80::1", family: "IPv6", internal: false } as os.NetworkInterfaceInfo,
		{ address: "192.168.1.10", family: "IPv4", internal: false } as os.NetworkInterfaceInfo,
		],
	});
	expect(getLanIp()).toBe("192.168.1.10");
	});

	it("falls back to first available when no priority match", () => {
	networkInterfacesSpy.mockReturnValue({
		br0: [{ address: "192.168.5.5", family: "IPv4", internal: false } as os.NetworkInterfaceInfo],
	});
	expect(getLanIp()).toBe("192.168.5.5");
	});
});

describe("replaceVpsLanIp", () => {
	it("replaces all occurrences of <VPS_LAN_IP>", () => {
	const sql = "INSERT INTO hosts VALUES ('<VPS_LAN_IP>', '<VPS_LAN_IP>');";
	expect(replaceVpsLanIp(sql, "192.168.1.10")).toBe(
		"INSERT INTO hosts VALUES ('192.168.1.10', '192.168.1.10');"
	);
	});

	it("returns unchanged when no placeholder", () => {
	const sql = "SELECT 1;";
	expect(replaceVpsLanIp(sql, "192.168.1.10")).toBe("SELECT 1;");
	});
});
