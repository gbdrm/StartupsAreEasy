"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ExternalLink, Calendar, MapPin, Users, DollarSign } from "lucide-react"
import { STARTUP_STAGES, type Startup } from "@/lib/types"

interface StartupDetailDialogProps {
  startup: Startup | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StartupDetailDialog({ startup, open, onOpenChange }: StartupDetailDialogProps) {
  if (!startup) return null

  const stageInfo = STARTUP_STAGES[startup.stage || 'idea']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            {startup.logo_url && (
              <img 
                src={startup.logo_url} 
                alt={`${startup.name} logo`} 
                className="w-20 h-20 object-contain rounded-lg border"
              />
            )}
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold mb-2">{startup.name}</DialogTitle>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className={`${stageInfo.color}`}>
                  {stageInfo.emoji} {stageInfo.label}
                </Badge>
                {startup.website_url && (
                  <a
                    href={startup.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {startup.description && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-muted-foreground leading-relaxed">{startup.description}</p>
            </div>
          )}

          <Separator />

          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {startup.industry && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm">Industry</h4>
                <p className="text-muted-foreground">{startup.industry}</p>
              </div>
            )}

            {startup.location && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location
                </h4>
                <p className="text-muted-foreground">{startup.location}</p>
              </div>
            )}

            {startup.founded_date && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Founded
                </h4>
                <p className="text-muted-foreground">
                  {new Date(startup.founded_date).toLocaleDateString()}
                </p>
              </div>
            )}

            {startup.team_size && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Team Size
                </h4>
                <p className="text-muted-foreground">{startup.team_size} people</p>
              </div>
            )}

            {startup.funding_raised && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Funding Raised
                </h4>
                <p className="text-muted-foreground">${startup.funding_raised.toLocaleString()}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground">
            Created {new Date(startup.created_at).toLocaleDateString()}
            {startup.updated_at !== startup.created_at && (
              <span> • Updated {new Date(startup.updated_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
