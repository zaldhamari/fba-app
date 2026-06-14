#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Siftly — Production Readiness Verification
# ─────────────────────────────────────────────────────────────────────────────
# Usage: ./scripts/verify-production-readiness.sh
#
# Optional shell env vars unlock extended checks (set locally, never paste to chat):
#   export RC_SECRET_KEY=sk_...           # RevenueCat secret API key
#   export RC_PROJECT_ID=...              # RevenueCat project UUID
#   export ASC_KEY_ID=ABCD123456          # App Store Connect key ID
#   export ASC_ISSUER_ID=xxxx-xxxx-...    # App Store Connect issuer ID
#   export ASC_P8_PATH=~/.appstore/AuthKey_ABCD.p8   # Path to .p8 file
#   export SENTRY_AUTH_TOKEN=...          # Sentry auth token (for local CLI auth)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ── Colors ────────────────────────────────────────────────────────────────────
R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'
B=$'\033[0;34m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; NC=$'\033[0m'

BLOCKERS=0; WARNINGS=0; SKIPPED=0

section() { printf "\n${BOLD}▸ %s${NC}\n" "$1"; }
pass()    { printf "  ${G}✓${NC}  %s\n" "$1"; }
fail()    { printf "  ${R}✗${NC}  %s\n" "$1"; BLOCKERS=$((BLOCKERS+1)); }
warn()    { printf "  ${Y}⚠${NC}  %s\n" "$1"; WARNINGS=$((WARNINGS+1)); }
skip()    { printf "  ${B}↷${NC}  %s\n" "$1"; SKIPPED=$((SKIPPED+1)); }
detail()  { printf "       ${DIM}%s${NC}\n" "$1"; }
line()    { printf "${DIM}──────────────────────────────────────────────────────────${NC}\n"; }

# ── Banner ────────────────────────────────────────────────────────────────────
printf "\n"
line
printf "${BOLD}  Siftly — Production Readiness Verification${NC}\n"
printf "${DIM}  %s${NC}\n" "$(date '+%Y-%m-%d %H:%M:%S')"
line

# ═════════════════════════════════════════════════════════════════════════════
# 1. PROJECT HEALTH
# ═════════════════════════════════════════════════════════════════════════════
section "1 · Project Health"

# Confirm Siftly project
PROJ_SLUG=$(node -e "try{const a=require('./app.json');console.log(a.expo?.slug||'')}catch(e){console.log('')}" 2>/dev/null || true)
if [[ "$PROJ_SLUG" == "siftly" ]]; then
  pass "Project confirmed: siftly ($(pwd))"
else
  fail "Not a Siftly project or app.json missing (slug='$PROJ_SLUG')"
fi

# package-lock.json
if [[ -f "package-lock.json" ]]; then
  pass "package-lock.json present"
else
  warn "package-lock.json missing — run: npm install"
fi

# TypeScript
printf "  Running TypeScript check...\n"
TSC_OUT=$(npx tsc --noEmit 2>&1 || true)
if printf '%s\n' "$TSC_OUT" | grep -q "error TS" 2>/dev/null; then
  TSC_ERRORS=$(printf '%s\n' "$TSC_OUT" | grep "error TS" | wc -l | tr -d ' ')
  fail "TypeScript: $TSC_ERRORS error(s)"
  printf '%s\n' "$TSC_OUT" | grep "error TS" | head -5 | while IFS= read -r tline; do
    detail "$tline"
  done
else
  pass "TypeScript: 0 errors"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 2. EAS PRODUCTION ENVIRONMENT VARIABLES
# ═════════════════════════════════════════════════════════════════════════════
section "2 · EAS Production Environment Variables"

REQUIRED_EAS_VARS=(
  EXPO_PUBLIC_API_KEY
  EXPO_PUBLIC_RC_KEY_IOS
  EXPO_PUBLIC_RC_KEY_ANDROID
  EXPO_PUBLIC_SENTRY_DSN
  EXPO_PUBLIC_SUPABASE_URL
  EXPO_PUBLIC_SUPABASE_ANON_KEY
  SENTRY_AUTH_TOKEN
)

EAS_OUTPUT=$(eas env:list --environment production 2>&1 || true)

if printf '%s\n' "$EAS_OUTPUT" | grep -q "Not logged in\|unauthorized\|Login required"; then
  fail "EAS not authenticated — run: eas login"
elif printf '%s\n' "$EAS_OUTPUT" | grep -q "No variables found"; then
  for var in "${REQUIRED_EAS_VARS[@]}"; do
    fail "$var — MISSING"
  done
else
  for var in "${REQUIRED_EAS_VARS[@]}"; do
    if printf '%s\n' "$EAS_OUTPUT" | grep -qE "^${var}="; then
      pass "$var — PRESENT"
    else
      fail "$var — MISSING"
    fi
  done
fi

# ═════════════════════════════════════════════════════════════════════════════
# 3. APP.JSON — SENTRY CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════════
section "3 · Sentry Configuration (app.json)"

SENTRY_ORG=$(node -e "
try {
  const a=require('./app.json');
  const s=a.expo.plugins.find(p=>Array.isArray(p)&&p[0]==='@sentry/react-native');
  console.log(s?s[1].organization:'__MISSING__');
} catch(e) { console.log('__MISSING__'); }
" 2>/dev/null || echo "__MISSING__")

SENTRY_PROJ=$(node -e "
try {
  const a=require('./app.json');
  const s=a.expo.plugins.find(p=>Array.isArray(p)&&p[0]==='@sentry/react-native');
  console.log(s?s[1].project:'__MISSING__');
} catch(e) { console.log('__MISSING__'); }
" 2>/dev/null || echo "__MISSING__")

if [[ "$SENTRY_ORG" == "__MISSING__" ]]; then
  fail "@sentry/react-native plugin not found in app.json"
else
  pass "@sentry/react-native plugin present"

  if [[ "$SENTRY_ORG" == "REPLACE_WITH_YOUR_SENTRY_ORG_SLUG" ]]; then
    fail "organization slug is still placeholder — provide real org slug"
  else
    pass "organization: $SENTRY_ORG"
  fi

  if [[ "$SENTRY_PROJ" == "REPLACE_WITH_YOUR_SENTRY_PROJECT_SLUG" ]]; then
    fail "project slug is still placeholder — provide real project slug"
  else
    pass "project: $SENTRY_PROJ"
  fi
fi

# Verify DSN sourced from env var
if grep -q 'EXPO_PUBLIC_SENTRY_DSN' App.tsx 2>/dev/null; then
  pass "DSN sourced from env var (not hardcoded)"
else
  warn "Could not verify EXPO_PUBLIC_SENTRY_DSN usage in App.tsx"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 4. EAS.JSON — PRODUCTION PROFILE
# ═════════════════════════════════════════════════════════════════════════════
section "4 · eas.json Production Profile"

EAS_PROFILE_CHECK=$(node -e "
try {
  const e=require('./eas.json');
  const p=e.build?.production;
  if (!p) { console.log('NO_PROFILE'); process.exit(0); }
  const bypass=p.env?.EXPO_PUBLIC_DEV_BYPASS??'absent';
  const autoInc=p.autoIncrement===true?'yes':'no';
  // Detect suspiciously long hardcoded values (potential embedded secrets)
  const envVals=Object.values(p.env||{});
  const suspicious=envVals.filter(v=>typeof v==='string'&&v.length>30&&!/^(true|false)$/.test(v)).length;
  console.log('AUTO:'+autoInc);
  console.log('BYPASS:'+bypass);
  console.log('SUSPICIOUS:'+suspicious);
} catch(e) { console.log('ERROR:'+e.message); }
" 2>/dev/null || echo "ERROR:parse failed")

if printf '%s\n' "$EAS_PROFILE_CHECK" | grep -q "NO_PROFILE\|ERROR:"; then
  fail "production profile missing or unreadable in eas.json"
else
  pass "production profile exists"

  AUTO=$(printf '%s\n' "$EAS_PROFILE_CHECK"   | grep "^AUTO:"       | cut -d: -f2)
  BYPASS=$(printf '%s\n' "$EAS_PROFILE_CHECK" | grep "^BYPASS:"     | cut -d: -f2)
  SUSP=$(printf '%s\n' "$EAS_PROFILE_CHECK"   | grep "^SUSPICIOUS:" | cut -d: -f2)

  [[ "$AUTO" == "yes" ]] && pass "autoIncrement: true" || fail "autoIncrement not true — build number won't increment"

  case "$BYPASS" in
    "false") pass "EXPO_PUBLIC_DEV_BYPASS: false" ;;
    "absent") pass "EXPO_PUBLIC_DEV_BYPASS: absent (safe default)" ;;
    "true")  fail "EXPO_PUBLIC_DEV_BYPASS is true — MUST be false or absent in production" ;;
    *)       warn "EXPO_PUBLIC_DEV_BYPASS: unexpected value '$BYPASS'" ;;
  esac

  if [[ "$SUSP" -gt 0 ]]; then
    warn "$SUSP long string value(s) in production env block — verify no hardcoded secrets"
  else
    pass "No hardcoded secrets detected in production env block"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# 5. REVENUECAT
