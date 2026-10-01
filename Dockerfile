# Node 22 matches the version pinned in render.yaml; bcrypt's prebuilt binaries
# do not cover newer releases.
FROM node:22-alpine AS development

WORKDIR /app

# The lockfile is copied with the manifest so installs are reproducible
COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn run build

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /app

COPY package.json yarn.lock ./

# yarn's flag is --production; --only=prod belongs to npm and yarn ignores it
RUN yarn install --frozen-lockfile --production

COPY --from=development /app/dist ./dist

CMD ["node", "dist/main"]
