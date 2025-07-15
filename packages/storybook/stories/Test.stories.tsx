import type { Meta, StoryObj } from '@storybook/react';

// Simple test component
const TestComponent = ({ text }: { text: string }) => (
  <div className="p-4 border rounded bg-blue-50">
    <h2 className="text-lg font-bold">Test Component</h2>
    <p>{text}</p>
  </div>
);

const meta = {
  title: 'Test/Simple',
  component: TestComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TestComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: 'Hello from Storybook! 🚀',
  },
};

export const CustomText: Story = {
  args: {
    text: 'This proves Storybook is working correctly!',
  },
};
