'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { MdClose } from 'react-icons/md';
import { cn } from '@/lib/cn';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'right' | 'bottom';
  title?: string;
  children: ReactNode;
  className?: string;
}

export interface DrawerHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface DrawerFooterProps {
  children: ReactNode;
  className?: string;
}

const sideClasses: Record<NonNullable<DrawerProps['side']>, string> = {
  right: [
    'fixed right-0 top-0 bottom-0 z-50 h-full w-full max-w-sm',
    'border-l border-outline-variant',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
  ].join(' '),
  bottom: [
    'fixed bottom-0 left-0 right-0 z-50 w-full max-h-[90vh]',
    'rounded-t-2xl border-t border-outline-variant',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
  ].join(' '),
};

export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  className,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-inverse-surface/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'bg-surface-container-lowest shadow-soft-lg overflow-y-auto',
            'duration-300 focus:outline-none',
            sideClasses[side],
            className,
          )}
        >
          <div className="flex items-center justify-between border-b border-outline-variant p-6">
            {title && (
              <Dialog.Title className="font-display text-headline-md text-on-surface">
                {title}
              </Dialog.Title>
            )}
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-auto rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40"
              >
                <MdClose size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DrawerTrigger({ children }: { children: ReactNode }) {
  return <Dialog.Trigger asChild>{children}</Dialog.Trigger>;
}

export function DrawerHeader({ children, className }: DrawerHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-col gap-1', className)}>{children}</div>
  );
}

export function DrawerTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Dialog.Title className={cn('font-display text-headline-md text-on-surface', className)}>
      {children}
    </Dialog.Title>
  );
}

export function DrawerFooter({ children, className }: DrawerFooterProps) {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-3 border-t border-outline-variant pt-4', className)}>
      {children}
    </div>
  );
}

export function DrawerClose({ children }: { children: ReactNode }) {
  return <Dialog.Close asChild>{children}</Dialog.Close>;
}
