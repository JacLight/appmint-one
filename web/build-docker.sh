#!/usr/bin/env bash
set -Eeuo pipefail

# Build an amd64 Appmint One image for one setup and load it locally.
#
#   ./build-docker.sh <setup> [tag]
#     setup : muvmnt | event-oxygen | stowbo | rental | law-firm | medical | studio | bank | demo
#     tag   : image tag (default: <setup>-<package.json version>)
#
# The setup is only the image's DEFAULT — PORTAL_SETUP in the pod env overrides it,
# so one image can serve any setup. No secrets are baked in; they come from the k8s
# Secret referenced by k8-deploy.template.yaml.
#
# This script does NOT push. After it builds:  docker login && docker push <image>

cd "$(dirname "$0")"

SETUPS="muvmnt event-oxygen stowbo rental law-firm medical studio bank demo"
SETUP="${1:-}"
if [[ -z "${SETUP}" ]]; then
  echo "Usage: $0 <setup> [tag]"; echo "Setups: ${SETUPS}"; exit 1
fi
SETUP="$(echo "${SETUP}" | tr '[:upper:]' '[:lower:]')"
if [[ " ${SETUPS} " != *" ${SETUP} "* ]]; then
  echo "Error: unknown setup '${SETUP}'. Setups: ${SETUPS}"; exit 1
fi

if command -v jq >/dev/null 2>&1; then
  VERSION="$(jq -r .version package.json)"
else
  VERSION="$(grep -m1 '"version"' package.json | awk -F: '{print $2}' | sed 's/[",]//g' | tr -d '[:space:]')"
fi
[[ -z "${VERSION}" || "${VERSION}" == "null" ]] && { echo "Error: no version in package.json"; exit 1; }

REPO="${IMAGE_REPO:-jaclight/appmint-one}"
TAG="${2:-${SETUP}-${VERSION}}"
IMAGE="${REPO}:${TAG}"
PLATFORM="linux/amd64"

echo "============================================================"
echo "Image    : ${IMAGE}"
echo "Setup    : ${SETUP}"
echo "Platform : ${PLATFORM}"
echo "Action   : BUILD (load locally, no push)"
echo "============================================================"

docker buildx version >/dev/null 2>&1 || { echo "Error: docker buildx not available"; exit 1; }

if ! docker buildx inspect multiarch-builder >/dev/null 2>&1; then
  docker buildx create --name multiarch-builder --use
  docker buildx inspect --bootstrap
else
  docker buildx use multiarch-builder
  docker buildx inspect --bootstrap >/dev/null
fi

docker buildx build \
  --platform "${PLATFORM}" \
  --build-arg "PORTAL_SETUP=${SETUP}" \
  -t "${IMAGE}" \
  -f Dockerfile \
  --load \
  --progress plain \
  .

echo ""
echo "Built ${IMAGE}"
echo ""
echo "Push:   docker push ${IMAGE}"
echo "Deploy: render k8-deploy.template.yaml with SETUP=${SETUP} IMAGE=${IMAGE} (see README)"
echo "Run:    docker run --rm -p 3000:3000 --env-file <your env file> ${IMAGE}"
