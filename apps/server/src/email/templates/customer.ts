import type { EmailTemplate } from './index';
// Build messages with render() and greeting() from './helpers'.

/**
 * Customer-account, contact and marketing emails (welcome, contact form,
 * newsletter). Add the data shape here and the renderer to `customerTemplates`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomerTemplateData {}

export const customerTemplates: { [K in keyof CustomerTemplateData]: EmailTemplate<CustomerTemplateData[K]> } = {};
