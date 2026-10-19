import type { EmailTemplate } from './index';
// Build messages with render() and greeting() from './helpers'.

/**
 * Order lifecycle emails (shipped, cancelled, cancellation requests, admin
 * alerts). Add the data shape here and the renderer to `orderTemplates`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OrderTemplateData {}

export const orderTemplates: { [K in keyof OrderTemplateData]: EmailTemplate<OrderTemplateData[K]> } = {};
