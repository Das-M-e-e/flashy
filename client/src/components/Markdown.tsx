import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Erlaubt zusätzlich eingebettete Bilder als data-URI. Die Voreinstellung von
 * react-markdown verwirft `data:` komplett -- eingebettete Bilder blieben sonst
 * unsichtbar. Andere data-Typen (z.B. text/html) bleiben verworfen.
 */
function urlTransform(url: string): string {
  if (/^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,/i.test(url)) return url;
  return defaultUrlTransform(url);
}

/** Verhindert, dass ein Klick auf Link/Bild/Code die Lernkarte umdreht. */
function stopFlip(e: React.MouseEvent): void {
  e.stopPropagation();
}

interface Props {
  children: string;
  className?: string;
}

/**
 * Rendert Karteninhalte. Rohes HTML ist bewusst nicht aktiviert (kein rehype-raw),
 * daher gibt es hier weder dangerouslySetInnerHTML noch einen Sanitizer-Bedarf.
 */
export default function Markdown({ children, className }: Props) {
  return (
    <div className={`markdown${className ? ` ${className}` : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" onClick={stopFlip} />
          ),
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" onClick={stopFlip} />,
          pre: ({ node: _node, ...props }) => <pre {...props} onClick={stopFlip} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
