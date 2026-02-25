import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, UserPlus, User } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';

function getInitials(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

export function UserMenu() {
    const { user, isGuest, logout } = useAuth();
    const navigate = useNavigate();

    if (!user) return null;

    const displayName = user.display_name || user.username;
    const initials = getInitials(displayName);

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-neutral-900/60 px-2.5 py-1.5 backdrop-blur-xl transition-all duration-200 hover:border-violet-500/30 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    aria-label="User menu"
                >
                    <Avatar.Root className="relative flex h-7 w-7 shrink-0 overflow-hidden rounded-full">
                        {user.avatar_url ? (
                            <Avatar.Image
                                src={user.avatar_url}
                                alt={displayName}
                                className="h-full w-full object-cover"
                            />
                        ) : null}
                        <Avatar.Fallback
                            className="flex h-full w-full items-center justify-center rounded-full bg-violet-500/20 text-xs font-medium text-violet-300"
                            delayMs={user.avatar_url ? 600 : 0}
                        >
                            {initials}
                        </Avatar.Fallback>
                    </Avatar.Root>

                    <div className="hidden items-center gap-1.5 sm:flex">
                        <span className="max-w-[120px] truncate text-sm font-medium text-neutral-200">
                            {isGuest ? 'Guest' : displayName}
                        </span>
                        {isGuest && (
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                                Guest
                            </span>
                        )}
                    </div>
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-[100] min-w-[200px] rounded-lg border border-white/[0.08] bg-neutral-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
                    sideOffset={8}
                    align="end"
                >
                    {/* User info header */}
                    <div className="mb-1 px-2.5 py-2">
                        <p className="text-sm font-medium text-neutral-200">
                            {isGuest ? 'Guest Session' : displayName}
                        </p>
                        {user.email && (
                            <p className="mt-0.5 truncate text-xs text-neutral-500">{user.email}</p>
                        )}
                        {isGuest && (
                            <p className="mt-1 text-xs text-neutral-500">
                                Register to save your work permanently.
                            </p>
                        )}
                    </div>

                    <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />

                    {isGuest ? (
                        <>
                            <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-neutral-300 outline-none transition-colors hover:bg-white/[0.06] hover:text-neutral-100 focus:bg-white/[0.06]"
                                onSelect={() => navigate('/login')}
                            >
                                <LogIn className="h-4 w-4 text-violet-400" />
                                Sign in
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-neutral-300 outline-none transition-colors hover:bg-white/[0.06] hover:text-neutral-100 focus:bg-white/[0.06]"
                                onSelect={() => navigate('/register')}
                            >
                                <UserPlus className="h-4 w-4 text-violet-400" />
                                Create account
                            </DropdownMenu.Item>
                        </>
                    ) : (
                        <>
                            <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-neutral-300 outline-none transition-colors hover:bg-white/[0.06] hover:text-neutral-100 focus:bg-white/[0.06]"
                                disabled
                            >
                                <User className="h-4 w-4 text-neutral-500" />
                                <span className="text-neutral-500">{user.username}</span>
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="my-1 h-px bg-white/[0.06]" />
                            <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-red-400 outline-none transition-colors hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10"
                                onSelect={logout}
                            >
                                <LogOut className="h-4 w-4" />
                                Sign out
                            </DropdownMenu.Item>
                        </>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
