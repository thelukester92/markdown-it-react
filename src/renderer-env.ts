import { ElementType, ReactNode } from 'react';
import { ImbalancedTagsError } from './errors';

/**
 * A helper class for managing the rendering stack.
 * When a tag is pushed, a new `children` buffer is started.
 * When a tag is popped, the top element is rendered.
 * If there is another `children` buffer, the rendered element is sent there.
 * If there is not, the rendered element is returned to the caller.
 */
export class RendererEnv {
  /** The current renderer stack (the last element corresponds with the parent element). */
  private stack: RendererEnvStackEntry[] = [];

  /** Pushes an open tag to the stack, creating a new `children` buffer. */
  pushTag(Tag: ElementType, attrs?: RendererEnvStackEntry['attrs']): null {
    this.stack.push({ Tag, attrs, children: [] });
    return null;
  }

  /** Pops the open tag from the stack for rendering. */
  popTag(Tag: ElementType): RendererEnvStackEntry {
    const top = this.stack.pop();
    if (!top || top.Tag !== Tag) {
      throw new ImbalancedTagsError(top?.Tag, Tag);
    }
    return top;
  }

  /** Push a rendered ReactNode into the current `children` buffer and return null, or return it if top-level. */
  pushRendered(node: ReactNode): ReactNode {
    if (this.stack.length) {
      this.stack[this.stack.length - 1].children.push(node);
      return null;
    }
    return node;
  }
}

export interface RendererEnvStackEntry {
  Tag: ElementType;
  attrs?: Record<string, any>;
  children: ReactNode[];
}
