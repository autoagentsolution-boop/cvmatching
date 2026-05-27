'use client';

import type { Session } from 'next-auth';
import Image from 'next/image';
import { Button } from '@/components/ui';
import { signOutUser } from '@/features/auth/sign-in-server-actions';

interface UserMenuProps {
  user: Session['user'] | null;
}

export function UserMenu({ user }: UserMenuProps) {
  if (!user) {
    // Login UI hidden during pilot — OAuth not yet configured.
    // Restore when Google sign-in setup is complete.
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? 'User avatar'}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-label-sm font-bold text-on-primary">
            {(user.name ?? user.email ?? 'U').charAt(0).toUpperCase()}
          </div>
        )}
        <span className="hidden text-label-md text-on-surface md:block">
          {user.name ?? user.email}
        </span>
      </div>

      <form action={signOutUser}>
        <Button variant="ghost" size="sm" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
