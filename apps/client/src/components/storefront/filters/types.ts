import type { ReactNode } from 'react';

/** The rendered filter controls, shared by the desktop toolbar and the phone sheet. */
export type FilterControls = { sizes: ReactNode; colors: ReactNode; price: ReactNode; inStock: ReactNode };
