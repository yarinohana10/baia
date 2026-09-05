import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminShell } from '../AdminShell';

const meta: Meta<typeof AdminShell> = {
  title: 'Admin/AdminShell',
  component: AdminShell,
  tags: ['autodocs'],
  parameters: {
    nextjs: { appDirectory: true },
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof AdminShell>;

export const Default: Story = {
  args: {
    user: {
      name: 'Yarin Ohana',
      email: 'yarin@baia.com',
      role: 'ADMIN',
      image: null,
    },
    children: (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">1,234</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₪45,670</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500">Products</p>
            <p className="text-3xl font-bold text-gray-900">89</p>
          </div>
        </div>
      </div>
    ),
  },
};

export const WithAvatar: Story = {
  args: {
    user: {
      name: 'Admin User',
      email: 'admin@baia.com',
      role: 'ADMIN',
      image: 'https://i.pravatar.cc/150?img=68',
    },
    children: (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">Product Management</h2>
        <p className="text-gray-500">Manage your products, categories, and inventory here.</p>
      </div>
    ),
  },
};

export const NoName: Story = {
  name: 'User Without Name',
  args: {
    user: {
      email: 'admin@baia.com',
      role: 'ADMIN',
    },
    children: <p className="text-gray-500">Content area</p>,
  },
};
