FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "entrypoint.sh", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY src ./src
CMD [ "node", "src/index.js" ]
