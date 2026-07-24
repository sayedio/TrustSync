FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
# We use npm run dev in docker for a hackathon demo to make it easy to view logs and avoid build issues with missing env vars.
# If you prefer a production build, change this to: RUN npm run build && CMD ["npm", "start"]
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
