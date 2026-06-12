'use client';

import Link from 'next/link';
import { MdLockOutline, MdArrowForward } from 'react-icons/md';
import { useT } from '@/lib/i18n/use-t';

export function ByokMissingCta() {
  const t = useT();
  return (
    <div className="rounded-2xl border border-outline-variant bg-error-container/30 p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <MdLockOutline className="mt-1 text-on-error-container" size={24} aria-hidden="true" />
        <div className="flex-1 space-y-3">
          <h3 className="text-title-md font-bold text-on-error-container">
            {t('interview.byok.title')}
          </h3>
          <p className="text-body-md text-on-surface leading-relaxed">
            {t('interview.byok.body')}
          </p>
          <Link
            href="/dashboard?mode=byok"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-bold text-on-primary shadow-soft transition-opacity hover:opacity-90"
          >
            {t('interview.byok.cta')}
            <MdArrowForward size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
