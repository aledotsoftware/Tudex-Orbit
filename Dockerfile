# Step 1: Build the Vite application
FROM node:20-slim AS build
WORKDIR /app
COPY tudex-orbit/package*.json ./
RUN npm install
COPY tudex-orbit/ .
RUN npm run build

# Step 2: Serve the build directory using Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
