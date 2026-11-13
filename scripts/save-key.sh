#!/bin/zsh
# Saves one key from a hidden prompt (paste with Cmd+V, then Enter) into .env,
# then checks it with the service. Never prints the key.
# Usage: scripts/save-key.sh gemini | brightdata | sentry | digitalocean
# Jev reuses Cheffy's key: scripts/save-key.sh jev  (no paste needed)
cd "${0:A:h}/.." || exit 1
name="$1"
case "$name" in
  gemini) var=GEMINI_API_KEY ;;
  brightdata) var=BRIGHTDATA_API_KEY ;;
  sentry) var=SENTRY_DSN ;;
  digitalocean) var=DIGITALOCEAN_TOKEN ;;
  jev) var=TYPESAFE_API_KEY ;;
  serp-zone) var=BRIGHTDATA_SERP_ZONE ;;
  unlocker-zone) var=BRIGHTDATA_UNLOCKER_ZONE ;;
  *) echo "Usage: scripts/save-key.sh gemini|brightdata|serp-zone|unlocker-zone|sentry|digitalocean|jev"; exit 1 ;;
esac

if [ "$name" = "jev" ] && [ -f "$HOME/.cheffy-typesafe-key" ]; then
  key=$(<"$HOME/.cheffy-typesafe-key")
else
  read -rs "key?Paste your $name value, then press Enter: "
  echo
  key="${key//$'\e'\[200~/}"
  key="${key//$'\e'\[201~/}"
  if [ "$name" = "sentry" ]; then
    key="${key//[^A-Za-z0-9.:\/@_-]/}"
  else
    key="${key//[^A-Za-z0-9._-]/}"
  fi
fi
if [ -z "$key" ]; then echo "Nothing pasted. Try again."; exit 1; fi

touch .env && chmod 600 .env
grep -v "^$var=" .env > .env.tmp 2>/dev/null; mv .env.tmp .env
print -r -- "$var=$key" >> .env

case "$name" in
  gemini)       code=$(curl -s -o /dev/null -w "%{http_code}" "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1" -H "x-goog-api-key: $key") ;;
  brightdata)   code=$(curl -s -o /dev/null -w "%{http_code}" "https://api.brightdata.com/zone/get_active_zones" -H "Authorization: Bearer $key") ;;
  digitalocean) code=$(curl -s -o /dev/null -w "%{http_code}" "https://api.digitalocean.com/v2/account" -H "Authorization: Bearer $key") ;;
  jev)          code=$(curl -s -o /dev/null -w "%{http_code}" https://api.typesafe.ai/v1/systemone -H "Authorization: Bearer $key" -H 'Content-Type: application/json' -d '{"model":"jev-latest","state":{"m":"hi"},"questions":{"q":{"type":"noul","instructions":"Does `m` greet?"}}}') ;;
  sentry)       [[ "$key" == https://*@*sentry.io/* ]] && code=200 || code="not a Sentry DSN" ;;
  *)            code=200 ;;
esac

if [ "$code" = "200" ]; then
  echo "✅ $name saved to .env and working."
else
  echo "❌ $name saved but rejected ($code). Copy it again and rerun."
fi
