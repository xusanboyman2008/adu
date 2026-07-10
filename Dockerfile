# Use the official Playwright image — browsers + ALL system deps pre-installed
FROM mcr.microsoft.com/playwright:v1.61.0-noble

# Set working directory
WORKDIR /app

# Install Python + pip + openpyxl (needed by the runner to parse names.xlsx)
RUN apt-get update -y && \
    apt-get install -y python3 python3-pip python3-openpyxl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install Node dependencies (skip postinstall browser download — already in image)
RUN npm install --ignore-scripts

# Copy the rest of the project
COPY . .

# Expose port for Render's keep-alive health check
EXPOSE 3000

# npm start → server.js (HTTP keep-alive) which spawns the Playwright worker
CMD ["npm", "start"]
