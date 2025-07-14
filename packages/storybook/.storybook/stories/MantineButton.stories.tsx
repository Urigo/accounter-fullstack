import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@mantine/core';
import { IconPlus, IconDownload, IconTrash } from '@tabler/icons-react';

// Example Mantine Button component story
const meta = {
  title: 'Mantine/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Mantine Button component with full theme support.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['filled', 'light', 'outline', 'subtle', 'default', 'gradient'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    color: {
      control: 'select',
      options: ['blue', 'red', 'green', 'yellow', 'purple', 'teal', 'gray'],
    },
    disabled: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
    fullWidth: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Mantine Button',
  },
};

export const WithIcon: Story = {
  args: {
    leftSection: <IconPlus size={16} />,
    children: 'Add Item',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Button variant="filled">Filled</Button>
      <Button variant="light">Light</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="subtle">Subtle</Button>
      <Button variant="default">Default</Button>
      <Button variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
        Gradient
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex gap-2 items-center flex-wrap">
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="md">MD</Button>
      <Button size="lg">LG</Button>
      <Button size="xl">XL</Button>
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex gap-2 flex-wrap">
      <Button color="blue">Blue</Button>
      <Button color="red">Red</Button>
      <Button color="green">Green</Button>
      <Button color="yellow">Yellow</Button>
      <Button color="purple">Purple</Button>
      <Button color="teal">Teal</Button>
    </div>
  ),
};

export const WithRightIcon: Story = {
  args: {
    rightSection: <IconDownload size={16} />,
    children: 'Download',
  },
};

export const Destructive: Story = {
  args: {
    color: 'red',
    leftSection: <IconTrash size={16} />,
    children: 'Delete',
  },
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
  parameters: {
    layout: 'padded',
  },
};