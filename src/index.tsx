import MarkdownIt from 'markdown-it';
import { createRoot } from 'react-dom/client';
import { Renderer } from './markdown-it-react';

const rawMarkdown = `
# Markdown-It React

A better way to render markdown in React, without _dangerouslySetInnerHtml_.
Features:

* **Extensible**, so that you can insert custom _ElementTypes_, such as using _Link_ instead of the default _a_.

Have fun!
`;

const md = new MarkdownIt();
const tokens = md.parse(rawMarkdown, {});
const rendered = new Renderer().render(tokens);

// todo: wrap this up in a playground-type thing with a textarea input and render button

const root = createRoot(document.getElementById('root')!);
root.render(rendered);
