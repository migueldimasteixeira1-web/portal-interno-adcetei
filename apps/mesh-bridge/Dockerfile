FROM node:22-alpine

ARG MESHCENTRAL_VERSION=1.1.59
RUN npm install -g meshcentral@${MESHCENTRAL_VERSION}

WORKDIR /app
COPY package.json ./package.json
COPY src ./src

ENV PORT=8080
EXPOSE 8080
CMD ["node", "src/server.js"]
