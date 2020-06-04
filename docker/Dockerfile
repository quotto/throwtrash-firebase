FROM node:10.19.0
WORKDIR /app
RUN npm install -g firebase-tools
ENV HOST 0.0.0.0
ENV PATH $PATH:./node_modules/.bin
ENV GOOGLE_APPLICATION_CREDENTIALS /app/serviceAccountKey.json
EXPOSE 5000 9005
VOLUME .:/app