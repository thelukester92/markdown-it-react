import Token from 'markdown-it/lib/token';
import { ElementType, ReactNode } from 'react';
import { RendererEnv } from './renderer-env';

/** For more fine-grained control over render rules, control at the token level. `RenderRule` is enough in most cases. */
export type TokenHandlerRule = (tokens: Token[], idx: number, env: RendererEnv) => ReactNode;

/** The render rule for a tag popped off the stack, or for a self-closing tag. */
export type RenderRule = (Tag: ElementType, attrs: Record<string, any> | undefined, children: ReactNode[]) => ReactNode;
