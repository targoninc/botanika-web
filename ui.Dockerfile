FROM oven/bun:debian AS base

# Set the working directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker cache
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY ./src ./src
COPY ./package.json .
COPY ./bun.lock .
COPY ./api.ts .

# Build the UI
RUN bun run build-ui-prod

# Define the command to run the app
CMD ["bun", "run", "start-ui-prod"]