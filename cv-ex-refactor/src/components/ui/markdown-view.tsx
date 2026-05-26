import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

export interface MarkdownViewProps {
  markdown: string;
  variant?: 'document' | 'compact';
  className?: string;
}

// react-markdown is XSS-safe by default. rehype-raw is intentionally NOT
// enabled to prevent embedded HTML execution.
export function MarkdownView({ markdown, variant = 'document', className }: MarkdownViewProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={cn('text-body-md text-on-surface', isCompact ? 'space-y-2' : 'space-y-4', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className={cn('font-display text-headline-lg text-on-surface tracking-tight', isCompact ? 'mt-3' : 'mt-6')}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn('font-display text-headline-md text-on-surface tracking-tight', isCompact ? 'mt-2' : 'mt-5')}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn('font-display text-body-lg font-semibold text-on-surface', isCompact ? 'mt-2' : 'mt-4')}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-body-md leading-relaxed text-on-surface">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-6 text-body-md text-on-surface">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-6 text-body-md text-on-surface">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-on-tertiary-container underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          code: ({ children, className: codeClass }) => {
            const isBlock = codeClass?.includes('language-');
            if (isBlock) {
              return (
                <pre className="overflow-x-auto rounded-lg bg-surface-container-low p-4">
                  <code className="font-mono text-label-md text-on-surface">{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-surface-container-low px-1.5 py-0.5 font-mono text-label-md text-on-surface">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-outline-variant pl-4 text-on-surface-variant italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full text-body-md">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-container-low text-on-surface-variant">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-label-md font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-outline-variant/40 px-4 py-2.5">{children}</td>
          ),
          hr: () => <hr className="border-outline-variant" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-on-surface">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
