# CortexOS Incus Foundation

This stack contains host-side systemd support for the Incus storage layer.

The rebuild process creates a sparse file at `/mnt/hdd/incus-zfs.img`, creates
the `cortex-zfs` ZFS pool on that file, and registers the imported pool with
Incus as the default storage backend.

`cortex-incus-zpool.service.in` is templated by `scripts/rebuild/apply.sh` so
the pool is imported after `/mnt/hdd` is mounted and before `incus.service`
starts.
