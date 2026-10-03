FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: the image only builds the static site; onnxruntime-node (golden test) is not needed here
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm models:fetch && pnpm exec vite build

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