# ═════════════════════════════════════════════════════════════════════════════
section "5 · RevenueCat"

printf "  ${BOLD}Source code analysis:${NC}\n"

# Entitlements from revenuecat.ts
RC_ENTS=$(grep -oE "active\['[a-z]+'\]" src/lib/revenuecat.ts 2>/dev/null \
  | grep -oE "'[a-z]+'" | tr -d "'" | sort -u | tr '\n' ' ' || echo "none found")
detail "Entitlements checked in code: $RC_ENTS"

# Prices from useSubscription.ts
PRICES=$(node -e "
try {
  const fs=require('fs');
  const src=fs.readFileSync('src/hooks/useSubscription.ts','utf8');
  // Extract PLAN_PRICES block
  const bm=src.match(/builder[\s\S]{0,60}monthly:\s*([\d.]+)/);
  const ba=src.match(/builder[\s\S]{0,60}annual:\s*([\d.]+)/);
  const om=src.match(/operator[\s\S]{0,60}monthly:\s*([\d.]+)/);
  const oa=src.match(/operator[\s\S]{0,60}annual:\s*([\d.]+)/);
  if(bm) console.log('builder_monthly: \$'+bm[1]);
  if(ba) console.log('builder_annual:  \$'+ba[1]);
  if(om) console.log('operator_monthly:\$'+om[1]);
  if(oa) console.log('operator_annual: \$'+oa[1]);
} catch(e) { console.log('parse error: '+e.message); }
" 2>/dev/null || true)
detail "Prices displayed in app:"
printf '%s\n' "$PRICES" | while IFS= read -r p; do detail "  $p"; done

# Expected entitlements
for ent in builder operator; do
  if printf '%s\n' "$RC_ENTS" | grep -q "$ent"; then
    pass "Entitlement '$ent' referenced in revenuecat.ts"
  else
    fail "Entitlement '$ent' NOT found in revenuecat.ts"
  fi
done

# Package ID pattern (constructed dynamically as \${tier}_\${period})
if grep -q '`\${tier}_\${period}`' src/lib/revenuecat.ts 2>/dev/null; then
  pass "Package IDs constructed dynamically (\${tier}_\${period}) — builder/operator × monthly/annual"
else
  warn "Package ID construction pattern not found — verify manually"
fi

# Optional: RC API check
if [[ -n "${RC_SECRET_KEY:-}" && -n "${RC_PROJECT_ID:-}" ]]; then
  printf "\n  ${BOLD}RevenueCat API (live check):${NC}\n"

  RC_BASE="https://api.revenuecat.com/v2/projects/${RC_PROJECT_ID}"
  RC_AUTH="Authorization: Bearer ${RC_SECRET_KEY}"

  # Products
  RC_PROD=$(curl -sf --max-time 10 -H "$RC_AUTH" "$RC_BASE/products" 2>/dev/null || echo '{"error":true}')
  if printf '%s\n' "$RC_PROD" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('items') else 1)" 2>/dev/null; then
    detail "Products:"
    printf '%s\n' "$RC_PROD" | python3 -c "
