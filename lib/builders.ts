// Legacy builders functions - use api-direct.ts for new code
import { getBuildersDirect, getBuilderStatsDirect } from "./api-direct"

// Keep these for backward compatibility, but delegate to direct API
export const getBuilders = getBuildersDirect
export const getBuilderStats = getBuilderStatsDirect