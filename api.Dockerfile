FROM oven/bun:debian AS base

# Set the working directory
WORKDIR /usr/src/app

# Copy the current directory contents into the container at /usr/src/app
COPY ./src ./src
COPY ./package.json .
COPY ./bun.lock .
COPY ./api.ts .

# Install the project dependencies
RUN bun install

# Define the command to run the app
CMD ["bun", "run", "start-api-prod"]