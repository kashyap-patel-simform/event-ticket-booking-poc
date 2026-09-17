FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx tsx watch src/server.ts"]
