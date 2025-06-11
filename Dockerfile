FROM node:22.15.0
LABEL authors="minding2796"

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ["node", "src/app.js"]