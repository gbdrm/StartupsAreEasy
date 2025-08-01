import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Calendar, MapPin, Users, DollarSign, Target, Clock } from "lucide-react"
import { STARTUP_STAGES, type Startup } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"

interface StartupDetailProps {
  startup: Startup
}

export function StartupDetail({ startup }: StartupDetailProps) {
  const stageInfo = STARTUP_STAGES[startup.stage || 'idea']

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`
    }
    return `$${amount}`
  }

  return (
    <div className="space-y-6">
      {/* Main Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-6">
            {startup.logo_url && (
              <img 
                src={startup.logo_url} 
                alt={`${startup.name} logo`} 
                className="w-24 h-24 object-contain rounded-lg border"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-3xl font-bold">{startup.name}</h1>
                {startup.website_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={startup.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit Website
                    </a>
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="secondary" className={`${stageInfo.color} text-sm`}>
                  {stageInfo.emoji} {stageInfo.label}
                </Badge>
                
                {startup.industry && (
                  <Badge variant="outline">
                    {startup.industry}
                  </Badge>
                )}
              </div>

              {startup.description && (
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {startup.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {startup.founded_date && (
              <div>
                <p className="text-sm text-muted-foreground">Founded</p>
                <p className="font-medium">
                  {new Date(startup.founded_date).toLocaleDateString()}
                </p>
              </div>
            )}
            
            {startup.launch_date && (
              <div>
                <p className="text-sm text-muted-foreground">Launched</p>
                <p className="font-medium">
                  {new Date(startup.launch_date).toLocaleDateString()}
                </p>
              </div>
            )}
            
            <div>
              <p className="text-sm text-muted-foreground">Listed</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(startup.created_at), { addSuffix: true })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Team & Funding */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team & Funding
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {startup.team_size && (
              <div>
                <p className="text-sm text-muted-foreground">Team Size</p>
                <p className="font-medium">{startup.team_size} people</p>
              </div>
            )}
            
            {startup.funding_raised && (
              <div>
                <p className="text-sm text-muted-foreground">Funding Raised</p>
                <p className="font-medium">{formatCurrency(startup.funding_raised)}</p>
              </div>
            )}
            
            {startup.location && (
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {startup.location}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market & Goals */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Market & Goals
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {startup.target_market && (
              <div>
                <p className="text-sm text-muted-foreground">Target Market</p>
                <p className="font-medium">{startup.target_market}</p>
              </div>
            )}
            
            {startup.estimated_timeline && (
              <div>
                <p className="text-sm text-muted-foreground">Timeline</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {startup.estimated_timeline}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Looking For Section */}
      {startup.looking_for && startup.looking_for.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Looking For</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {startup.looking_for.map((item, index) => (
                <Badge key={index} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
