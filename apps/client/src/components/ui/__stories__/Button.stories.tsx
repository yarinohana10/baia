import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../button';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: 'Add to Cart' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'View Details' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Apply Coupon' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Cancel' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete Product' },
};

export const Link: Story = {
  args: { variant: 'link', children: 'Learn more' },
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button>
        <ShoppingCart data-icon="inline-start" className="size-4" />
        Add to Cart
      </Button>
      <Button variant="outline">
        <Plus data-icon="inline-start" className="size-4" />
        New Product
      </Button>
      <Button variant="destructive">
        <Trash2 data-icon="inline-start" className="size-4" />
        Remove
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="icon-xs" variant="ghost" aria-label="Add item"><Plus className="size-3" /></Button>
      <Button size="icon-sm" variant="outline" aria-label="View cart"><ShoppingCart className="size-3.5" /></Button>
      <Button size="icon" variant="default" aria-label="Add to cart"><ShoppingCart className="size-4" /></Button>
      <Button size="icon-lg" variant="secondary" aria-label="Shopping cart"><ShoppingCart className="size-4" /></Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { children: 'Out of Stock', disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <Button variant="default">Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
