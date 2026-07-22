import { useEffect, useState, useRef } from 'react';
import { motion, useInView, animate, useMotionValue } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  delay?: number;
  format?: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1.8,
  delay = 0,
  format = true,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [displayValue, setDisplayValue] = useState(0);
  const count = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;

    const timeout = setTimeout(() => {
      const controls = animate(count, value, {
        duration,
        ease: [0.25, 0.46, 0.45, 0.94],
        onUpdate(latest) {
          setDisplayValue(latest);
        },
      });
      return () => controls.stop();
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [inView, value, duration, delay, count]);

  const formatted = (() => {
    const num = Math.round(displayValue * Math.pow(10, decimals)) / Math.pow(10, decimals);
    if (format) {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return String(num);
  })();

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay }}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
}
