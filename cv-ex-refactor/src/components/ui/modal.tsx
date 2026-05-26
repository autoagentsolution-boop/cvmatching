'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { MdClose } from 'react-icons/md';
import { cn } from '@/lib/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  dismissOnBackdrop?: boolean;
  children: ReactNode;
  className?: string;
}

export interface ModalTriggerProps {
  children: ReactNode;
}

export interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  dismissOnBackdrop = true,
  children,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          onClick={dismissOnBackdrop ? onClose : undefined}
          className="fixed inset-0 z-40 bg-inverse-surface/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          onInteractOutside={(e) => !dismissOnBackdrop && e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'bg-surface-container-lowest rounded-xl shadow-soft-lg p-8',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'focus:outline-none',
            sizeClasses[size],
            className,
          )}
        >
          {title && (
            <Dialog.Title className="mb-4 font-display text-headline-md text-on-surface">
              {title}
            </Dialog.Title>
          )}
          {children}
          <Dialog.Close asChild>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40"
            >
              <MdClose size={20} aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalTrigger({ children }: ModalTriggerProps) {
  return <Dialog.Trigger asChild>{children}</Dialog.Trigger>;
}

export function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-col gap-1', className)}>{children}</div>
  );
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-3', className)}>{children}</div>
  );
}

export function ModalTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Dialog.Title className={cn('font-display text-headline-md text-on-surface', className)}>
      {children}
    </Dialog.Title>
  );
}

export function ModalDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Dialog.Description className={cn('text-body-md text-on-surface-variant', className)}>
      {children}
    </Dialog.Description>
  );
}

export function ModalClose({ children }: { children: ReactNode }) {
  return <Dialog.Close asChild>{children}</Dialog.Close>;
}
