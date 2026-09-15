import React from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Button } from './button.js';

type CarouselApi = UseEmblaCarouselType[1];
type EmblaOptions = Parameters<typeof useEmblaCarousel>[0];

type CarouselContextValue = {
  carouselRef: UseEmblaCarouselType[0];
  api: CarouselApi;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  selectedIndex: number;
  scrollSnaps: number[];
  scrollTo: (index: number) => void;
};

const CarouselContext = React.createContext<CarouselContextValue | null>(null);

function useCarousel(): CarouselContextValue {
  const context = React.useContext(CarouselContext);
  if (!context) {
    throw new Error('useCarousel must be used within a <Carousel />');
  }
  return context;
}

/**
 * A horizontal carousel over embla, which is already a dependency.
 *
 * Replaced Mantine's `Carousel`. shadcn has no carousel in this repo, and Mantine's was only
 * a dependency because `@mantine/carousel` peer-depends on embla — so this keeps embla
 * legitimately in use once Mantine goes. Indicators are included because the one call site
 * used `withIndicators`; shadcn's own carousel has no equivalent.
 */
function Carousel({
  opts,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { opts?: EmblaOptions }) {
  const [carouselRef, api] = useEmblaCarousel(opts);
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [scrollSnaps, setScrollSnaps] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!api) return;
    const sync = (): void => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
      setSelectedIndex(api.selectedScrollSnap());
    };
    setScrollSnaps(api.scrollSnapList());
    sync();
    api.on('select', sync).on('reInit', sync);
    return () => {
      api.off('select', sync).off('reInit', sync);
    };
  }, [api]);

  const value = React.useMemo(
    () => ({
      carouselRef,
      api,
      scrollPrev: () => api?.scrollPrev(),
      scrollNext: () => api?.scrollNext(),
      canScrollPrev,
      canScrollNext,
      selectedIndex,
      scrollSnaps,
      scrollTo: (index: number) => api?.scrollTo(index),
    }),
    [carouselRef, api, canScrollPrev, canScrollNext, selectedIndex, scrollSnaps],
  );

  return (
    <CarouselContext.Provider value={value}>
      <div
        data-slot="carousel"
        className={cn('relative', className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, ...props }: React.ComponentProps<'div'>) {
  const { carouselRef } = useCarousel();
  return (
    <div ref={carouselRef} data-slot="carousel-viewport" className="overflow-hidden">
      <div data-slot="carousel-content" className={cn('flex', className)} {...props} />
    </div>
  );
}

function CarouselItem({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="carousel-item"
      role="group"
      aria-roledescription="slide"
      className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}
      {...props}
    />
  );
}

function CarouselPrevious({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { scrollPrev, canScrollPrev } = useCarousel();
  return (
    <Button
      data-slot="carousel-previous"
      variant="outline"
      size="icon"
      className={cn('absolute top-1/2 -left-10 size-8 -translate-y-1/2 rounded-full', className)}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ChevronLeftIcon className="size-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  );
}

function CarouselNext({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      data-slot="carousel-next"
      variant="outline"
      size="icon"
      className={cn('absolute top-1/2 -right-10 size-8 -translate-y-1/2 rounded-full', className)}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ChevronRightIcon className="size-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  );
}

/** Mantine's `withIndicators`: one dot per slide, the current one filled. */
function CarouselIndicators({ className, ...props }: React.ComponentProps<'div'>) {
  const { scrollSnaps, selectedIndex, scrollTo } = useCarousel();
  if (scrollSnaps.length < 2) {
    return null;
  }
  return (
    <div
      data-slot="carousel-indicators"
      className={cn('flex justify-center gap-1.5 pt-2', className)}
      {...props}
    >
      {scrollSnaps.map((_, index) => (
        <button
          // eslint-disable-next-line react/no-array-index-key -- slides are positional
          key={index}
          type="button"
          aria-label={`Go to slide ${index + 1}`}
          aria-current={index === selectedIndex}
          onClick={() => scrollTo(index)}
          className={cn(
            'size-2 rounded-full transition-colors',
            index === selectedIndex ? 'bg-gray-500' : 'bg-gray-300',
          )}
        />
      ))}
    </div>
  );
}

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  CarouselIndicators,
  type CarouselApi,
};
