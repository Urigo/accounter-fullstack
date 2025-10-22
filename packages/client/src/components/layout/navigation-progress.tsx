import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router-dom';
import { Progress } from '../ui/progress.js';

/**
 * Global navigation progress indicator
 * Shows a loading bar at the top of the page during route transitions
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  const [progress, setProgress] = useState(0);
  const isLoading = navigation.state === 'loading';

  useEffect(() => {
    if (isLoading) {
      // Start at 20% when loading begins
      setProgress(20);

      // Simulate progress
      const interval = setInterval(() => {
        setProgress(prev => {
          // Asymptotically approach 90% but never quite reach it
          const next = prev + (90 - prev) * 0.1;
          return Math.min(next, 90);
        });
      }, 300);

      return () => clearInterval(interval);
    }

    // Complete the progress when loading finishes
    setProgress(100);

    // Reset after animation
    const timeout = setTimeout(() => {
      setProgress(0);
    }, 500);

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Don't render anything if not loading and progress is 0
  if (!isLoading && progress === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1">
      <Progress value={progress} className="h-1 rounded-none transition-all duration-300" />
    </div>
  );
}
