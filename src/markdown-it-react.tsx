import Token from 'markdown-it/lib/token';
import { ElementType, Fragment, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export class Renderer {
    /** Rules for rendering tokens by token type, when the default isn't enough. */
    rules: Record<string, RenderRule | undefined> = defaultRules;

    /** Rules for resolving tags by token type, when the default isn't enough. */
    tags: Record<string, ElementType | undefined> = defaultTags;

    /** Determine the element type based on `tags`, falling back to `token.tag`. */
    resolveElementType(token: Token): ElementType {
        return this.tags[token.type] ?? (token.tag as ElementType);
    }

    /** Render token attributes to a record. */
    renderAttrs(token: Token): Record<string, any> | undefined {
        return token.attrs?.reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {} as Record<string, any>);
    }

    /** Default token renderer, if there is no special rule for it. */
    renderToken(tokens: Token[], idx: number, env: RendererEnv): ReactNode {
        const token = tokens[idx];
        const Tag = this.resolveElementType(token);
        if (!Tag) {
            throw new UnknownTokenTypeError(token);
        }

        const attrs = this.renderAttrs(token);
        if (token.nesting === 1) {
            return this.pushTag(Tag, attrs, env);
        } else if (token.nesting === -1) {
            return this.popAndRenderTag(Tag, attrs, env);
        } else {
            return this.renderSelfClosingTag(Tag, attrs, token.content, env);
        }
    }

    /** Render inline tokens. */
    renderInline(tokens: Token[], env: RendererEnv): ReactNode {
        return tokens.map((token, i) => {
            const rule = this.rules[token.type];
            const node = rule ? rule(tokens, i, env) : this.renderToken(tokens, i, env);
            return <Fragment key={i}>{node}</Fragment>;
        });
    }

    /** Render block tokens. */
    render(tokens: Token[]): ReactNode {
        const env: RendererEnv = { stack: [] };
        return tokens.map((token, i) => {
            const node =
                token.type === 'inline'
                    ? this.renderInline(token.children ?? [], env)
                    : this.rules[token.type]?.(tokens, i, env) ?? this.renderToken(tokens, i, env);
            return <Fragment key={i}>{node}</Fragment>;
        });
    }

    /** Render block tokens to raw html. */
    renderHTML(tokens: Token[]): string {
        return renderToStaticMarkup(<>{this.render(tokens)}</>);
    }

    /** Pushes an open tag to the stack, creating a new `children` buffer. */
    private pushTag(Tag: ElementType, attrs: RendererStackEntry['attrs'], env: RendererEnv): null {
        env.stack.push({ Tag, attrs, children: [] });
        return null;
    }

    /**
     * Pops the open tag from the stack, flushing its `children` buffer.
     * If there are is still an active `children` buffer, renders to that.
     * Otherwise, returns the rendered element.
     */
    private popAndRenderTag(Tag: ElementType, attrs: RendererStackEntry['attrs'], env: RendererEnv): ReactNode {
        const top = env.stack.pop();
        if (!top || top.Tag !== Tag) {
            throw new ImbalancedTagsError(top?.Tag, Tag);
        }
        const node = (
            <Tag {...attrs}>
                {top.children.map((child, i) => (
                    <Fragment key={i}>{child}</Fragment>
                ))}
            </Tag>
        );
        if (env.stack.length) {
            env.stack[env.stack.length - 1].children.push(node);
            return null;
        } else {
            return node;
        }
    }

    /**
     * Render a self-closing tag without using the stack.
     * If there is an active `children` buffer, renders to that.
     * Otherwise, returns the rendered element.
     */
    private renderSelfClosingTag(
        Tag: ElementType,
        attrs: RendererStackEntry['attrs'],
        content: string,
        env: RendererEnv,
    ): ReactNode {
        const node = content ? <Tag {...attrs}>{content}</Tag> : <Tag {...attrs} />;
        if (env.stack.length) {
            env.stack[env.stack.length - 1].children.push(node);
            return null;
        } else {
            return node;
        }
    }
}

class ImbalancedTagsError extends Error {
    constructor(public expected: ElementType | undefined, public received: ElementType) {
        super(
            expected
                ? `imbalanced tags; expected "${expected}", received "${received}"`
                : `imbalanced tags; unexpected "${received}"`,
        );
    }
}

class UnknownTokenTypeError extends Error {
    constructor(public token: Token) {
        super(`unable to determine tag for token type "${token.type}"; add to renderer.tags`);
    }
}

interface RendererStackEntry {
    Tag: ElementType;
    attrs?: Record<string, any>;
    children: ReactNode[];
}

interface RendererEnv {
    /** The current renderer stack (the last element corresponds with the parent element). */
    stack: RendererStackEntry[];
}

type RenderRule = (tokens: Token[], idx: number, env: RendererEnv) => string;

const defaultRules: typeof Renderer.prototype.rules = {};

const defaultTags: typeof Renderer.prototype.tags = {
    text: Fragment,
};
