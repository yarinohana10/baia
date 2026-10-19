import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Footer } from '../Footer';

const meta: Meta<typeof Footer> = {
  title: 'Storefront/Footer',
  component: Footer,
  tags: ['autodocs'],
  parameters: {
    nextjs: { appDirectory: true },
    layout: 'fullscreen',
  },
  args: {
    config: null,
    categories: [
      { label: 'Women', href: '/category/women' },
      { label: 'Men', href: '/category/men' },
      { label: 'Kids', href: '/category/children' },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {};
