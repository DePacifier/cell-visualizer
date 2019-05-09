FROM node:alpine as builder

RUN mkdir /root/react
WORKDIR /root/react
ARG SERVER_ADDR
ENV SERVICE_ADDR $SERVER_ADDR
COPY . ./

RUN npm install
RUN npm run-script build
RUN npm install pm2 -g
CMD ["pm2-runtime", "app.js"]
