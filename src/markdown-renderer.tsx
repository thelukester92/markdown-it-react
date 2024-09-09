import Token from 'markdown-it/lib/token';
import { ElementType, Fragment, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImbalancedTagsError, UnknownTokenTypeError } from './errors';
import { cssStringToReactStyle } from './utils';

export interface RendererOpts {
  /**
   * Rules for rendering a tag popped off the stack a self-closing tag.
   * The keys are equal to `token.tag`.
   * For example, to replace `<a>` tags with `<Link>`:
   * ```
   * {
   *   a: (_, attrs, children) => <Link to={attrs.href}>{children}</Link>,
   * }
   * ```
   */
  renderRules?: Record<string, RenderRule | undefined>;

  /**
   * Rules for handling a token, if more fine-grained control is needed.
   * This is closer to the original markdown-it rules, but in most cases, `renderRules` is easier to use.
   * For example, to replace `<a>` tags with `<Link>`:
   * ```
   * {
   *   link_open: (tokens, idx, env) => env.pushTag(Link, tokens[idx].attrs),
   *   link_close: (tokens, idx, env) => {
   *     const { attrs, children } = env.popTag();
   *     env.pushRendered(<Link to={attrs.href}>{children}</Link>);
   *   },
   * }
   * ```
   */
  tokenHandlerRules?: Record<string, TokenHandlerRule | undefined>;

  /**
   * Rules for resolving tags by token type, instead of using `token.tag`.
   * Open and close tags must both resolve to the same tag.
   * For example, to replace `<a>` tags with `<Link>`:
   * ```
   * {
   *   link_open: Link,
   *   link_close: Link,
   * }
   * ```
   */
  tags?: Record<string, ElementType | undefined>;
}

/**
 * Markdown-It Renderer that returns a ReactNode intead of an HTML string.
 * Rather than rendering opening and closing tokens separately, rendering uses a stack to buffer children for a tag and
 * renders when the closing token is reached (or all at once, for self-closing tokens).
 */
export class Renderer {
  /**
   * Whether to map to react-friendly keys/values in token attrs.
   * Specifically, this maps the key `class` to `className` and replaces
   * the `style` value with a record instead of a string value.
   */
  remapAttrsForReact = true;

  /**
   * Rules for rendering a tag popped off the stack a self-closing tag.
   * The keys are equal to `token.tag`.
   * For example, to replace `<a>` tags with `<Link>`:
   * ```
   * {
   *   a: (attrs, children) => <Link to={attrs.href}>{children}</Link>,
   * }
   * ```
   */
  renderRules: Record<string, RenderRule | undefined>;

  /**
   * Rules for handling a token, if more fine-grained control is needed.
   * This is closer to the original markdown-it rules, but in most cases, `renderRules` is easier to use.
   * For example, to replace `<a>` tags with `<Link>`:
   * ```
   * {
   *   link_open: (tokens, idx, env) => env.pushTag(Link, tokens[idx].attrs),
   *   link_close: (tokens, idx, env) => {
   *     const { attrs, children } = env.popTag();
   *     env.pushRendered(<Link to={attrs.href}>{children}</Link>);
   *   },
   * }
   * ```
   */
  tokenHandlerRules: Record<string, TokenHandlerRule | undefined>;

  /**
   * Rules for resolving tags by token type, instead of using `token.tag`.
   * Open and close tags must both resolve to the same tag.
   * For example, to replace `<a>` tags with `<Link>`:
   * ```
   * {
   *   paragraph_open: Link,
   *   paragraph_close: Link,
   * }
   * ```
   */
  tags: Record<string, ElementType | undefined>;

  /** An available rule that stores token markup in generated HTML as a `data-markup` attribute. */
  preserveMarkupRule: TokenHandlerRule = (tokens, idx, env) => {
    tokens[idx].attrs ??= [];
    tokens[idx].attrs!.push(['data-markup', tokens[idx].markup]);
    return this.handleToken(tokens, idx, env);
  };

  constructor(opts?: RendererOpts) {
    this.renderRules = { ...defaultRenderRules(this), ...opts?.renderRules };
    this.tokenHandlerRules = { ...defaultTokenHandlerRules(this), ...opts?.tokenHandlerRules };
    this.tags = { ...defaultTags(this), ...opts?.tags };
  }

  /** Determine the element type based on `tags`, falling back to `token.tag`. */
  resolveElementType(token: Token): ElementType {
    return this.tags[token.type] ?? (token.tag as ElementType);
  }

