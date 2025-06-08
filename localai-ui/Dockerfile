FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY backend/*.json ./backend/

# Install dependencies with clean environment
RUN npm install && \
    cd backend && \
    npm install

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# Create directories with proper permissions
RUN mkdir -p /app/output && \
    chown -R node:node /app && \
    chmod -R 775 /app/output

# Create shared directory for communication with parent project
RUN mkdir -p /app/shared && \
    chown -R node:node /app/shared && \
    chmod -R 775 /app/shared

# Expose ports
EXPOSE 5000
EXPOSE 5001

# Switch to node user for better security
USER node

# Start both frontend and backend
CMD PORT=5001 node backend/server.js & npx vite preview --port 5000 --host 0.0.0.0