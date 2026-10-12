// iOS system colors. Shared by the native screen and the web-view player so they match.
export const colors = {
  light: {
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#000000',
    secondaryText: '#6E6E73',
    separator: '#D1D1D6',
    accent: '#007AFF',
    danger: '#FF3B30',
  },
  dark: {
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    secondaryText: '#8E8E93',
    separator: '#38383A',
    accent: '#0A84FF',
    danger: '#FF453A',
  },
};

export type Palette = (typeof colors)['light'];
