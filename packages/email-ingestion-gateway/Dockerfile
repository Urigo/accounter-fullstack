# /packages/email-ingestion-gateway/Dockerfile
FROM mcr.microsoft.com/playwright:v1.61.1 AS builder

WORKDIR /app

# Copy root manifests first to leverage the Docker layer cache for `yarn install`.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy only the workspace manifests (package.json) before installing so the
# dependency-install layer stays cached and is invalidated only when a manifest
# changes, not on every source edit.
COPY packages/client/package.json ./packages/client/
COPY packages/email-ingestion-gateway/package.json ./packages/email-ingestion-gateway/
COPY packages/etana-scraper/package.json ./packages/etana-scraper/
COPY packages/etherscan-scraper/package.json ./packages/etherscan-scraper/
COPY packages/gmail-listener/package.json ./packages/gmail-listener/
COPY packages/green-invoice-graphql/package.json ./packages/green-invoice-graphql/
COPY packages/hashavshevet-mesh/package.json ./packages/hashavshevet-mesh/
COPY packages/israeli-vat-scraper/package.json ./packages/israeli-vat-scraper/
COPY packages/kraken-scraper/package.json ./packages/kraken-scraper/
COPY packages/migrations/package.json ./packages/migrations/
COPY packages/modern-poalim-scraper/package.json ./packages/modern-poalim-scraper/
COPY packages/payper-mesh/package.json ./packages/payper-mesh/
COPY packages/pcn874-generator/package.json ./packages/pcn874-generator/
COPY packages/scraper-app/package.json ./packages/scraper-app/
COPY packages/scraper-local-app/package.json ./packages/scraper-local-app/
COPY packages/server/package.json ./packages/server/
COPY packages/shaam-uniform-format-generator/package.json ./packages/shaam-uniform-format-generator/
COPY packages/shaam6111-generator/package.json ./packages/shaam6111-generator/
RUN yarn install --immutable

# Copy the rest of the source code
COPY . .

# Build the application
RUN yarn generate:graphql
RUN yarn workspace @accounter/email-ingestion-gateway build

# Prune dependencies to only what's needed for production
RUN yarn workspaces focus @accounter/email-ingestion-gateway --production

# --- Production Stage ---
FROM mcr.microsoft.com/playwright:v1.61.1

WORKDIR /app
ENV NODE_ENV=production

# Copy only necessary artifacts from the builder stage for a minimal production image.
# Files are owned by the non-root `pwuser` bundled in the Playwright base image.
COPY --chown=pwuser:pwuser --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --chown=pwuser:pwuser --from=builder /app/.yarn ./.yarn
COPY --chown=pwuser:pwuser --from=builder /app/node_modules ./node_modules
COPY --chown=pwuser:pwuser --from=builder /app/packages/email-ingestion-gateway/package.json ./packages/email-ingestion-gateway/package.json
COPY --chown=pwuser:pwuser --from=builder /app/packages/email-ingestion-gateway/dist ./packages/email-ingestion-gateway/dist

# Run as the non-root user provided by the Playwright base image (least privilege).
USER pwuser

# Start the specific workspace service
CMD ["yarn", "workspace", "@accounter/email-ingestion-gateway", "start"]