  /** Render token attributes to a React-friendly record. */
  renderAttrs(token: Token): Record<string, any> | undefined {
    return token.attrs?.reduce((acc, attr) => {
      let [key, value]: [string, any] = attr;
      if (this.remapAttrsForReact) {
        if (key === 'class') {
          key = 'className';
        }
        if (key === 'style') {
          value = cssStringToReactStyle(value);
        }
      }
      acc[key] = value;
      return acc;
    }, {} as Record<string, any>);
  }

  /** Default renderer, for popped stack entries or self-closing tags, if there is no special rule for it. */
  renderToken(Tag: ElementType, attrs: RendererEnvStackEntry['attrs'], children: ReactNode[]): ReactNode {
    return children.length ? <Tag {...attrs}>{children}</Tag> : <Tag {...attrs} />;
  }

  /**
   * The default token handler, which manages the internal stack.
   * Uses the default `renderToken` if there is no special rule based on the token type.
   */
  handleToken(tokens: Token[], idx: number, env: RendererEnv): ReactNode {
    const token = tokens[idx];
    const Tag = this.resolveElementType(token);
    if (!Tag) {
      throw new UnknownTokenTypeError(token);
    } else if (token.nesting === 1) {
      const attrs = this.renderAttrs(token);
      return env.pushTag(Tag, attrs);
    }

    let attrs: Record<string, any> | undefined;
    let children: ReactNode[];
    if (token.nesting === -1) {
      // popped tag
      ({ attrs, children } = env.popTag(Tag));
    } else {
      // self-closing tag
      attrs = this.renderAttrs(token);
      children = token.content ? [token.content] : [];
    }
    children = this.wrapChildren(children);

    const rule = this.renderRules[token.tag];
    const node = rule ? rule(Tag, attrs, children) : this.renderToken(Tag, attrs, children);
    return env.pushRendered(node);
  }

  /** Render inline tokens. */
  renderInline(tokens: Token[], env: RendererEnv): ReactNode {
    const children = tokens.map((token, i) => {
      const rule = this.tokenHandlerRules[token.type];
      return rule ? rule(tokens, i, env) : this.handleToken(tokens, i, env);
    });
    return this.wrapChildren(children);
  }

  /** Render block tokens. */
  render(tokens: Token[]): ReactNode {
    const env = new RendererEnv();
    const children = tokens.map((token, i) =>
      token.type === 'inline'
        ? this.renderInline(token.children ?? [], env)
        : this.tokenHandlerRules[token.type]?.(tokens, i, env) ?? this.handleToken(tokens, i, env),
    );
    return this.wrapChildren(children);
  }

  /** Render block tokens to raw html. */
  renderHTML(tokens: Token[]): string {
    return renderToStaticMarkup(<>{this.render(tokens)}</>);
  }

  /** Add keys (via Fragment) to children and filter null/empty children. */
  private wrapChildren(children: ReactNode[]): ReactNode[] {
    return children
      .filter(child => child !== null && (!Array.isArray(child) || child.length))
      .map((child, i) => <Fragment key={i}>{child}</Fragment>);
  }
}

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

/** For more fine-grained control over render rules, control at the token level. `RenderRule` is enough in most cases. */
export type TokenHandlerRule = (tokens: Token[], idx: number, env: RendererEnv) => ReactNode;

/** The render rule for a tag popped off the stack, or for a self-closing tag. */
export type RenderRule = (Tag: ElementType, attrs: Record<string, any> | undefined, children: ReactNode[]) => ReactNode;

/** Create a token handler rule that preserves markup in the rendered HTML. */
export const createPreserveMarkupRule =
  (renderer: Renderer): TokenHandlerRule =>
  (tokens, idx, env) => {
    tokens[idx].attrs ??= [];
    tokens[idx].attrs!.push(['data-markup', tokens[idx].markup]);
    return renderer.handleToken(tokens, idx, env);
  };

const defaultRenderRules: (renderer: Renderer) => typeof Renderer.prototype.renderRules = () => ({});

const defaultTokenHandlerRules: (renderer: Renderer) => typeof Renderer.prototype.tokenHandlerRules = renderer => ({
  softbreak: (tokens, idx, env) => {
    tokens[idx].attrs ??= [];
    tokens[idx].attrs!.push(['data-softbreak', 'true']);
    return renderer.handleToken(tokens, idx, env);
  },
  em_open: renderer.preserveMarkupRule,
  strong_open: renderer.preserveMarkupRule,
});

const defaultTags: (renderer: Renderer) => typeof Renderer.prototype.tags = () => ({
  text: Fragment,
});
