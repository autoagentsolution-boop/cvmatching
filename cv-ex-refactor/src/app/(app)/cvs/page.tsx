import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { listUserCvs } from '@/lib/cvs/repo';
import { CvsLibraryClient } from './cvs-library-client';

export const metadata: Metadata = { title: 'My CVs — Resume Refactor' };

export default async function CvsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  const cvs = await listUserCvs(session.user.id);

  return (
    <div className="mx-auto w-full max-w-[1040px] py-8 px-4 md:px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-sm font-bold text-on-surface">My CVs</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Manage your CV library. Set a default, rename, or upload new versions.
          </p>
        </div>
      </div>

      <CvsLibraryClient initialCvs={cvs} />
    </div>
  );
}
