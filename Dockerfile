# @author Stephan Coertzen (coertzen.jfs@gmail.com)
# @license Apache-2.0
# antislopscan is open-source software. See LICENSE.TXT for license information.
FROM node:22.22.3-bookworm-slim@sha256:e21fc383b50d5347dc7a9f1cae45b8f4e2f0d39f7ade28e4eef7d2934522b752 AS base
ENV DEBIAN_FRONTEND=noninteractive PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv ca-certificates curl util-linux tini git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
RUN node node_modules/playwright/cli.js install --with-deps chromium
COPY tools/requirements.lock ./tools/
RUN python3 -m venv /app/tools/python \
    && /app/tools/python/bin/pip install --no-cache-dir -r tools/requirements.lock
COPY . .
RUN sh scripts/install-native-tools.sh && sh scripts/install-ci-tools.sh && npm run build \
    && npm run check:tests && npm run check:docs && npm run check:testing && npm run package:built

FROM build AS runtime
# Legacy defaults keep existing environment overrides working; ANTISLOPSCAN_* settings take precedence.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 \
    CODESENTRY_SOURCE_ROOT=/workspace CODESENTRY_DATA_DIRECTORY=/data \
    CODESENTRY_CHROMIUM_SANDBOX=false HOME=/tmp
RUN mkdir -p /data /reports /workspace \
    && chown node:node /data /reports /workspace \
    && chmod 700 /data /reports \
    && chmod 755 /app/dist/cli.js \
    && ln -s /app/dist/cli.js /usr/local/bin/antislopscan
USER node:node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "antislopscan"]
CMD ["gui"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["node", "scripts/healthcheck.mjs"]
