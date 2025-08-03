"use client"

import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, MessageCircle, Github } from "lucide-react"
import { useSimpleAuth } from "@/hooks/use-simple-auth"

export default function AboutPage() {
  const { user, login, logout } = useSimpleAuth()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              🧠 About StartupsAreEasy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-sm max-w-none">
              <p className="text-lg text-muted-foreground">
                StartupsAreEasy is a home for people who love starting things — even when they're messy, weird, or half-baked.
                Here, we celebrate the spark, not just the launch.
              </p>
              
              <p>
                We believe that building doesn't have to be hard, lonely, or overplanned.
                Sometimes the best ideas begin with a quick note, a conversation, or a weekend experiment.
                That's what this space is for.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                🚀 What you can do here
              </h2>
              <div className="space-y-2 ml-4">
                <p>💡 Share ideas — even if you don't know what to do with them yet</p>
                <p>🚀 Start projects — and mark the moment you begin</p>
                <p>✅ Track progress — every step counts</p>
                <p>🙋 Ask questions — and learn out loud</p>
                <p>📢 Share things — tools, links, lessons, anything that helps</p>
              </div>
              <p className="mt-4">
                You can like, comment, and support others who are figuring it out too.
                It's not about being perfect. It's about moving forward.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                🤝 Why we exist
              </h2>
              <div className="space-y-2">
                <p>Because too many people wait until it's "ready."</p>
                <p>Because too many cool things never see the light.</p>
                <p>Because starting should feel fun, social, and easy — not like a pitch deck.</p>
              </div>
              <p className="mt-4 font-medium">
                StartupsAreEasy is here to make creativity visible, momentum natural, and failure a normal part of the ride.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                💬 Join the community
              </h2>
              <p>
                Want feedback on an idea? Want to see what others are building?
                Join our Telegram group — it's where a lot of the energy lives.
              </p>
              <p>
                This project is open source! Check out the code, contribute features, or report bugs on GitHub.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button asChild>
                  <a 
                    href="https://t.me/startupsareeasy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Join Telegram Group
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                
                <Button variant="outline" asChild>
                  <a 
                    href="https://github.com/gbdrm/StartupsAreEasy/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Github className="h-4 w-4" />
                    View on GitHub
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="border-t pt-6 mt-8">
              <p className="text-center text-muted-foreground italic">
                We're building this together — post by post, feature by feature, startup by startup.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
