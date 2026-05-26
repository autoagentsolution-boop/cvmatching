'use client';

import { useState } from 'react';
import { MdSettings } from 'react-icons/md';
import { Button, Drawer } from '@/components/ui';
import { SettingsPanelBlock } from './settings-panel-block';

export interface SettingsDrawerTriggerProps {
  /** When true the drawer mounts already open (e.g. ?mode=byok) */
  defaultOpen?: boolean;
  isAuthed?: boolean;
}

export function SettingsDrawerTrigger({
  defaultOpen = false,
  isAuthed = false,
}: SettingsDrawerTriggerProps) {
  const [open, setOpen] = useState(defaultOpen);

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
