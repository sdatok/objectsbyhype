import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a product description as restricted Markdown.
 * Supports paragraphs, bold/italic, bullet/numbered lists, line breaks, and links.
 * No raw HTML or images so admin can't accidentally inject anything unsafe.
 */
export default function ProductDescription({ text }: { text: string }) {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return null;

  return (
    <div className="text-[13px] leading-relaxed text-neutral-600 space-y-3 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        allowedElements={[
          "p",
          "strong",
          "em",
          "del",
          "ul",
          "ol",
          "li",
          "br",
          "a",
          "code",
        ]}
        unwrapDisallowed
        components={{
          p: ({ children }) => (
            <p className="leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 marker:text-neutral-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 marker:text-neutral-400">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-800">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 hover:text-black transition-colors"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[12px] bg-neutral-100 rounded px-1.5 py-0.5">
              {children}
            </code>
          ),
        }}
      >
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
