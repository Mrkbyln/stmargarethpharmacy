#!/usr/bin/env bash
# Simple helper to deploy `dist/` to Vercel using the Vercel CLI.
# Requires: VERCEL_TOKEN environment variable and VERCEL_ORG_ID and VERCEL_PROJECT_ID optionally.

set -euo pipefail

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN is not set. Create a token in Vercel dashboard and export it as VERCEL_TOKEN." >&2
  exit 1
fi

if [ ! -d dist ]; then
  echo "dist/ not found. Run npm run build first." >&2
  exit 1
fi

echo "Deploying dist/ to Vercel (production)..."
npx vercel --prod --token "$VERCEL_TOKEN" --confirm

echo "Deployment triggered. Check your Vercel dashboard for status." 
