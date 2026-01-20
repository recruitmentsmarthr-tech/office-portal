FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./

# Cache-busting RUN command
RUN echo "Cache buster: $(date)" > /tmp/cache_buster.txt
RUN npm install

COPY . .

CMD ["npm", "start"]
