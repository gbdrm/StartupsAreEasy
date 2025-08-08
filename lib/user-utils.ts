// Shared user display name utility for both server and client
export function getUserDisplayName(profile: { first_name?: string | null; last_name?: string | null; username?: string | null }): string {
    const firstName = profile.first_name?.trim();
    const lastName = profile.last_name?.trim();
    const username = profile.username?.trim();
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    if (username) return username;
    return 'User';
}
