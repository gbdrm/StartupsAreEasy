"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getBuilderStats } from "@/lib/builders"
import type { User } from "@/lib/types"
import { logger } from "@/lib/logger"

interface BuilderCardProps {
  builder: User
  onClick?: () => void
}

export function BuilderCard({ builder, onClick }: BuilderCardProps) {
  const [stats, setStats] = useState({ postsCount: 0, startupsCount: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const builderStats = await getBuilderStats(builder.id)
        setStats(builderStats)
      } catch (error) {
        logger.error("API", "Error loading builder stats", error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [builder.id])

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={builder.avatar} alt={builder.name} />
            <AvatarFallback username={builder.username} name={builder.name} userId={builder.id} />
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight">{builder.name}</h3>
            <p className="text-sm text-muted-foreground">@{builder.username}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Stats */}
        <div className="flex gap-4 mb-3">
          <div className="text-center">
            <div className="font-semibold">{loading ? "..." : stats.postsCount}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">{loading ? "..." : stats.startupsCount}</div>
            <div className="text-xs text-muted-foreground">Startups</div>
          </div>
        </div>

        {/* Placeholder for future features */}
        <div className="text-xs text-muted-foreground">
          Click to view profile
        </div>
      </CardContent>
    </Card>
  )
}
