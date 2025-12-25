# --- Stage 1: Build Frontend ---
FROM node:22.12.0-slim AS builder

WORKDIR /app

# Copy ONLY package.json files first to keep them clean
COPY package.json ./
COPY frontend/package.json ./frontend/

# Clean install dependencies specifically for the container's OS
# We use --include=optional to ensure @rollup/rollup-linux-x64-gnu is pulled
RUN npm install
RUN cd frontend && npm install --include=optional

# Copy all source code now
COPY . .

# Build
RUN npm run build-frontend

# --- Stage 2: Final Runtime ---
FROM node:22.12.0-slim

WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app .

EXPOSE 4000
ENV NODE_ENV=production

CMD ["npm", "run", "start"]