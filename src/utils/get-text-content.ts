import { ReactNode } from 'react';

export const getTextContent = (node: ReactNode): string => {
  if (Array.isArray(node)) {
    return node.map(getTextContent).join('');
  } else if (node && typeof node === 'object' && 'children' in node) {
    return getTextContent(node.children);
  } else if (node && typeof node === 'object' && 'props' in node && 'children' in node.props) {
    return getTextContent(node.props.children);
  } else if (typeof node === 'string') {
    return node;
  } else {
    return '';
  }
};
