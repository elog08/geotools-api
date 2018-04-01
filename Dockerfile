FROM node:carbon

MAINTAINER Eyasu Kifle <elog08.github.io>

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# If you are building your code for production
RUN npm install --only=production

# Bundle app source
COPY . .

ENV REDIS_HOST=redis
ENV PORT=8080

EXPOSE 8080
CMD [ "npm", "start" ]