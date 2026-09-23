import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Carousel,
  CarouselContent,
  CarouselIndicators,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel.js';

/**
 * Replaced Mantine's `Carousel`, which was only a dependency because
 * `@mantine/carousel` peer-depends on embla — this keeps embla legitimately in use.
 * Indicators are here because the documents gallery used `withIndicators`; shadcn's own
 * carousel has no equivalent.
 */
function Harness({ slides = 3 }: { slides?: number }): ReactElement {
  return (
    <div className="p-12">
      <Carousel className="mx-auto w-full max-w-80 px-10">
        <CarouselContent>
          {Array.from({ length: slides }, (_, index) => (
            <CarouselItem key={index}>
              <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-2xl font-medium">
                {index + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {slides > 1 && (
          <>
            <CarouselPrevious />
            <CarouselNext />
          </>
        )}
        <CarouselIndicators />
      </Carousel>
    </div>
  );
}

const meta = {
  title: 'UI/Carousel',
  component: Harness,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };

/** A single slide hides both the controls and the indicators, as Mantine's did. */
export const SingleSlide: Story = { args: { slides: 1 } };

export const ManySlides: Story = { args: { slides: 8 } };

/**
 * The slide count changing after mount, which is what the documents gallery does when a
 * document is added or removed. Embla emits `reInit`, and the indicators have to follow —
 * a stale snap list would leave a dot addressing a slide that no longer exists.
 */
export const ChangingSlideCount: Story = {
  render: function Render() {
    const [slides, setSlides] = useState(5);
    return (
      <div>
        <button
          type="button"
          data-testid="shrink"
          className="m-4 rounded border px-2 py-1 text-sm"
          onClick={() => setSlides(2)}
        >
          Drop to 2 slides
        </button>
        <Harness slides={slides} />
      </div>
    );
  },
};
