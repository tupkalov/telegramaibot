FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "entrypoint.sh", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY src ./src
RUN chmod +x entrypoint.sh
ENTRYPOINT [ "/usr/src/app/entrypoint.sh" ]
CMD [ "node", "src/index.js" ]
