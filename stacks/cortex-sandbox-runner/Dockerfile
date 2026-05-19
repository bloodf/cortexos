# cortex-sandbox-runner — Express service that spawns short-lived
# `podman run` containers for /exec requests.
#
# Preferred runtime is gVisor (`runsc`) when the host can support nested gVisor.
# Some VPS/container combinations cannot provide the required cgroup or userns
# features; on those hosts the operator may set `CORTEX_SANDBOX_OCI_RUNTIME=crun`
# (and optionally `CORTEX_SANDBOX_DISABLE_CGROUPS=1`) as a documented fallback.

FROM debian:13-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=8091 \
    HOME=/root \
    XDG_RUNTIME_DIR=/run/user/0

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg dumb-init \
      podman uidmap slirp4netns fuse-overlayfs \
      crun iptables runsc \
      nodejs npm; \
    rm -rf /var/lib/apt/lists/*

# Non-root guest user mapping for spawned containers.
RUN set -eux; \
    groupadd --system --gid 2000 sandbox; \
    useradd --system --uid 2000 --gid sandbox \
      --home-dir /home/sandbox --shell /usr/sbin/nologin \
      --create-home sandbox; \
    echo "sandbox:100000:65536" >/etc/subuid; \
    echo "sandbox:100000:65536" >/etc/subgid; \
    install -d -m 0700 /run/user/0

# Register runsc globally so podman can select it via --runtime=runsc.
RUN install -d /etc/containers \
 && printf '%s\n' \
    '[engine.runtimes]' \
    'runsc = ["/usr/bin/runsc"]' \
    > /etc/containers/containers.conf

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY stacks/cortex-sandbox-runner/app/package.json ./app/package.json
COPY packages/cortex-telemetry ./packages/cortex-telemetry
RUN cd app && pnpm install --prod

COPY stacks/cortex-sandbox-runner/app ./app
COPY stacks/cortex-sandbox-runner/README.md ./
RUN chown -R sandbox:sandbox /app

# Rootful podman inside the service container is the most portable option on
# nested-container VPSes. Guest workloads still drop to uid/gid 65532.
USER root
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8091/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "/app/app/server.js"]
