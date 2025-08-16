# Frontend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install live-server globally
RUN npm install -g live-server

# Copy frontend files
COPY . .

# Expose port
EXPOSE 8080

# Command to run live-server
CMD ["live-server", "--host=0.0.0.0", "--port=8080", "--no-browser", "--entry-file=home.html", "."]