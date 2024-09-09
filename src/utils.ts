import { CSSProperties } from 'react';

export const cssStringToReactStyle = (cssString: string): CSSProperties => {
  const style: CSSProperties = {};
  const matches = cssString.matchAll(cssPropertyRegExp);
  for (const match of matches) {
    const key = match[1].replace(/-(.)/, (_, p: string) => p.toUpperCase());
    style[key] = match[2];
  }
  return style;
};

const cssPropertyRegExp = /(?<=^|;)\s*([^:]+)\s*:\s*([^;]+)\s*/g;
