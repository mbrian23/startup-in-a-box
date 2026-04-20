// Custom Shiki theme matching the Chrono-Trigger palette.
export const chronoTheme = {
  name: 'chrono-zeal',
  type: 'dark',
  colors: {
    'editor.background': '#121C38',
    'editor.foreground': '#ECDFC0',
  },
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#5A5F7A', fontStyle: 'italic' } },
    { scope: ['string', 'constant.other.symbol'], settings: { foreground: '#7A9E56' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#C87A3A' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#C45A5A' } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: '#D4A84A' } },
    { scope: ['entity.name.class', 'entity.name.type', 'support.class'], settings: { foreground: '#6BA8B8' } },
    { scope: ['variable', 'meta.definition.variable'], settings: { foreground: '#ECDFC0' } },
    { scope: ['variable.other.property', 'meta.property-name'], settings: { foreground: '#8B6FA6' } },
    { scope: ['punctuation'], settings: { foreground: '#ECDFC0' } },
    { scope: ['string.quoted.docstring', 'comment.block.documentation'], settings: { foreground: '#8B6FA6', fontStyle: 'italic' } },
  ],
} as const;
