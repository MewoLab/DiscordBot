#!/bin/bash
echo "Running migrations..."
bunx prisma migrate dev -n init
echo "Starting application..."
bun /app/src/index.ts