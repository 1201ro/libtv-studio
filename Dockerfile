# LibTV Studio — 用于 Hugging Face Spaces (Docker SDK)
FROM node:20-alpine

WORKDIR /app

COPY . .

EXPOSE 7860

CMD ["node", "server.js"]
