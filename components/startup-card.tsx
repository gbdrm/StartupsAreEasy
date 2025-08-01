"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Calendar, MapPin, Users, DollarSign } from "lucide-react"
import { STARTUP_STAGES, type Startup } from "@/lib/types"

interface StartupCardProps {
  startup: Startup
  onClick: () => void
}

export function StartupCard({ startup, onClick }: StartupCardProps) {
  const stageInfo = STARTUP_STAGES[startup.stage || 'idea']

  return (
    <Card 
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] bg-card"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4 mb-4">
          {startup.logo_url && (
            <img 
              src={startup.logo_url} 
              alt={`${startup.name} logo`} 
              className="w-16 h-16 object-contain rounded-lg border"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xl font-semibold truncate">{startup.name}</h3>
              {startup.website_url && (
                <a
                  href={startup.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <Badge variant="secondary" className={`${stageInfo.color} text-xs mb-2`}>
              {stageInfo.emoji} {stageInfo.label}
            </Badge>
          </div>
        </div>

        {startup.description && (
          <p className="text-muted-foreground text-sm mb-4 overflow-hidden" style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {startup.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {startup.industry && (
            <>
              {startup.industry.includes(',') ? (
                // Show as separate tag badges if comma-separated
                startup.industry.split(',').map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag.trim()}
                  </Badge>
                ))
              ) : (
                // Show as single industry tag
                <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                  <span>{startup.industry}</span>
                </div>
              )}
            </>
          )}
          {startup.location && (
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
              <MapPin className="h-3 w-3" />
              <span>{startup.location}</span>
            </div>
          )}
          {startup.team_size && (
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
              <Users className="h-3 w-3" />
              <span>{startup.team_size}</span>
            </div>
          )}
          {startup.funding_raised && (
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
              <DollarSign className="h-3 w-3" />
              <span>${startup.funding_raised.toLocaleString()}</span>
            </div>
          )}
        </div>

        {startup.founded_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Calendar className="h-3 w-3" />
            <span>Founded {new Date(startup.founded_date).getFullYear()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
