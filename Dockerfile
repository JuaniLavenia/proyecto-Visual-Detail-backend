FROM node:18
WORKDIR /
COPY . /app
RUN npm install
ENV PORT 3000 
ENV MONGODB_URI 'mongodb+srv://Rolling:rolling.useradmin@cluster0.mytro0v.mongodb.net/visualDetaling?retryWrites=true&w=majority'
ENV JWT_SECRET '2k3jh4vb1k2j34k'
CMD ["npm", "start"]