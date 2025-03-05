FROM oven/bun:slim AS base
WORKDIR /app

# separate install step into another image so that
# Docker can cache it
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun i

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun i

# Generate the Prisma client
FROM base AS prisma
COPY prisma prisma
COPY --from=install /temp/dev/node_modules node_modules
RUN bunx prisma generate

FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prisma /app/node_modules/.prisma/client node_modules/.prisma/client
COPY --from=prisma /app/prisma prisma
COPY src src
COPY public public
COPY entrypoint.sh package.json ./

CMD [ "/bin/bash", "entrypoint.sh" ]