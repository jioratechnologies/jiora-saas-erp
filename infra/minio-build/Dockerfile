# Self-built, multi-arch MinIO server image. MinIO Inc. discontinued free
# distribution of pre-built community-edition images/binaries in 2025 —
# quay.io, Docker Hub, ghcr.io, and dl.min.io all deny anonymous pulls now,
# confirmed by testing all four directly. The source itself is still AGPLv3
# and on GitHub, so this builds it ourselves.
#
# Pinned to the last release tag published before that change (not
# `master`), to avoid pulling in anything from after MinIO restricted
# distribution.
#
# --platform=$BUILDPLATFORM on the build stage: the Go compiler runs
# natively (no QEMU) and cross-compiles for TARGETARCH via GOARCH — much
# faster than emulating the whole build per target platform. Only the tiny
# final COPY-only stage actually runs as each target platform.
#
# Usage (multi-arch build + push in one step — buildx can't `docker push` a
# multi-arch manifest built with plain `docker build`, has to push directly):
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     -t <your-registry>/minio:RELEASE.2025-10-15T17-29-55Z \
#     -t <your-registry>/minio:latest \
#     --push infra/minio-build

FROM --platform=$BUILDPLATFORM golang:1.24-bookworm AS build
ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
RUN git clone --depth 1 --branch ${MINIO_VERSION} https://github.com/minio/minio.git .
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -tags kqueue -trimpath -ldflags "-s -w" -o /out/minio .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/minio /usr/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
