FROM node:20-alpine
RUN apk add curl
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "entrypoint.sh", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY src ./src
HEALTHCHECK --interval=1m --timeout=10s CMD curl -f http://localhost:3003/health || exit 1
CMD [ "node", "src/index.js" ]
