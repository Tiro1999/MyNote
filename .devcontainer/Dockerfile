# ── Version pins — change here, takes effect everywhere ──────────────────────
ARG NODE_VERSION=26
ARG NPM_VERSION=11

# mcr.microsoft.com/devcontainers/javascript-node only ships up to Node 24.
# Use the official Docker Hub image instead; it already provides a "node" user.
FROM node:${NODE_VERSION}-bookworm

# Re-declare so the value is available after FROM
ARG NPM_VERSION=11

# Replicate devcontainer conveniences: sudo access for the "node" user + git
RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    git \
    && echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pin npm to the declared version (keeps dev and CI in sync)
RUN npm install -g npm@${NPM_VERSION}

# Native libraries needed by Electron for compilation and packaging
RUN apt-get update && apt-get install -y --no-install-recommends \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
