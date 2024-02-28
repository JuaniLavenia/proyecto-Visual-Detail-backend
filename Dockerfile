FROM node:14
WORKDIR /
COPY . /app
RUN npm install
ENV PORT 5000 
EXPOSE 5000
CMD ["npm", "start"] 