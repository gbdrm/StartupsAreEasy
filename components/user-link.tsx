"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AVATAR_SIZES } from "@/lib/constants"
import type { User } from "@/lib/types"

interface UserLinkProps {
  user: User
  showAvatar?: boolean
  showName?: boolean
  showUsername?: boolean
  avatarSize?: keyof typeof AVATAR_SIZES
  className?: string
}

export function UserLink({ 
  user, 
  showAvatar = false, 
  showName = false, 
  showUsername = false,
  avatarSize = "md",
  className = ""
}: UserLinkProps) {

  if (showAvatar) {
    return (
      <Link href={`/profile/${user.username}`} className={className}>
        <Avatar className={`${AVATAR_SIZES[avatarSize]} cursor-pointer hover:opacity-80 transition-opacity`}>
          <AvatarImage src={user.avatar || undefined} alt={user.name} />
          <AvatarFallback name={user.name} userId={user.id} />
        </Avatar>
      </Link>
    )
  }

  return (
    <Link href={`/profile/${user.username}`} className={`hover:underline ${className}`}>
      {showName && <span className="font-semibold text-sm">{user.name}</span>}
      {showUsername && <span className="text-muted-foreground text-sm">@{user.username}</span>}
    </Link>
  )
}
