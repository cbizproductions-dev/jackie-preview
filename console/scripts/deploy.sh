#!/usr/bin/env bash
# Deploy the C-BIZ Console to Cloudflare (Kris's account). Safe to re-run.
#   Needs: CLOUDFLARE_API_TOKEN in the environment (or `npx wrangler login` on a laptop).
#   First run creates the KV namespace and a random ACCESS_KEY. Later runs keep the key unless ROTATE_KEY=1.
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci --silent
npm test --silent
npm run build --silent

# 1) KV namespace for the cached snapshot
if grep -q 'REPLACE_WITH_KV_ID' wrangler.toml; then
  id=$(npx wrangler kv namespace create SNAP 2>&1 | grep -oE '[0-9a-f]{32}' | head -1)
  [ -n "$id" ] || { echo "Could not create KV namespace"; exit 1; }
  sed -i.bak "s/REPLACE_WITH_KV_ID/$id/" wrangler.toml && rm -f wrangler.toml.bak
  echo "KV namespace created: $id (commit wrangler.toml so the next deploy reuses it)"
fi

# 2) Deploy the Worker + static assets
npx wrangler deploy

# 3) Access key (Worker secret). Printed once, never written to disk or logs.
if [ "${ROTATE_KEY:-0}" = "1" ] || ! npx wrangler secret list 2>/dev/null | grep -q ACCESS_KEY; then
  key=$(openssl rand -base64 33 | tr '+/' '-_' | tr -d '=\n')
  printf '%s' "$key" | npx wrangler secret put ACCESS_KEY >/dev/null
  echo
  echo "ACCESS_KEY set. Full-screen link: https://cbiz-console.<your-subdomain>.workers.dev/c/$key/"
  echo "(Copy it now — it isn't stored anywhere else.)"
fi

# 4) Optional: the build-time capture, shown until NOTION_TOKEN is set (only exists where fixtures/ does).
if [ -f seed/seed.json ]; then
  npx wrangler kv key put seed:v1 --path seed/seed.json --binding SNAP --remote >/dev/null && echo "Seed snapshot uploaded."
fi
echo "Done. Add the Notion token with: npx wrangler secret put NOTION_TOKEN"
