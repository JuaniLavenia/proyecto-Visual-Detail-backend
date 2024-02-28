FROM node:18
WORKDIR /
COPY . /app
RUN npm install
ENV PORT 3000 
EXPOSE 3000
CMD ["npm", "start"]