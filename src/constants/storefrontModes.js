// A color-only skin over the existing commercial layout. Photos and food colors
// retain their originals; no inversion/filter is applied to the storefront.
export const STOREFRONT_DARK_THEME = {
  '--sf-theme-primary': '#e8c68b', '--sf-theme-secondary': '#e8c68b',
  '--sf-theme-accent': '#e8c68b', '--sf-theme-surface': '#202329',
  '--sf-theme-text': '#f2ece1', '--sf-theme-text-soft': '#d6d1c8',
  '--sf-theme-text-muted': '#aaa69f', '--sf-theme-on-primary': '#211b12',
  '--sf-theme-on-secondary': '#211b12', '--sf-theme-on-accent': '#211b12',
  '--sf-theme-on-surface': '#f2ece1',
};

export const STOREFRONT_SEPIA_THEME = {
  '--sf-theme-primary': '#855437', '--sf-theme-secondary': '#855437',
  '--sf-theme-accent': '#855437', '--sf-theme-surface': '#fff9ef',
  '--sf-theme-text': '#3f3026', '--sf-theme-text-soft': '#604b3c',
  '--sf-theme-text-muted': '#78604c', '--sf-theme-on-primary': '#fff9ef',
  '--sf-theme-on-secondary': '#fff9ef', '--sf-theme-on-accent': '#fff9ef',
  '--sf-theme-on-surface': '#3f3026',
};

export const STOREFRONT_MODE_THEMES = { 'commercial-dark': STOREFRONT_DARK_THEME, sepia: STOREFRONT_SEPIA_THEME };
