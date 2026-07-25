FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

# Build argument and environment variable for GROQ_API_KEY with automatic default fallback
ARG GROQ_API_KEY=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
ENV GROQ_API_KEY=${GROQ_API_KEY}

COPY . .
# We use npm run dev in docker for a hackathon demo to make it easy to view logs and avoid build issues with missing env vars.
# If you prefer a production build, change this to: RUN npm run build && CMD ["npm", "start"]
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
