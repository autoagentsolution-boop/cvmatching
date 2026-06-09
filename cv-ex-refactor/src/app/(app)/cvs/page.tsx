import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/get-session';
import { listUserCvs } from '@/lib/cvs/repo';
import { PageHeader } from '@/components/ui';
import { CvsLibraryClient } from './cvs-library-client';

export const metadata: Metadata = { title: 'My CVs — Resume Refactor' };

export default async function CvsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect('/sign-in');

  const cvs = await listUserCvs(session.user.id);

  return (
    <>
      <PageHeader
        title="My CVs"
        subtitle="Manage your CV library. Set a default, rename, or upload new versions."
      />
      <CvsLibraryClient initialCvs={cvs} />
    </>
  );
}
