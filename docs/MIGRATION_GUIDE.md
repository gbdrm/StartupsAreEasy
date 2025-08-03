# Safe Migration Scripts

## Logger Migration Template

For each file that needs logger migration:

1. **Backup**: `git add . && git commit -m "Backup before logger migration"`

2. **Import Addition**:
```typescript
// Add to imports
import { logger } from "./logger"
```

3. **Replace Patterns**:

```typescript
// BEFORE
console.log(`[${new Date().toISOString()}] functionName: Starting...`)

// AFTER  
logger.api('functionName', 'GET') // for API calls
logger.debug('functionName starting') // for debug info
logger.info('functionName completed') // for general info
```

```typescript
// BEFORE
console.error("Error message:", error)

// AFTER
logger.error("Error message", error)
```

## Auth Hook Migration Template

For each component using old auth:

1. **Import Change**:
```typescript
// BEFORE
import { useAuth } from "@/hooks/use-auth"

// AFTER
import { useSimpleAuth } from "@/hooks/use-simple-auth"
```

2. **Usage Change**:
```typescript
// BEFORE
const { user, login, logout } = useAuth()

// AFTER  
const { user, login, logout } = useSimpleAuth()
```

3. **Test**: Verify component still works correctly

## File-by-File Migration Checklist

### Components to Migrate
- [ ] `components/startup-client-wrapper.tsx`
- [ ] `components/post-client-wrapper.tsx`  
- [ ] `app/diagnostics/page.tsx`
- [ ] `app/about/page.tsx`

### API Files to Clean
- [ ] `lib/api-direct.ts` (remaining functions)
- [ ] `lib/startups.ts` (remaining functions)
- [ ] `lib/posts.ts` (if still used)

### Files to Remove (After Migration)
- [ ] `hooks/use-auth.ts` (after all components migrated)
- [ ] `hooks/use-data-loader.ts` (verify not used first)

## Verification Commands

```bash
# Check for compilation errors
pnpm type-check

# Check for remaining old patterns
grep -r "useAuth" components/
grep -r "console.log" lib/

# Check for unused imports
# (use IDE or linting tools)

# Test application
pnpm dev
```

## Recovery Commands

```bash
# If file gets corrupted during migration
git checkout -- path/to/corrupted/file.tsx

# If need to revert all changes
git reset --hard HEAD

# If need to see what files changed
git diff --name-only
```

## Safety Rules

1. **Never bulk replace** across multiple files
2. **Always commit** working state before next migration
3. **Test immediately** after each change
4. **One pattern at a time** (imports first, then usage)
5. **Use git liberally** for safety
