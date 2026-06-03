/**
 * System / host metric entities: SystemData, DriveInfo, MountInfo,
 * MachineSensor, ProcessInfo, NetworkInterface, NetworkData.
 *
 * Source: `/api/system`, `/api/processes`, `/api/network`.
 * The M0-A audit notes that `/api/system` returns drive sizes as
 * strings in the route but the `lib/sys-pilot/types.ts` says numbers.
 * Our schema accepts both via the `.coerce()`-equivalent `union`
 * pattern, so the mock fixtures can emit either shape without
 * tripping the parser.
 */

import { z } from 'zod';
import { SENSOR_UNITS } from '../enums';

const numberOrNumericString = z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]);

export const driveInfoSchema = z.object({
	name: z.string().min(1),
	model: z.string(),
	size: numberOrNumericString,
	type: z.string(),
	mount: z.string().nullable(),
	used: numberOrNumericString.nullable(),
	total: numberOrNumericString.nullable(),
	percent: z.number().min(0).max(100).nullable(),
});
export type DriveInfo = z.infer<typeof driveInfoSchema>;

export const mountInfoSchema = z.object({
	filesystem: z.string(),
	mount: z.string().min(1),
	total: numberOrNumericString,
	used: numberOrNumericString,
	free: numberOrNumericString,
	percent: z.number().min(0).max(100),
});
export type MountInfo = z.infer<typeof mountInfoSchema>;

export const machineSensorSchema = z.object({
	id: z.string().min(1),
	label: z.string(),
	value: z.number(),
	unit: z.enum(SENSOR_UNITS),
	source: z.string(),
});
export type MachineSensor = z.infer<typeof machineSensorSchema>;

export const processInfoSchema = z.object({
	pid: z.number().int().positive(),
	user: z.string().min(1),
	command: z.string().min(1),
	cpu: z.number().min(0).max(100),
	mem: z.number().min(0).max(100),
});
export type ProcessInfo = z.infer<typeof processInfoSchema>;

export const networkInterfaceSchema = z.object({
	name: z.string().min(1),
	rxKbps: z.number().nonnegative(),
	txKbps: z.number().nonnegative(),
	rxBytesTotal: z.number().nonnegative(),
	txBytesTotal: z.number().nonnegative(),
});
export type NetworkInterface = z.infer<typeof networkInterfaceSchema>;

export const networkDataSchema = z.object({
	interfaces: z.array(networkInterfaceSchema),
});
export type NetworkData = z.infer<typeof networkDataSchema>;

export const memoryInfoSchema = z.object({
	percent: z.number().min(0).max(100),
	used: z.number().nonnegative(),
	total: z.number().nonnegative(),
	free: z.number().nonnegative(),
});
export type MemoryInfo = z.infer<typeof memoryInfoSchema>;

export const systemSensorsSchema = z.object({
	cpuTemperature: machineSensorSchema.nullable(),
	temperatures: z.array(machineSensorSchema),
	fans: z.array(machineSensorSchema),
	voltages: z.array(machineSensorSchema),
});
export type SystemSensors = z.infer<typeof systemSensorsSchema>;

export const systemDataSchema = z.object({
	cpu: z.number().min(0).max(100),
	memory: memoryInfoSchema,
	drives: z.array(driveInfoSchema),
	mounts: z.array(mountInfoSchema),
	load: z.tuple([z.number().nonnegative(), z.number().nonnegative(), z.number().nonnegative()]),
	uptime: z.number().int().nonnegative(),
	sensors: systemSensorsSchema,
	timestamp: z.string().datetime(),
});
export type SystemData = z.infer<typeof systemDataSchema>;
