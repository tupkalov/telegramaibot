FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["src/package.json", "src/package-lock.json*", "src/npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY src/* .
RUN chown -R node /usr/src/app
USER node
CMD ["node", "index.js"]
