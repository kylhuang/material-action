# 僅供工作坊教育訓練使用
# 多階段建置：先安裝正式環境相依套件，再複製到精簡的執行映像
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# 不用 root 執行
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
