import type { ReactElement } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query.js';
import { cn } from '@/lib/utils.js';

/**
 * A bead sliding along one of the abacus rods.
 *
 * `from` is where the bead rests, `to` how far it travels; the eased there-and-back loop
 * plays at a different `dur` per bead so the six of them never fall in step.
 */
const BEADS = [
  { from: [250, 145], to: [175, 145], dur: '1.6s' },
  { from: [400, 145], to: [425, 145], dur: '1.9s' },
  { from: [200, 300], to: [175, 300], dur: '1.4s' },
  { from: [300, 300], to: [340, 300], dur: '1.8s' },
  { from: [400, 300], to: [425, 300], dur: '1.5s' },
  { from: [350, 450], to: [175, 450], dur: '2.2s' },
] as const;

const ROD_Y = [145, 300, 450];

/**
 * The single-rod loader's three beads. A bead has radius 45 on a rod running 150→850, so
 * the centres are bounded to 195..805 and sit exactly 90 apart when the beads touch. All
 * three share one 2.5s timeline: they gather to the right, then slide back as a group.
 */
const BAR_BEADS = [
  '195 150; 195 150; 195 150; 625 150; 625 150; 195 150; 195 150; 195 150; 195 150',
  '285 150; 285 150; 715 150; 715 150; 715 150; 715 150; 285 150; 285 150; 285 150',
  '375 150; 805 150; 805 150; 805 150; 805 150; 805 150; 805 150; 375 150; 375 150',
];

const BAR_KEY_TIMES = '0; 0.15; 0.3; 0.45; 0.5; 0.65; 0.8; 0.95; 1';
const BAR_KEY_SPLINES =
  '0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0 0 1 1';

type SpinnerProps = Omit<React.ComponentProps<'svg'>, 'viewBox' | 'children'>;

const svgProps = {
  role: 'status',
  'aria-label': 'Loading',
  shapeRendering: 'geometricPrecision',
} as const;

/**
 * The Accounter logo — an abacus — with its beads sliding, used as the app's loading
 * indicator wherever the space is roughly square: a whole route, a dialog, a card.
 * `AccounterBarSpinner` is the one to reach for in a wide, short slot.
 *
 * Strokes and beads are `currentColor`, so it takes the surrounding text colour, and it is
 * resized with the usual `size-*` utilities (default `size-16`).
 *
 * The motion is SMIL rather than CSS so the same markup works when the standalone asset
 * (`public/icons/accounter-loader.svg`) is dropped into an `<img>`. SMIL ignores
 * `prefers-reduced-motion`, so the beads are simply rendered at rest for anyone who asks
 * for less motion.
 */
export function AccounterSpinner({ className, ...props }: SpinnerProps): ReactElement {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <svg viewBox="0 0 600 600" className={cn('size-16', className)} {...svgProps} {...props}>
      <g fill="none" stroke="currentColor" strokeWidth={14}>
        {ROD_Y.map(y => (
          <line key={y} x1={125} y1={y} x2={475} y2={y} />
        ))}
        {/* Frame posts last, so their stroke caps the rod ends. */}
        <rect x={75} y={75} width={50} height={450} rx={25} />
        <rect x={475} y={75} width={50} height={450} rx={25} />
      </g>
      <g fill="currentColor">
        {BEADS.map(({ from, to, dur }) => (
          <ellipse
            key={`${from[0]}-${from[1]}`}
            rx={45}
            ry={45}
            transform={`translate(${from[0]} ${from[1]})`}
          >
            {!reduceMotion && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`${from[0]} ${from[1]}; ${to[0]} ${to[1]}; ${from[0]} ${from[1]}`}
                keyTimes="0; 0.5; 1"
                calcMode="spline"
                keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
                dur={dur}
                repeatCount="indefinite"
              />
            )}
          </ellipse>
        ))}
      </g>
    </svg>
  );
}

/**
 * The same abacus flattened to a single rod (10:3), for loading states that sit in a wide,
 * short slot: an overlay over a table, a full-width panel, a placeholder where a row of
 * data is about to appear. Default size is `h-12 w-40`; keep any override on the 10:3
 * ratio, since the viewBox letterboxes rather than stretches.
 *
 * Same colour and reduced-motion behaviour as `AccounterSpinner`; the standalone asset is
 * `public/icons/accounter-loader-bar.svg`.
 */
export function AccounterBarSpinner({ className, ...props }: SpinnerProps): ReactElement {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <svg viewBox="0 0 1000 300" className={cn('h-12 w-40', className)} {...svgProps} {...props}>
      <g fill="none" stroke="currentColor" strokeWidth={14}>
        <line x1={150} y1={150} x2={850} y2={150} />
        {/* Frame posts last, so their stroke caps the rod ends. */}
        <rect x={100} y={75} width={50} height={150} rx={25} />
        <rect x={850} y={75} width={50} height={150} rx={25} />
      </g>
      <g fill="currentColor">
        {BAR_BEADS.map(values => {
          const [restX, restY] = values.split(';')[0].trim().split(' ');
          return (
            <ellipse key={values} rx={45} ry={45} transform={`translate(${restX} ${restY})`}>
              {!reduceMotion && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={values}
                  keyTimes={BAR_KEY_TIMES}
                  calcMode="spline"
                  keySplines={BAR_KEY_SPLINES}
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              )}
            </ellipse>
          );
        })}
      </g>
    </svg>
  );
}
