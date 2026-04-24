FROM node:20-alpine

WORKDIR /app

ENV PORT=4000

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 4000
CMD ["npm", "start"]
