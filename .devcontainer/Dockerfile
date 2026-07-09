# ── Version pins — change here, takes effect everywhere ──────────────────────
ARG NODE_VERSION=26
ARG NPM_VERSION=12

# mcr.microsoft.com/devcontainers/javascript-node only ships up to Node 24.
# Use the official Docker Hub image instead; it already provides a "node" user.
FROM node:${NODE_VERSION}-bookworm

# Re-declare so the value is available after FROM
ARG NPM_VERSION=12

# Replicate devcontainer conveniences: sudo access for the "node" user + git
RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    git \
    && echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pin npm to the declared version (keeps dev and CI in sync)
RUN npm install -g npm@${NPM_VERSION}

# GitHub Copilot CLI — download binary from GitHub releases
# The npm package @github/copilot-cli does not exist; the binary ships via GitHub Releases.
RUN curl -fsSL https://github.com/github/copilot-cli/releases/latest/download/copilot-linux-x64.tar.gz \
    | tar -xz -C /usr/local/bin \
    && chmod +x /usr/local/bin/copilot

# Native libraries needed by Electron for compilation, packaging, and local runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    xdg-utils \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev \
    libgl1 \
    libcups2 \
    libgtk-3-0 \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    libxkbcommon0 \
    libx11-xcb1 \
    libxshmfence1 \
    libgbm1 \
    libasound2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
