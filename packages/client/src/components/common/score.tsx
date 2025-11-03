import type { ReactElement } from 'react';

export interface ScoreProps {
  value: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

function getSizeClasses(size: ScoreProps['size']): string {
  switch (size) {
    case 'xs':
      return 'size-8';
    case 'sm':
      return 'size-10';
    case 'md':
      return 'size-15';
    case 'lg':
      return 'size-25';
    case 'xl':
      return 'size-40';
    default:
      return 'size-10';
  }
}

function getTextClasses(size: ScoreProps['size']): string {
  switch (size) {
    case 'xs':
      return 'text-2xs';
    case 'sm':
      return 'text-base';
    case 'md':
      return 'text-2xl';
    case 'lg':
      return 'text-3xl';
    case 'xl':
      return 'text-5xl';
    default:
      return 'text-base';
  }
}

export const Score = ({ value, size = 'xl' }: ScoreProps): ReactElement => {
  // Calculate color based on score (0 = red, 100 = green)
  const getColor = (score: number) => {
    const clampedScore = Math.max(0, Math.min(100, score));
    const red = Math.round(155 * (1 - clampedScore / 100) + 100);
    const green = Math.round(155 * (clampedScore / 100) + 0);
    return `rgb(${red}, ${green}, 0)`;
  };

  const color = getColor(value);
  const percentage = (value / 100) * 75; // 75 is the max dash array for 3/4 circle

  return (
    <div className={'relative ' + getSizeClasses(size)}>
      <svg
        className="rotate-[135deg] size-full"
        viewBox="0 0 36 36"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          className="stroke-current text-gray-200 dark:text-neutral-700"
          strokeWidth="1"
          strokeDasharray="75 100"
          strokeLinecap="round"
        ></circle>

        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={`${percentage} 100`}
          strokeLinecap="round"
        ></circle>
      </svg>

      <div className="absolute top-1/2 start-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
        <span className={'font-bold ' + getTextClasses(size)} style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
};
