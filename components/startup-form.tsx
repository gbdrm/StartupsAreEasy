"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { Loader2 } from "lucide-react"
import { STARTUP_STAGES, type StartupStage, type User } from "@/lib/types"

interface StartupFormData {
  name: string
  description: string
  website_url: string
  industry: string
  stage: StartupStage
  logo_url: string
  location: string
  founded_date: string
}

interface StartupFormProps {
  user: User | null
  onSubmit: (data: StartupFormData) => Promise<boolean>  // Return boolean to indicate success
  isSubmitting: boolean
  onLoginRequired: () => void
}

const initialFormData: StartupFormData = {
  name: "",
  description: "",
  website_url: "",
  industry: "",
  stage: "idea",
  logo_url: "",
  location: "",
  founded_date: ""
}

export function StartupForm({ user, onSubmit, isSubmitting, onLoginRequired }: StartupFormProps) {
  const [formData, setFormData] = useState<StartupFormData>(initialFormData)
  const [tags, setTags] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      onLoginRequired()
      return
    }

    if (!formData.name.trim() || !formData.description.trim()) return

    // Join tags with commas for submission
    const submissionData = {
      ...formData,
      industry: tags.join(', ')
    }

    const success = await onSubmit(submissionData)
    if (success) {
      // Only reset form on successful submission
      setFormData(initialFormData)
      setTags([])
    }
  }

  const handleTagInput = (value: string) => {
    if (value.includes(',')) {
      const newTags = value.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .filter(tag => !tags.includes(tag))
      
      setTags(prev => [...prev, ...newTags])
      setFormData(prev => ({ ...prev, industry: '' }))
    } else {
      setFormData(prev => ({ ...prev, industry: value }))
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Section: Name and Description (Required) */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Startup Name *</Label>
              <Input
                id="name"
                placeholder="Enter startup name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Choose a unique name for your startup
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe your startup, what problem it solves, and your vision..."
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                required
              />
            </div>
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://..."
              value={formData.website_url}
              onChange={e => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
            />
          </div>

          {/* Two Column Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="logo">Picture URL (optional)</Label>
              <Input
                id="logo"
                type="url"
                placeholder="https://..."
                value={formData.logo_url}
                onChange={e => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
              />
            </div>
          </div>

          {/* Industry / Tags */}
          <div className="space-y-2">
            <Label htmlFor="industry">Industry / Tags</Label>
            <Input
              id="industry"
              placeholder="e.g., FinTech, HealthTech, SaaS (separate with commas)"
              value={formData.industry}
              onChange={e => handleTagInput(e.target.value)}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:bg-red-100 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Two Column Section: Location and Founded Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Input
                id="location"
                placeholder="e.g., San Francisco, CA"
                value={formData.location}
                onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="founded_date">Founded Date (optional)</Label>
              <Input
                id="founded_date"
                type="date"
                value={formData.founded_date}
                onChange={e => setFormData(prev => ({ ...prev, founded_date: e.target.value }))}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || !formData.name.trim() || !formData.description.trim() || !user}
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
