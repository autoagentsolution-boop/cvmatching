'use client';

import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pills';
  children: ReactNode;
  className?: string;
}

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function Tabs({ tabs, activeId, onChange, variant = 'underline', children, className }: TabsProps) {
  return (
    <RadixTabs.Root value={activeId} onValueChange={onChange} className={cn('w-full', className)}>
      <RadixTabs.List
        className={cn(
          'flex',
          variant === 'underline'
            ? 'border-b border-outline-variant gap-1'
            : 'gap-1 rounded-xl bg-surface-container p-1',
        )}
        aria-label="tabs"
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={cn(
              'text-label-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40',
              variant === 'underline'
                ? [
                    'px-4 py-2.5 border-b-2 border-transparent -mb-px',
                    'text-on-surface-variant hover:text-on-surface',
                    'data-[state=active]:border-on-tertiary-container data-[state=active]:text-on-tertiary-container',
                  ]
                : [
                    'rounded-lg px-4 py-2',
                    'text-on-surface-variant hover:text-on-surface',
                    'data-[state=active]:bg-surface-container-lowest data-[state=active]:text-on-surface data-[state=active]:shadow-soft',
                  ],
              tab.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <RadixTabs.List className={cn('flex gap-1', className)}>
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({ value, disabled, children, className }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      value={value}
      disabled={disabled}
      className={cn(
        'px-4 py-2.5 text-label-md font-medium text-on-surface-variant transition-colors duration-150',
        'border-b-2 border-transparent -mb-px',
        'hover:text-on-surface',
        'data-[state=active]:border-on-tertiary-container data-[state=active]:text-on-tertiary-container',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-tertiary-container/40',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      {children}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  return (
    <RadixTabs.Content
      value={value}
      className={cn('mt-4 focus-visible:outline-none', className)}
    >
      {children}
    </RadixTabs.Content>
  );
}
