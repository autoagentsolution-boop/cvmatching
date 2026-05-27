'use client';

import { useState } from 'react';
import { MdSettings } from 'react-icons/md';
import { Button, Drawer } from '@/components/ui';
import { SettingsPanelBlock } from './settings-panel-block';

export interface SettingsDrawerTriggerProps {
  isAuthed?: boolean;
}

export function SettingsDrawerTrigger({ isAuthed = false }: SettingsDrawerTriggerProps) {
  // Lazy initializer — runs once on client mount. Avoids useSearchParams which would
  // force a Suspense boundary in every (app) route and break static generation.
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'byok';
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Open settings"
        onClick={() => setOpen(true)}
      >
        <MdSettings size={20} aria-hidden="true" />
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title="LLM Settings"
      >
        <SettingsPanelBlock isAuthed={isAuthed} />
      </Drawer>
    </>
  );
}
