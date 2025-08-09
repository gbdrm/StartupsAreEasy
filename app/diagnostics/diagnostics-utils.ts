// Utility helpers for diagnostics page (kept small to avoid over-engineering)
import type { TestStep } from './diagnostics-types'

export const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

export function createStep(id: string, name: string, description: string): TestStep {
    return { id, name, description, status: 'idle' }
}

// Lightweight performance wrapper
export async function perf<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; ms: number; value: T }> {
    const start = performance.now()
    const value = await fn()
    return { label, ms: Math.round(performance.now() - start), value }
}