import json,sys
for p in json.load(sys.stdin).get('items',[]):
    sid=p.get('store_identifier',p.get('id','?'))
    print(f'  {sid}  [{p.get(\"type\",\"?\")}]')
" 2>/dev/null | while IFS= read -r p; do detail "$p"; done

    # Verify expected products
    EXPECTED_PRODS="siftly_builder_monthly siftly_builder_annual siftly_operator_monthly siftly_operator_annual"
    for prod in $EXPECTED_PRODS; do
      if printf '%s\n' "$RC_PROD" | python3 -c "
import json,sys
ids=[p.get('store_identifier','') for p in json.load(sys.stdin).get('items',[])]
sys.exit(0 if '$prod' in ids else 1)
" 2>/dev/null; then
        pass "Product '$prod' found in RC"
      else
        fail "Product '$prod' NOT found in RC"
      fi
    done
  else
    warn "RC products API returned no items or error — check RC_SECRET_KEY and RC_PROJECT_ID"
  fi

  # Entitlements
  RC_ENT=$(curl -sf --max-time 10 -H "$RC_AUTH" "$RC_BASE/entitlements" 2>/dev/null || echo '{"error":true}')
  detail "Entitlements:"
  printf '%s\n' "$RC_ENT" | python3 -c "
import json,sys
for e in json.load(sys.stdin).get('items',[]):
    print(f'  {e.get(\"identifier\",e.get(\"id\",\"?\"))}')
