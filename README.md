markdown-it-react

A better way to render markdown in React, without `dangerouslySetInnerHtml`.
Features:

* **Extensible**, so that you can insert custom `ElementType`s, such as using `Link` instead of the default `a`.

Have fun!

## Installation

```
yarn add @thelukester92/markdown-it-react
npm install @thelukester92/markdown-it-react
```

## Special Notes

### Softbreaks

Softbreaks will, by default, render a `br` tag with the `data-softbreak=true` attribute.
This can be overridden to render as a single space, or some other behavior.

## Preserving Markup

`em` and `strong` will, by default, render with the `data-markup` attribute to keep track of whether they were created with asterisks or underscores.
This can be overridden to disable the behavior, but is useful for preserving markdown content when roundtripping between HTML and markdown.
