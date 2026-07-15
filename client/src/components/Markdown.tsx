import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Mappt inhaltsadressierte Medien-Referenzen `media/<hash>.<ext>` auf den lokalen
 * Endpunkt und erlaubt weiterhin eingebettete data-URIs (Altbestand). Andere
 * data-Typen (z.B. text/html) bleiben verworfen.
 */
function urlTransform(url: string): string {
  if (/^media\/[a-f0-9]{64}\.[a-z0-9]+$/i.test(url)) return `/api/${url}`;
  if (/^data:(image|audio)\/[\w.+-]+;base64,/i.test(url)) return url;
  return defaultUrlTransform(url);
}

const AUDIO_RE = /\.(mp3|m4a|aac|ogg|wav|weba|opus)$/i;
function isAudio(src?: string): boolean {
  if (!src) return false;
  return AUDIO_RE.test(src) || /^data:audio\//i.test(src);
}

/** Verhindert, dass ein Klick auf Link/Bild/Audio/Code die Lernkarte umdreht. */
function stopFlip(e: React.MouseEvent): void {
  e.stopPropagation();
}

interface Props {
  children: string;
  className?: string;
  /** Zusätzliche/überschreibende Renderer, z.B. für interaktive Cloze-Lücken. */
  components?: Components;
}

/**
 * Rendert Karteninhalte. Rohes HTML ist bewusst nicht aktiviert (kein rehype-raw),
 * daher gibt es hier weder dangerouslySetInnerHTML noch einen Sanitizer-Bedarf.
 */
export default function Markdown({ children, className, components }: Props) {
  return (
    <div className={`markdown${className ? ` ${className}` : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" onClick={stopFlip} />
          ),
          img: ({ node: _node, ...props }) =>
            // Eine Medien-Referenz mit Audio-Endung wird als Player statt Bild gerendert.
            isAudio(props.src) ? (
              <audio controls src={props.src} onClick={stopFlip} className="md-audio" />
            ) : (
              <img {...props} loading="lazy" onClick={stopFlip} />
            ),
          pre: ({ node: _node, ...props }) => <pre {...props} onClick={stopFlip} />,
          ...components,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
