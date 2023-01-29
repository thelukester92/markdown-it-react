import { createRoot } from 'react-dom/client';
import { MarkdownWrapper } from '../markdown-wrapper';

const rawMarkdown = `
# Markdown-It React

A better way to render markdown in React, without _dangerouslySetInnerHtml_.
MIT Licensed.
Features:

* **Extensible**, so that you can insert custom _ElementTypes_, such as using _Link_ instead of the default _a_.

Have fun!
`;

// todo: wrap this up in a playground-type thing with a textarea input and render button

const root = createRoot(document.getElementById('root')!);
root.render(<MarkdownWrapper>{rawMarkdown}</MarkdownWrapper>);
