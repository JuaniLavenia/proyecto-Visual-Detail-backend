FROM node:14
WORKDIR /
COPY . /app
RUN npm install
CMD ["npm", "start"]