import Token from 'markdown-it/lib/token';
import { ElementType } from 'react';

export class ImbalancedTagsError extends Error {
    constructor(public expected: ElementType | undefined, public received: ElementType) {
        super(
            expected
                ? `imbalanced tags; expected "${expected}", received "${received}"`
                : `imbalanced tags; unexpected "${received}"`,
        );
    }
}

export class UnknownTokenTypeError extends Error {
    constructor(public token: Token) {
        super(`unable to determine tag for token type "${token.type}"; add to renderer.tags`);
    }
}
