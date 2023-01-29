import MarkdownIt from 'markdown-it';
import { Renderer, RendererOpts } from './markdown-renderer';

export interface MarkdownWrapperProps {
    children: string;

    /** Intance of markdown-it to use, e.g. with custom plugins. */
    md?: MarkdownIt;

    /** Renderer options, e.g. with custom render rules. */
    rendererOpts?: RendererOpts;
}

export const MarkdownWrapper = ({ children, md, rendererOpts }: MarkdownWrapperProps) => {
    const markdownIt = md ?? new MarkdownIt();
    const renderer = new Renderer(rendererOpts);
    return <>{renderer.render(markdownIt.parse(children, {}))}</>;
};
