FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
# Switch to Postgres schema for production container
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma && npx prisma generate

COPY . .

EXPOSE 5001

CMD ["sh", "-c", "npx prisma db push && node src/server.js"]
