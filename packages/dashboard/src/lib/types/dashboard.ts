export interface MachineSensor {
	id: string;
	label: string;
	value: number;
	unit: 'celsius' | 'rpm' | 'volts';
	source: string;
}

export interface DriveInfo {
	name: string;
	model: string;
	size: number;
	type?: string;
	mount?: string;
	used?: number;
	total?: number;
	percent?: number;
}

export interface MountInfo {
	filesystem: string;
	mount: string;
	total: number;
	used: number;
	free: number;
	percent: number;
}

export interface SystemData {
	cpu: number;
	memory: { percent: number; used: number; total: number };
	drives: DriveInfo[];
	mounts: MountInfo[];
	load: number[];
	uptime: number;
	sensors: {
		cpuTemperature: MachineSensor | null;
		temperatures: MachineSensor[];
		fans: MachineSensor[];
		voltages: MachineSensor[];
	};
}

export interface ProcessInfo {
	pid: number;
	user: string;
	command: string;
	cpu: number;
	mem: number;
}

export interface NetworkInterface {
	name: string;
	rxKbps: number;
	txKbps: number;
	rxBytesTotal: number;
	txBytesTotal: number;
}

export interface NetworkData {
	interfaces: NetworkInterface[];
}

export interface DockerContainer {
	id: string;
	name: string;
	image: string;
	status: string;
	state: 'running' | 'exited' | 'paused' | 'restarting';
	ports: string;
	created: string;
}

export interface IncusInstance {
	name: string;
	slug: string;
	status: 'draft' | 'validated' | 'provisioning' | 'active' | 'failed' | 'running' | 'stopped' | 'frozen' | 'error';
	type: 'container' | 'vm';
	image: string;
	cpu: number;
	memory: number;
}

export interface AlertHistory {
	id: string;
	ruleName: string;
	status: 'fired' | 'resolved' | 'info';
	timestamp: string;
}

export interface ServiceCheck {
	id: number;
	slug: string;
	name: string;
	open_url: string;
	category: string;
	status: 'online' | 'offline' | 'unknown';
	responseTime: number;
}
