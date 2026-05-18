# Vagrant rehearsal harness

Local libvirt/QEMU VMs for rehearsing the CortexOS operator prompt sequence
on Ubuntu and Fedora before touching a real VPS. RHEL-family boxes are
defined but disabled until Phase P6.

## macOS prerequisites

```bash
brew install libvirt qemu vagrant
brew services start libvirt
vagrant plugin install vagrant-libvirt
```

Set the default provider in your shell rc (`~/.zshrc` or `~/.bashrc`):

```bash
export VAGRANT_DEFAULT_PROVIDER=libvirt
```

Confirm libvirtd is reachable:

```bash
virsh -c qemu:///system list --all
```

If you get a permission error on `/var/run/libvirt/libvirt-sock`, add your
user to the `libvirt` group or run libvirtd as root (Homebrew default).

### Apple Silicon note

All `generic/*` boxes used here are `x86_64`. On Apple Silicon they run
under QEMU-TCG (no KVM, no Hypervisor.framework acceleration for x86 guests
via libvirt). Expect 5–10× slower boot and `dnf`/`apt` runtimes. Once
upstream publishes verified `aarch64` images for Fedora 41 and Ubuntu
24.04/22.04, switch the box names in `Vagrantfile` and drop QEMU-TCG.

## Quickstart

```bash
make vm-fedora-up
make vm-rehearse FAMILY=fedora
make vm-down
```

For Ubuntu:

```bash
make vm-ubuntu-up        # 24.04
make vm-ubuntu22-up      # 22.04
make vm-rehearse FAMILY=ubuntu
```

Destroy and rebuild:

```bash
make vm-destroy
```

## Snapshots

Snapshots are tagged `phase-<N>-<family>-<label>`, e.g.
`phase-1-fedora-ready`. Keep the last 5 per VM; older ones get pruned.

```bash
make vm-snapshot NAME=phase-1-fedora-ready
make vm-restore  NAME=phase-1-fedora-ready
vagrant/snapshots.sh list
vagrant/snapshots.sh prune
```

See `vagrant/snapshots.sh` for the full subcommand list.

## Troubleshooting

- **libvirtd not running**: `brew services start libvirt`, then
  `brew services list | grep libvirt`.
- **Socket permission denied**: `ls -l /var/run/libvirt/libvirt-sock`;
  ensure the socket is owned by a group you belong to, or run vagrant with
  `sudo -E` once to seed the connection.
- **Stale boxes**: `vagrant box list`, then
  `vagrant box remove generic/fedora41 --provider libvirt`.
- **Stuck VM**: `virsh -c qemu:///system list --all` then
  `virsh destroy <domain>` and `vagrant destroy -f`.
- **Rsync errors on first sync**: ensure `rsync` is installed on the host
  (`brew install rsync`) and the VM (provisioner handles this on second
  `vagrant up`).
