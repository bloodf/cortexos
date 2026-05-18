# Lima rehearsal harness

Lima provides macOS-native Linux VMs for rehearsing CortexOS operator prompts against Debian 13, Ubuntu 24.04, and Ubuntu 25.04 before touching a real VPS.

## Prerequisites (macOS)

```bash
brew install lima
```

QEMU is bundled with Lima on recent Homebrew releases. Apple Silicon hosts should prefer the arm64 cloud images (default); x86_64 hosts use the amd64 images automatically.

## Bring a VM up

```bash
limactl start --name=cortex-debian   lima/debian-13.yaml
limactl start --name=cortex-ubuntu24 lima/ubuntu-24.yaml
limactl start --name=cortex-ubuntu25 lima/ubuntu-25.yaml
```

First boot downloads the cloud image, runs `lima/provision.sh`, and installs Docker CE.

## Shell into the VM

```bash
limactl shell cortex-debian
```

The repo working tree is mounted read-write at `/opt/cortexos-src` and symlinked to `/opt/cortexos`.

## Rehearse operator prompts inside the VM

```bash
cd /opt/cortexos
bash scripts/local-prompt-runner.sh --family debian   # or --family ubuntu
```

## Tear down

```bash
limactl stop -f cortex-debian
limactl delete -f cortex-debian
```

## Apple Silicon notes

- arm64 cloud images are preferred and run natively under Apple's Virtualization framework or QEMU.
- For x86_64 verification on Apple Silicon, Lima falls back to QEMU TCG emulation — expect significantly slower boots; use only when arch-specific validation is required.
- If a VM fails to start on `vz`, retry with `LIMA_VM_TYPE=qemu limactl start ...`.

## Makefile shortcuts

Common operations are wrapped in the repo `Makefile`: `make vm-debian-up`, `make vm-shell NAME=debian`, `make vm-rehearse FAMILY=debian`, `make vm-down`, `make vm-list`.
