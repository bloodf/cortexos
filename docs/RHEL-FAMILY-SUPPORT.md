# RHEL family support (RHEL / Rocky / AlmaLinux)

> Companion to `docs/FEDORA-SUPPORT.md`. Read both when authoring or auditing a tool prompt that touches the dnf branch.

## Covered distros

| Distro      | Versions   | Subfamily token |
| ----------- | ---------- | --------------- |
| RHEL        | 9, 10      | `rhel`          |
| Rocky Linux | 9, 10      | `rocky`         |
| AlmaLinux   | 9, 10      | `almalinux`     |
| CentOS      | 9-stream   | `centos`        |

All four normalize to `CORTEX_OS_FAMILY=rhel` and `$(pkg_family) == "rhel"`. Use `$(pkg_subfamily)` when behavior diverges per distro.

## Why a separate family from Fedora

RHEL 9/10 (and downstream rebuilds) share the dnf binary with Fedora but differ in ways that break naive Fedora copy-paste:

1. **Older dnf**. RHEL 9 ships dnf4; Fedora 40+ uses dnf5. Some sub-commands (`dnf config-manager addrepo`, `dnf repoquery --whatdepends`) behave differently. `scripts/pkg.sh` falls back to the dnf4-compatible forms.
2. **No `dnf module` for some streams**. RHEL 9 does not ship `dnf module enable nodejs:22`; the highest AppStream stream is `nodejs:20`. Rocky/Alma mirror this. If you need Node ≥ 22, use NodeSource or Linuxbrew.
3. **EPEL + CRB gating**. Many packages Fedora has in base (`caddy`, `fail2ban`, `htop`-extras) live in EPEL on RHEL family. EPEL builds require CRB enabled. Both repos must be turned on by `prompts/os/10-rhel-prereqs.md` before any tool spoke runs.
4. **`subscription-manager` is RHEL-only**. Rocky and AlmaLinux skip it; calling it on a non-RHEL distro fails. Always branch on `pkg_subfamily`.
5. **Group label differences**. `@development-tools` on RHEL 9 maps to `@"Development Tools"`; Fedora accepts both spellings; AlmaLinux 9 prefers the quoted form. When invoking `dnf groupinstall`, quote the label.

## Known package gaps

| Package      | Fedora                          | RHEL 9 / Rocky 9 / Alma 9                                  | Workaround                                                          |
| ------------ | ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| MongoDB      | No upstream repo                | Upstream `mongodb-org` repo exists for `rhel9`              | Use Docker (`stacks/mongodb/docker-compose.yml`) — same as Fedora.  |
| Caddy        | `dnf copr enable @caddy/caddy`  | copr may lack rhel9 builds; EPEL ships `caddy` 2.x          | Prefer EPEL `pkg_install caddy`; fall back to upstream tarball.     |
| fail2ban     | base repo                       | EPEL only                                                   | EPEL enabled in `10-rhel-prereqs.md`; then `pkg_install fail2ban`.  |
| Node.js 22+  | `dnf module enable nodejs:22`   | AppStream tops at `nodejs:20`                               | NodeSource repo (`curl -fsSL https://rpm.nodesource.com/setup_22.x \| sudo bash -`) or Linuxbrew. |
| Podman extras| base                            | base, but `crun` rebuilds lag                                | Use `docker-ce` from upstream (see `prompts/tools/11-docker.md`).   |
| Grafana      | base                            | upstream `grafana` repo for `el9`                            | Add `grafana` repo file; `pkg_install grafana`.                     |

## Node 20 AppStream caveat

When a tool prompt asks for Node ≥ 20 and the host is RHEL/Rocky/Alma 9, the safest path is:

```bash
case "$(pkg_subfamily)" in
  rhel|rocky|almalinux|centos)
    sudo dnf module reset -y nodejs || true
    sudo dnf module enable -y nodejs:20 || true
    pkg_install nodejs npm
    ;;
esac
```

If the module is unavailable (RHEL 10 dropped modules entirely, some minimal images), use NodeSource:

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
pkg_install nodejs
```

Verify `node --version` is ≥ 20 before continuing.

## SELinux

Same default as Fedora: `Enforcing`. AVC triage path is identical — read `audit.log`, author a `.te` module, do not blanket-disable.

```bash
sudo ausearch -m AVC,USER_AVC -ts recent
sudo audit2allow -a -M cortex-local
sudo semodule -i cortex-local.pp
```

## firewalld

Identical to Fedora. `pkg.sh::firewall_open` already covers `rhel`.

## Troubleshooting

- **`Cannot find a valid baseurl for repo: epel`** → CRB not enabled. Re-run Step 3 of `10-rhel-prereqs.md`.
- **`subscription-manager: command not found` on Rocky/Alma** → expected. The prereq prompt guards this with `if [ "$(pkg_subfamily)" = "rhel" ]`.
- **`Modular dependency problem`** → RHEL 9 module collision. Run `sudo dnf module reset <name>` and re-enable the desired stream.
- **`No match for argument: caddy`** → EPEL not refreshed. `sudo dnf clean all && sudo dnf makecache`.
- **`PackageNotFoundError: development-tools`** → quote the group: `sudo dnf groupinstall -y "Development Tools"`.

## Related docs

- `docs/FEDORA-SUPPORT.md` — Fedora-specific notes; most apply to RHEL family.
- `prompts/os/10-rhel-prereqs.md` — the runtime steps.
- `scripts/pkg.sh` — `pkg_family` / `pkg_subfamily` dispatch.
- `scripts/os-detect.sh` — emits `rhel <version> <subfamily-id>`.
