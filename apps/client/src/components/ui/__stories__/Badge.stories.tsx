import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from '../badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'New Arrival' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Featured' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Out of Stock' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Shipped' },
};

export const OrderStatuses: Story = {
  name: 'E-commerce Order Statuses',
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">Pending Payment</Badge>
      <Badge variant="default">Confirmed</Badge>
      <Badge variant="secondary">Processing</Badge>
      <Badge>Shipped</Badge>
      <Badge variant="secondary">Delivered</Badge>
      <Badge variant="destructive">Cancelled</Badge>
      <Badge variant="destructive">Refunded</Badge>
    </div>
  ),
};

export const ProductTags: Story = {
  name: 'Product Tags',
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Men</Badge>
      <Badge>Women</Badge>
      <Badge>Children</Badge>
      <Badge variant="destructive">-30% Sale</Badge>
      <Badge variant="secondary">New</Badge>
    </div>
  ),
};
