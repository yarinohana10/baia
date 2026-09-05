import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Separator } from '../separator';

const meta: Meta<typeof Separator> = {
  title: 'UI/Separator',
  component: Separator,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="space-y-3 w-80">
      <p className="text-sm font-medium">Order Summary</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Subtotal: ₪299</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Shipping: ₪29.90</p>
      <Separator />
      <p className="text-sm font-medium">Total: ₪328.90</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex items-center gap-4 h-8">
      <span className="text-sm">Men</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Women</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Children</span>
    </div>
  ),
};
