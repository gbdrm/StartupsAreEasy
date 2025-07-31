"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { STARTUP_STAGES, type StartupStage, type User } from "@/lib/types"

interface StartupFormData {
  name: string
  description: string
  website_url: string
  industry: string
  stage: StartupStage
  logo_url: string
}

interface StartupFormProps {
  user: User | null
  onSubmit: (data: StartupFormData) => Promise<void>
  isSubmitting: boolean
  onLoginRequired: () => void
}

const initialFormData: StartupFormData = {
  name: "",
  description: "",
  website_url: "",
  industry: "",
  stage: "idea",
  logo_url: ""
}

export function StartupForm({ user, onSubmit, isSubmitting, onLoginRequired }: StartupFormProps) {
  const [formData, setFormData] = useState<StartupFormData>(initialFormData)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      onLoginRequired()
      return
    }

    if (!formData.name.trim()) return

    await onSubmit(formData)
    setFormData(initialFormData)
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="name">Startup Name *</Label>
              <Input
                id="name"
                placeholder="Enter startup name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://..."
                value={formData.website_url}
                onChange={e => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="e.g., FinTech, HealthTech, SaaS"
                value={formData.industry}
                onChange={e => setFormData(prev => ({ ...prev, industry: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
              <Select 
                value={formData.stage} 
                onValueChange={(value: StartupStage) => setFormData(prev => ({ ...prev, stage: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STARTUP_STAGES).map(([key, stage]) => (
                    <SelectItem key={key} value={key}>
                      {stage.emoji} {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                type="url"
                placeholder="https://..."
                value={formData.logo_url}
                onChange={e => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
              />
            </div>
          </div>

          {/* Full width fields */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your startup, what problem it solves, and your vision..."
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || !formData.name.trim() || !user}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating Startup...
              </>
            ) : (
              "Create Startup"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
