FROM node:alpine AS development

WORKDIR /app

COPY package*.json ./

RUN yarn install

COPY . .

RUN yarn run build

FROM node:alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY package*.json ./

RUN yarn install --only=prod

COPY . .

COPY --from=development /app/dist ./dist

CMD ["node", "dist/main"]