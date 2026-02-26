/**
 * Utility to render text that may contain **bold** markdown markers.
 * Use this anywhere AI-generated or markdown-style text is displayed outside
 * of a full Markdown renderer.
 *
 * Usage: <BoldText text={someString} />
 *   or:  parseBold(someString)  → ReactNode
 */
import { Fragment } from "react";

/** Parse **bold** markers and return React nodes */
export function parseBold(text: string) {
  if (!text) return text;
  // First unescape backslash-escaped asterisks
  const unescaped = text.replace(/\\\*/g, '*');
  const parts = unescaped.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return unescaped;
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ fontWeight: 700 }}>{part}</strong>
      : <Fragment key={i}>{part}</Fragment>
  );
}

/** Component wrapper */
export const BoldText = ({ text }: { text: string }) => {
  return <>{parseBold(text)}</>;
};
