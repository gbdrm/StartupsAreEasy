// Simple shared types for diagnostics (kept intentionally minimal)
// Status values used across diagnostics (keep superset of existing page usage)
export type StepStatus = 'idle' | 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface TestStep {
    id: string
    name: string
    description: string
    status: StepStatus
    result?: any
    error?: string
    logs?: any[]
    duration?: number
}

export interface DiagnosticTest {
    id: string
    name: string
    description: string
    status: StepStatus | 'partial'
    | 'completed' | 'failed'
    progress: number
    steps: TestStep[]
}
