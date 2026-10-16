import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Header } from '../Header';

const meta: Meta<typeof Header> = {
  title: 'Storefront/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    nextjs: { appDirectory: true },
    layout: 'fullscreen',
  },
  args: {
    nav: [
      { label: 'Women', href: '/category/women' },
      { label: 'Men', href: '/category/men' },
      { label: 'Kids', href: '/category/children' },
      { label: 'New Arrivals', href: '/new-arrivals' },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {};
