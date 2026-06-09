import type { PageServerLoad } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DiskInfo {
  filesystem: string;
  size: string;
  used: string;
  avail: string;
  usePercent: string;
  mount: string;
}

export interface MountInfo {
  target: string;
  source: string;
  fstype: string;
  options: string;
}

export type BlockDevice = {
  name: string;
  model: string;
  type: string;
  size: string;
  mountpoint: string;
  [key: string]: unknown;
};

export type ZfsPool = {
  name: string;
  size: string;
  allocated: string;
  free: string;
  fragmentation: string;
  capacity: string;
  dedup: string;
  health: string;
  altroot: string;
  [key: string]: unknown;
};

// Virtual/pseudo filesystem types to exclude from storage views.
const VIRTUAL_FSTYPES = new Set([
  'tmpfs', 'devtmpfs', 'overlay', 'squashfs', 'proc', 'sysfs',
  'cgroup', 'cgroup2', 'ramfs', 'autofs', 'devpts', 'pstore',
  'securityfs', 'debugfs', 'tracefs', 'configfs', 'fusectl',
  'hugetlbfs', 'mqueue', 'bpf', 'nsfs', 'efivarfs',
]);

function isVirtualFstype(fstype: string): boolean {
  return VIRTUAL_FSTYPES.has(fstype) || fstype.startsWith('fuse.');
}

// A real block device source starts with /dev/ and is not a loop device.
function isPhysicalDevice(source: string): boolean {
  return source.startsWith('/dev/') && !source.startsWith('/dev/loop');
}

async function loadDisks(): Promise<DiskInfo[]> {
  try {
    // Use df with -T to get the fstype column so we can filter virtual filesystems.
    const { stdout } = await execFileAsync('df', ['-h', '-T'], { timeout: 5000 });
    return stdout
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        // With -T: Filesystem Type Size Used Avail Use% Mounted-on (7 cols)
        if (parts.length < 7) return null;
        const fstype = parts[1] ?? '';
        const source = parts[0] ?? '';
        if (isVirtualFstype(fstype) || !isPhysicalDevice(source)) return null;
        return {
          filesystem: source,
          size: parts[2],
          used: parts[3],
          avail: parts[4],
          usePercent: parts[5],
          mount: parts[6],
        };
      })
      .filter(Boolean) as DiskInfo[];
  } catch {
    return [];
  }
}

async function loadMounts(): Promise<MountInfo[]> {
  try {
    const { stdout } = await execFileAsync('findmnt', ['-J'], { timeout: 5000 });
    const parsed = JSON.parse(stdout);
    const out: MountInfo[] = [];
    const walk = (node: any) => {
      if (!node) return;
      const fstype: string = node.fstype ?? '';
      const source: string = node.source ?? '';
      // Only include real block device mounts; skip virtual filesystems.
      if (!isVirtualFstype(fstype) && isPhysicalDevice(source)) {
        out.push({
          target: node.target ?? '',
          source,
          fstype,
          options: node.options ?? '',
        });
      }
      if (node.children) node.children.forEach(walk);
    };
    if (parsed.filesystems) parsed.filesystems.forEach(walk);
    return out;
  } catch {
    return [];
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Only physical block device types: disk and partition.
const PHYSICAL_BLOCK_TYPES = new Set(['disk', 'part']);

async function loadBlockDevices(): Promise<BlockDevice[]> {
  try {
    const { stdout } = await execFileAsync('lsblk', ['-J', '-o', 'NAME,MODEL,TYPE,SIZE,MOUNTPOINT'], { timeout: 5000 });
    const parsed = JSON.parse(stdout);
    const out: BlockDevice[] = [];
    const walk = (node: any) => {
      if (!node) return;
      const type: string = node.type ?? '';
      if (PHYSICAL_BLOCK_TYPES.has(type)) {
        const sizeNum = typeof node.size === 'string' ? parseInt(node.size, 10) : (typeof node.size === 'number' ? node.size : 0);
        out.push({
          name: node.name ?? '',
          model: node.model ?? '',
          type,
          size: formatBytes(sizeNum),
          mountpoint: node.mountpoint ?? '',
        });
      }
      if (node.children) node.children.forEach(walk);
    };
    if (parsed.blockdevices) parsed.blockdevices.forEach(walk);
    return out;
  } catch {
    return [];
  }
}

async function loadZfsPools(): Promise<ZfsPool[]> {
  try {
    const { stdout } = await execFileAsync('zpool', ['list', '-H'], { timeout: 5000 });
    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const parts = line.trim().split(/\t+/);
        if (parts.length < 9) return null;
        return {
          name: parts[0],
          size: parts[1],
          allocated: parts[2],
          free: parts[3],
          fragmentation: parts[4],
          capacity: parts[5],
          dedup: parts[6],
          health: parts[7],
          altroot: parts[8],
        };
      })
      .filter(Boolean) as ZfsPool[];
  } catch {
    return [];
  }
}

export const load: PageServerLoad = async () => {
  const [disks, mounts, blockDevices, zfsPools] = await Promise.all([
    loadDisks(),
    loadMounts(),
    loadBlockDevices(),
    loadZfsPools(),
  ]);
  return { disks, mounts, blockDevices, zfsPools };
};
