"use client"

import Link from "next/link"
import { memo } from "react"
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

function UserLinkComponent({ 
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

// Memoize the UserLink component
export const UserLink = memo(UserLinkComponent, (prevProps, nextProps) => {
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.username === nextProps.user.username &&
    prevProps.user.avatar === nextProps.user.avatar &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.showName === nextProps.showName &&
    prevProps.showUsername === nextProps.showUsername &&
    prevProps.avatarSize === nextProps.avatarSize &&
    prevProps.className === nextProps.className
  )
})
