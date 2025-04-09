FROM node:18-alpine

# Create application directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Set default environment variables (can be overridden via .env or --env)
ENV NODE_ENV=production

# Default command
CMD ["node", "index.js"]