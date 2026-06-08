'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo } from 'react';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { cn } from '@/lib/cn';

/**
 * Refined-CV editor — TipTap-based rich text editor that round-trips
 * markdown via marked (md→HTML) on load and turndown (HTML→md) on save.
 *
 * The store keeps `matchedCv` as markdown so downstream blocks (export,
 * MarkdownView) stay format-stable; the editor is purely a UI layer.
 */

export interface RefinedCvEditorProps {
  /** Source markdown to seed the editor on mount. */
  initialMarkdown: string;
  /** Called with serialized markdown on every change so the parent can
   *  enable Save / autosave at its own cadence. */
  onMarkdownChange: (md: string) => void;
  className?: string;
}

// Singleton — turndown's tokenizer setup is non-trivial.
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep editor focused
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-label-md font-medium transition-colors',
        active
          ? 'bg-primary text-on-primary'
          : 'text-on-surface-variant hover:bg-surface-container',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

export function RefinedCvEditor({
  initialMarkdown,
  onMarkdownChange,
  className,
}: RefinedCvEditorProps) {
  const initialHtml = useMemo(() => {
    try {
      // marked.parse returns string in sync mode unless options force async.
      return marked.parse(initialMarkdown, { async: false }) as string;
    } catch {
      return `<p>${initialMarkdown.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))}</p>`;
    }
  }, [initialMarkdown]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml,
    // SSR safety: TipTap requires DOM. RefinedCvView itself is 'use client'.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-neutral max-w-none min-h-[60vh] focus:outline-none',
          '[&_h1]:font-display [&_h1]:text-headline-md [&_h1]:font-bold',
          '[&_h2]:font-display [&_h2]:text-title-md [&_h2]:font-bold',
          '[&_h3]:font-display [&_h3]:text-title-sm [&_h3]:font-semibold',
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
          '[&_li]:my-0.5 [&_p]:my-2',
        ),
      },
    },
    onUpdate({ editor: ed }) {
      const html = ed.getHTML();
      const md = turndown.turndown(html);
      onMarkdownChange(md);
    },
  });

  // Push new initialMarkdown into the editor if the caller swaps it
  // (e.g. user re-Regenerates while still in Edit mode — unlikely but
  // handled defensively).
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (currentHtml === initialHtml) return;
    editor.commands.setContent(initialHtml);
  }, [editor, initialHtml]);

  if (!editor) {
    return (
      <div className="flex h-[60vh] items-center justify-center rounded-lg bg-surface-container-low text-body-sm text-on-surface-variant">
        Loading editor…
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-1.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-outline-variant" aria-hidden="true" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-outline-variant" aria-hidden="true" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          “”
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          {'<>'}
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-outline-variant" aria-hidden="true" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </ToolbarButton>
      </div>

      {/* Editor surface — Arial for full Vietnamese coverage + matches the
          read-view sheet. */}
      <div
        className="rounded-lg border border-outline-variant bg-white px-6 py-5 text-neutral-900 shadow-soft-lg"
        style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
