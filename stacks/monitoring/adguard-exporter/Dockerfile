# syntax=docker/dockerfile:1
# Patched build of henrywhitaker3/adguard-exporter for AdGuard Home < v0.107.56.
# Upstream uses POST /control/clients/search which only exists in v0.107.56+.
# This build uses GET /control/clients and resolves names from persistent and
# auto/runtime clients.

FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build
ARG ADGUARD_EXPORTER_REF=9d49a564a88d46d32a5fa5afa42b620e2ce40af7
RUN git clone --depth 1 https://github.com/henrywhitaker3/adguard-exporter.git . \
    && git fetch --depth 1 origin ${ADGUARD_EXPORTER_REF} \
    && git checkout ${ADGUARD_EXPORTER_REF}

COPY clients-v0.107.53.patch /tmp/clients-v0.107.53.patch
RUN git apply /tmp/clients-v0.107.53.patch

RUN CGO_ENABLED=0 go build -o adguard-exporter .

FROM alpine:3.22.1 AS certs
RUN apk add --no-cache ca-certificates

FROM scratch
WORKDIR /

COPY --from=certs /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /build/adguard-exporter /adguard-exporter

USER 65532:65532
ENTRYPOINT ["/adguard-exporter"]
