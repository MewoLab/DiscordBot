#!/bin/bash
echo "Waiting for database to be ready..."
sleep 10  # Give the database container a bit more time

echo "Running migrations..."
bunx prisma migrate dev -n init
echo "Starting application..."
bun /app/src/index.ts