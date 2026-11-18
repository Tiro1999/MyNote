# ── Version pins — hand copies of .nvmrc and devEngines in application/package.json ──
ARG NODE_VERSION=26.13.0
ARG NPM_VERSION=12.2.3

# Official Node image with a "node" user; mcr devcontainers/javascript-node stops at Node 24
FROM node:${NODE_VERSION}-bookworm

# Replicate devcontainer conveniences: sudo access for the "node" user + git
RUN apt-get update && apt-get install -y --no-install-recommends \
    sudo \
    git \
    && echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

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

# Replace the npm bundled with Node by the pinned one; a global ARG needs re-declaring after FROM
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
