"use client"

import React from "react"
import { useRouter } from "next/navigation"
import type { Startup } from "@/lib/types"

interface StartupLinkTextProps {
  text: string
  startups: Startup[]
  className?: string
}

export function StartupLinkText({ text, startups, className = "" }: StartupLinkTextProps) {
  const router = useRouter()

  if (!startups.length) {
    return <span className={className}>{text}</span>
  }

  // Create a regex pattern to match startup names (case insensitive)
  const startupNames = startups.map(s => s.name).sort((a, b) => b.length - a.length) // Sort by length to match longer names first
  const pattern = new RegExp(`\\b(${startupNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')

  const parts = text.split(pattern)
  const result: React.ReactNode[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    
    if (!part) continue

    // Check if this part matches a startup name
    const matchedStartup = startups.find(s => 
      s.name.toLowerCase() === part.toLowerCase()
    )

    if (matchedStartup) {
      result.push(
        <button
          key={`startup-${i}`}
          className="text-primary hover:text-primary/80 hover:underline font-medium inline transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/startups/${matchedStartup.slug}`)
          }}
        >
          {part}
        </button>
      )
    } else {
      result.push(<span key={`text-${i}`}>{part}</span>)
    }
  }

  return <span className={className}>{result}</span>
}
