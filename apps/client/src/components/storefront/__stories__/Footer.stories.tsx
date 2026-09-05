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
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {};
