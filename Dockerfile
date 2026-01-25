# Production image using pre-built .next from local
# Build locally first: npm run build
# Then deploy to VPS and run docker compose up

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Copy pre-built standalone output (Next.js preserves local path structure)
COPY public ./public
COPY .next/standalone/ ./
COPY .next/static ./.next/static

USER nextjs

EXPOSE 3001

CMD ["node", "server.js"]
