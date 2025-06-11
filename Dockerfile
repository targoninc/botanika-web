FROM oven/bun:debian AS base

RUN apt-get update -y && apt-get install -y openssl

# Set the working directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker cache
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY ./src ./src
COPY ./prisma ./prisma

# Generate Prisma client
RUN bunx prisma generate

# Build the UI
RUN bun run build-prod

# Define the command to run the app with database initialization
CMD ["bun", "run", "start-with-db"]
