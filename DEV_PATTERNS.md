# Development Patterns & Templates

## Quick Reference for Common Tasks

### Adding a New API Endpoint

```typescript
// lib/api-direct.ts
export async function getNewDataDirect(filters?: any): Promise<NewDataType[]> {
    try {
        console.log(`[${new Date().toISOString()}] getNewDataDirect: Starting...`)
        
        // Use PostgREST syntax for joins and filtering
        const url = `${supabaseUrl}/rest/v1/new_table?select=*,profiles!user_id(username)&order=created_at.desc`
        
        const response = await fetch(url, { headers })
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        return data || []
    } catch (error) {
        console.error("Error in getNewDataDirect:", error)
        throw error
    }
}
```

### Creating a Custom Hook

```typescript
// hooks/use-new-feature.ts
import { useState, useCallback } from "react"
import { getNewDataDirect } from "@/lib/api-direct"
import type { NewDataType } from "@/lib/types"

export function useNewFeature() {
    const [data, setData] = useState<NewDataType[]>([])
    const [loading, setLoading] = useState(false)
    
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getNewDataDirect()
            setData(result)
        } catch (error) {
            console.error("Error loading data:", error)
            setData([])
        } finally {
            setLoading(false)
        }
    }, []) // Always specify dependencies
    
    return {
        data,
        loading,
        loadData,
        // Include any other functions needed
    }
}
```

### Adding a New React Component

```typescript
// components/new-component.tsx
import { useEffect } from "react"
import { useNewFeature } from "@/hooks/use-new-feature"

interface NewComponentProps {
    filters?: any
    onDataChange?: (data: any[]) => void
}

export function NewComponent({ filters, onDataChange }: NewComponentProps) {
    const { data, loading, loadData } = useNewFeature()
    
    useEffect(() => {
        loadData()
    }, [loadData])
    
    useEffect(() => {
        if (onDataChange) {
            onDataChange(data)
        }
    }, [data, onDataChange])
    
    if (loading) {
        return <div>Loading...</div>
    }
    
    return (
        <div>
            {data.map(item => (
                <div key={item.id}>
                    {/* Render item */}
                </div>
            ))}
        </div>
    )
}
```

### Database Query Patterns

```sql
-- For bulk operations, use IN clause
SELECT * FROM posts WHERE id IN ('id1', 'id2', 'id3');

-- For joins, use PostgREST syntax
-- URL: /posts?select=*,profiles!user_id(username,avatar_url)

-- For filtering and ordering
-- URL: /posts?user_id=eq.123&order=created_at.desc&limit=10
```

### Error Handling Pattern

```typescript
export async function apiFunction(): Promise<DataType[]> {
    try {
        // API call
        const response = await fetch(url, options)
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        return data || []
    } catch (error) {
        console.error("Error in apiFunction:", error)
        // Log details for debugging
        console.error("Request details:", { url, options })
        throw error // Re-throw to let caller handle
    }
}
```

### Bulk Operations Pattern

```typescript
// Instead of individual calls
export async function getBulkDataDirect(ids: string[]): Promise<DataType[]> {
    if (ids.length === 0) return []
    
    // Create comma-separated list for IN query
    const idsParam = ids.join(',')
    const url = `${supabaseUrl}/rest/v1/table?id=in.(${idsParam})&select=*,related_table(*)`
    
    const response = await fetch(url, { headers })
    const data = await response.json()
    return data || []
}
```

### React Hook Dependencies

```typescript
// ✅ CORRECT - Stable dependencies
const loadData = useCallback(async (filters: FilterType) => {
    // API call
}, []) // Empty if no dependencies

const processData = useCallback((data: DataType[]) => {
    // Processing logic
}, [someStableDependency])

// ✅ CORRECT - Effect with proper dependencies  
useEffect(() => {
    loadData()
}, [loadData])

// ❌ WRONG - Missing dependencies
useEffect(() => {
    someFunction() // This should be in the dependency array
}, [])
```

### Authentication Check Pattern

```typescript
// In components that require auth
const { user, loading } = useSimpleAuth()

if (loading) return <div>Loading...</div>
if (!user) return <div>Please log in</div>

// Continue with authenticated logic
```

### Type Safety Pattern

```typescript
// lib/types.ts - Always define proper types
export interface NewDataType {
    id: string
    user_id: string
    content: string
    created_at: string
    // Include all database fields
    profiles?: {
        username: string
        avatar_url?: string
    }
}

// Use the types consistently
export async function getData(): Promise<NewDataType[]> {
    // Implementation
}
```

## Testing Checklist

Before committing new code:

- [ ] No TypeScript errors
- [ ] No console warnings about multiple clients
- [ ] API calls are properly batched
- [ ] Loading states work correctly
- [ ] Error handling is implemented
- [ ] Component doesn't cause infinite loops
- [ ] Authentication is properly checked
- [ ] Types are defined and used correctly

## Common PostgREST Query Examples

```typescript
// Basic select with join
`/posts?select=*,profiles!user_id(username)`

// Filtering
`/posts?user_id=eq.${userId}&type=eq.startup`

// Ordering and limiting
`/posts?order=created_at.desc&limit=10`

// Multiple filters
`/posts?user_id=eq.${userId}&created_at=gte.${date}`

// Bulk select with IN
`/posts?id=in.(${ids.join(',')})`

// Complex select with nested relations
`/posts?select=*,profiles!user_id(*),startups!startup_id(*)`
```

## File Organization

- `lib/api-direct.ts` - All direct API functions
- `hooks/use-*.ts` - Custom React hooks
- `components/*.tsx` - React components
- `lib/types.ts` - TypeScript type definitions
- `app/*/page.tsx` - Next.js pages
- `ARCHITECTURE.md` - This documentation
- `TROUBLESHOOTING.md` - Common issues and fixes
