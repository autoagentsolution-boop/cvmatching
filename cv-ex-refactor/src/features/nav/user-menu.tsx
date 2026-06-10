'use client';

import type { Session } from 'next-auth';
import Image from 'next/image';
import { FcGoogle } from 'react-icons/fc';
import { Button } from '@/components/ui';
import { signOutUser, signInWithGoogle } from '@/features/auth/sign-in-server-actions';
import { useT } from '@/lib/i18n/use-t';

interface UserMenuProps {
  user: Session['user'] | null;
  loginEnabled?: boolean;
}

export function UserMenu({ user, loginEnabled = false }: UserMenuProps) {
  const t = useT();
  if (!user) {
    // Guest. Public login is gated by KV flag — when off, no UI entry exists
    // so the /sign-in URL cannot be reached except by admins. When on, render
    // a Google button that programmatically starts OAuth (skipping the
    // /sign-in landing page entirely).
    if (!loginEnabled) return null;
    return (
      <form action={signInWithGoogle}>
        <Button
          variant="secondary"
          size="sm"
          type="submit"
          leadingIcon={<FcGoogle aria-hidden="true" />}
        >
          {t('nav.signIn')}
        </Button>
      </form>
    );
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
          {t('nav.signOut')}
        </Button>
      </form>
    </div>
  );
}