" 2>/dev/null | while IFS= read -r e; do detail "$e"; done

  # Offerings
  RC_OFF=$(curl -sf --max-time 10 -H "$RC_AUTH" "$RC_BASE/offerings" 2>/dev/null || echo '{"error":true}')
  detail "Offerings:"
  printf '%s\n' "$RC_OFF" | python3 -c "
import json,sys
for o in json.load(sys.stdin).get('items',[]):
    marker='[DEFAULT]' if o.get('is_current') else ''
    print(f'  {o.get(\"identifier\",\"?\")} {marker}')
    for pkg in o.get('packages',[]):
        print(f'    · {pkg.get(\"identifier\",\"?\")}')
" 2>/dev/null | while IFS= read -r o; do detail "$o"; done

else
  skip "RC API check skipped — to enable:"
  detail "export RC_SECRET_KEY=sk_...  # RC dashboard → Project Settings → API Keys"
  detail "export RC_PROJECT_ID=...     # RC dashboard → Project Settings → Project ID"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 6. APP STORE CONNECT
# ═════════════════════════════════════════════════════════════════════════════
section "6 · App Store Connect"

if [[ -n "${ASC_KEY_ID:-}" && -n "${ASC_ISSUER_ID:-}" && -n "${ASC_P8_PATH:-}" ]]; then
  ASC_P8_EXPANDED="${ASC_P8_PATH/#\~/$HOME}"

  if [[ ! -f "$ASC_P8_EXPANDED" ]]; then
    fail ".p8 file not found at: $ASC_P8_PATH"
  else
    pass ".p8 key file found"

    if ! python3 -c "import jwt" 2>/dev/null; then
      skip "PyJWT not installed — run: pip3 install PyJWT"
      detail "Then re-run with ASC vars set"
    else
      # Generate JWT
      ASC_JWT=$(python3 - <<PYEOF 2>/dev/null || echo ""
import jwt, time, sys
try:
    with open("$ASC_P8_EXPANDED") as f:
        key = f.read()
    payload = {
        "iss": "$ASC_ISSUER_ID",
        "iat": int(time.time()),
        "exp": int(time.time()) + 1200,
        "aud": "appstoreconnect-v1"
    }
    tok = jwt.encode(payload, key, algorithm="ES256", headers={"kid": "$ASC_KEY_ID", "typ": "JWT"})
    print(tok if isinstance(tok, str) else tok.decode())
except Exception as e:
    print("", file=sys.stderr)
PYEOF
)

      if [[ -z "$ASC_JWT" ]]; then
        fail "Failed to generate ASC JWT — check .p8 file and key IDs"
      else
        pass "ASC JWT generated"

        BUNDLE_ID=$(node -e "console.log(require('./app.json').expo.ios.bundleIdentifier)" 2>/dev/null || echo "")
        ASC_BASE="https://api.appstoreconnect.apple.com/v1"

        # Find app
        APPS_RESP=$(curl -sf --max-time 15 \
          -H "Authorization: Bearer $ASC_JWT" \
          "$ASC_BASE/apps?filter[bundleId]=$BUNDLE_ID&fields[apps]=name,bundleId" 2>/dev/null || echo '{}')

        APP_ID=$(python3 -c "
import json,sys
d=json.load(sys.stdin)
items=d.get('data',[])
print(items[0]['id'] if items else '')
" <<< "$APPS_RESP" 2>/dev/null || echo "")

        if [[ -z "$APP_ID" ]]; then
          warn "App '$BUNDLE_ID' not found in ASC — check bundle ID or key permissions"
        else
          pass "App found in ASC (bundle: $BUNDLE_ID)"

          # Get subscription groups with subscriptions included
          SUBS_RESP=$(curl -sf --max-time 15 \
            -H "Authorization: Bearer $ASC_JWT" \
            "$ASC_BASE/apps/$APP_ID/subscriptionGroups?include=subscriptions&limit=20" \
            2>/dev/null || echo '{}')

          # Parse and compare
          EXPECTED_PRODS="siftly_builder_monthly:17.99 siftly_builder_annual:119.99 siftly_operator_monthly:39.99 siftly_operator_annual:289.00"

          FOUND_PRODS=$(python3 -c "
import json, sys
d = json.load(sys.stdin)
groups  = d.get('data', [])
included = {s['id']: s for s in d.get('included', []) if s.get('type') == 'subscriptions'}
results = []
for g in groups:
    grp_name = g.get('attributes',{}).get('referenceName','?')
    for rel in g.get('relationships',{}).get('subscriptions',{}).get('data',[]):
        sub = included.get(rel['id'], {})
        attrs = sub.get('attributes', {})
        pid   = attrs.get('productId', '?')
        state = attrs.get('state', '?')
        results.append(f'{pid}={state}')
print('\n'.join(results))
" <<< "$SUBS_RESP" 2>/dev/null || echo "")

          detail "Subscription products found:"
          printf '%s\n' "$FOUND_PRODS" | while IFS='=' read -r prod state; do
            [[ -z "$prod" ]] && continue
            detail "  $prod  [state: $state]"
          done

          # Compare expected
          for item in $EXPECTED_PRODS; do
            prod="${item%%:*}"
            if printf '%s\n' "$FOUND_PRODS" | grep -q "^${prod}="; then
              STATE=$(printf '%s\n' "$FOUND_PRODS" | grep "^${prod}=" | cut -d= -f2)
              if [[ "$STATE" == "APPROVED" || "$STATE" == "READY_FOR_SALE" ]]; then
                pass "$prod — $STATE"
              else
                warn "$prod — state is '$STATE' (expected APPROVED)"
              fi
            else
              fail "$prod — NOT FOUND in ASC subscription group"
            fi
          done
          warn "Prices require manual verification in ASC UI — check each product's price tier"
        fi
      fi
    fi
  fi
else
  skip "ASC check skipped — to enable (slugs/IDs are not secrets):"
  detail "export ASC_KEY_ID=ABCD1234"
  detail "export ASC_ISSUER_ID=xxxxx-xxxx-..."
  detail "export ASC_P8_PATH=~/.appstore/AuthKey_ABCD1234.p8"
  detail "ASC → Users and Access → Integrations → App Store Connect API → + (App Manager)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 7. RAILWAY
# ═════════════════════════════════════════════════════════════════════════════
section "7 · Railway"

if ! command -v railway &>/dev/null; then
  skip "railway CLI not installed — run: brew install railway"
else
  RAILWAY_WHO=$(railway whoami 2>&1 || true)

  if printf '%s\n' "$RAILWAY_WHO" | grep -qiE "unauthorized|login again|invalid_grant|failed to refresh|token"; then
    skip "Railway session expired — run: railway login"
  elif printf '%s\n' "$RAILWAY_WHO" | grep -qE "@|Logged in"; then
    RAILWAY_USER=$(printf '%s\n' "$RAILWAY_WHO" | grep -E "@" | head -1 | xargs)
    pass "Railway authenticated: $RAILWAY_USER"

    RAILWAY_STATUS=$(railway status 2>&1 || true)
    if printf '%s\n' "$RAILWAY_STATUS" | grep -qiE "Project:|linked"; then
      pass "Railway project linked"
      RAILWAY_VARS=$(railway variables 2>&1 || true)
      if printf '%s\n' "$RAILWAY_VARS" | grep -qE "^API_KEY\s|^API_KEY="; then
        pass "Railway API_KEY variable present"
      else
        warn "Railway API_KEY not found in linked project variables"
      fi
    else
      warn "No Railway project linked — run: railway link"
    fi
  else
    skip "Railway status unclear — run: railway login"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# 8. SENTRY CLI
# ═════════════════════════════════════════════════════════════════════════════
section "8 · Sentry CLI"

if ! command -v sentry-cli &>/dev/null; then
  skip "sentry-cli not installed — run: brew install sentry-cli"
else
  SENTRY_VER=$(sentry-cli --version 2>&1 | head -1 || echo "unknown")
  pass "sentry-cli installed: $SENTRY_VER"

  # Check if SENTRY_AUTH_TOKEN is available locally for CLI auth
  if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
    SENTRY_INFO=$(SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" sentry-cli info 2>&1 || true)
    if printf '%s\n' "$SENTRY_INFO" | grep -qiE "error|unauthorized|401|invalid"; then
      fail "sentry-cli auth failed — verify SENTRY_AUTH_TOKEN scopes"
    else
      pass "sentry-cli authenticated"

      # Verify org slug exists
      if [[ "$SENTRY_ORG" != "REPLACE_WITH_YOUR_SENTRY_ORG_SLUG" && -n "$SENTRY_ORG" ]]; then
        ORG_LIST=$(SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" sentry-cli organizations list 2>&1 || true)
        if printf '%s\n' "$ORG_LIST" | grep -q "$SENTRY_ORG"; then
          pass "Sentry org '$SENTRY_ORG' verified in account"
        else
          warn "Sentry org '$SENTRY_ORG' not found — check slug"
        fi
      fi
    fi
  else
    skip "Sentry CLI auth skipped — to enable locally:"
    detail "export SENTRY_AUTH_TOKEN=...  (token lives in EAS; for local check, export it)"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# 9. FINAL RESULT
# ═════════════════════════════════════════════════════════════════════════════
printf "\n"
line
printf "\n"

if [[ "$BLOCKERS" -eq 0 ]]; then
  printf "  ${BOLD}${G}✓  SAFE FOR PRODUCTION BUILD${NC}\n"
  printf "  TypeScript clean · All required checks passed\n\n"
  printf "  ${BOLD}Run:${NC}\n"
  printf "  eas build --platform ios --profile production\n"
  EXIT_CODE=0
else
  printf "  ${BOLD}${R}✗  NOT SAFE FOR PRODUCTION BUILD${NC}\n"
  printf "  ${R}%d blocker(s)${NC} must be resolved.\n" "$BLOCKERS"
  EXIT_CODE=1
fi

printf "\n"
[[ "$WARNINGS" -gt 0 ]] && printf "  ${Y}%d warning(s)${NC} — review output above\n" "$WARNINGS"
[[ "$SKIPPED"  -gt 0 ]] && printf "  ${B}%d check(s) skipped${NC} — set optional env vars to enable\n" "$SKIPPED"
printf "\n"
line
printf "\n"

exit $EXIT_CODE
