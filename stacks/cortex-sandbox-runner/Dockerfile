# cortex-sandbox-runner — Express service that spawns short-lived
# `podman --runtime=runsc` containers per /exec request.
#
# The service container itself runs unprivileged with a dedicated
# `sandbox` user mapped into rootless podman + user namespaces.
# The runtime guest workloads receive gVisor's user-space syscall
# layer (`runsc`) — see docs/SANDBOX.md for the threat model.

FROM debian:13-slim AS runtime

ARG GVISOR_RELEASE=release-20260401
ARG TARGETARCH=amd64

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=8091 \
    HOME=/home/sandbox \
    XDG_RUNTIME_DIR=/run/user/2000

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg dumb-init \
      podman uidmap slirp4netns fuse-overlayfs \
      crun iptables \
      nodejs npm; \
    rm -rf /var/lib/apt/lists/*

# gVisor (runsc). Pin to a tagged release rather than `latest`.
RUN set -eux; \
    cd /tmp; \
    case "${TARGETARCH}" in \
      amd64) ARCH=x86_64 ;; \
      arm64) ARCH=aarch64 ;; \
      *) echo "unsupported arch ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    URL="https://storage.googleapis.com/gvisor/releases/${GVISOR_RELEASE}/${ARCH}"; \
    curl -fsSL "${URL}/runsc" -o /usr/local/bin/runsc; \
    curl -fsSL "${URL}/runsc.sha512" -o /tmp/runsc.sha512; \
    ( cd /usr/local/bin && sha512sum -c /tmp/runsc.sha512 ); \
    chmod 0755 /usr/local/bin/runsc; \
    rm -f /tmp/runsc.sha512

# Non-root runtime user. UID 2000 reserved for rootless podman; the
# sub-UID/GID ranges enable user namespace mapping inside the
# container so guests run under unprivileged UIDs from the host's
# perspective.
RUN set -eux; \
    groupadd --system --gid 2000 sandbox; \
    useradd --system --uid 2000 --gid sandbox \
      --home-dir /home/sandbox --shell /usr/sbin/nologin \
      --create-home sandbox; \
    echo "sandbox:100000:65536" >/etc/subuid; \
    echo "sandbox:100000:65536" >/etc/subgid; \
    install -d -o sandbox -g sandbox -m 0700 /run/user/2000

# Register runsc as an OCI runtime for rootless podman.
RUN install -d -o sandbox -g sandbox /home/sandbox/.config/containers \
 && printf '%s\n' \
    '[engine.runtimes]' \
    'runsc = ["/usr/local/bin/runsc"]' \
    > /home/sandbox/.config/containers/containers.conf \
 && chown sandbox:sandbox /home/sandbox/.config/containers/containers.conf

WORKDIR /app
COPY app/package.json ./app/package.json
RUN cd app && npm install --omit=dev --no-audit --no-fund

COPY app ./app
COPY README.md ./
RUN chown -R sandbox:sandbox /app

USER sandbox
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8091/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "/app/app/server.js"]
