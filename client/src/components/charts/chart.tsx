import React, { useEffect, useRef } from 'react';
import Chart, { ChartConfiguration } from 'chart.js/auto';

interface BarChartProps {
  data: {
    date: string;
    income?: number;
    outcome?: number;
  }[];
  datasetsTitle?: string[];
  type: ChartConfiguration['type'];
}

export const BarChart: React.FC<BarChartProps> = ({ data, datasetsTitle, type }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        if (chartInstanceRef.current) {
          // If a chart instance already exists, destroy it
          chartInstanceRef.current.destroy();
        }

        chartInstanceRef.current = new Chart(ctx, {
          type: type as ChartConfiguration['type'],
          data: {
            labels: data.map(item => item.date),
            datasets: [
              {
                label: datasetsTitle ? datasetsTitle[0] : 'Income',
                data: data.map(item => item.income),
              },
              {
                label: datasetsTitle ? datasetsTitle[1] : 'Outcome',
                data: data.map(item => item.outcome),
              },
            ],
          },
        });
      }
    }
  }, [data, datasetsTitle, type]);

  return <canvas className="p-10" ref={chartRef} />;
};
