import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronRight, Check, ShieldCheck } from 'lucide-react';
import { sound } from '../utils/soundEngine';

interface SlideToApproveProps {
  onApprove: () => void;
  disabled?: boolean;
  text?: string;
  successText?: string;
}

export default function SlideToApprove({
  onApprove,
  disabled = false,
  text = 'Slide to Authorize Remediation',
  successText = 'Authorized & Signed'
}: SlideToApproveProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [maxDrag, setMaxDrag] = useState(240);
  const x = useMotionValue(0);

  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      setMaxDrag(Math.max(120, width - 58));
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setMaxDrag(Math.max(120, containerRef.current.offsetWidth - 58));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
  const fillColor = useTransform(x, [0, maxDrag], ['rgba(0, 113, 227, 0.08)', 'rgba(48, 209, 88, 0.28)']);
  const knobBg = useTransform(x, [0, maxDrag * 0.9], ['#FFFFFF', '#30D158']);
  const knobIconColor = useTransform(x, [0, maxDrag * 0.9], ['#0071E3', '#FFFFFF']);

  const commitApproval = () => {
    animate(x, maxDrag, {
      type: 'spring',
      damping: 24,
      stiffness: 300,
      bounce: 0.15
    });
    setIsCompleted(true);
    sound.playSuccess();
    onApprove();
  };

  const handleDragEnd = () => {
    if (disabled || isCompleted) return;
    const currentX = x.get();
    const threshold = maxDrag * 0.82;

    if (currentX >= threshold) {
      commitApproval();
    } else {
      animate(x, 0, {
        type: 'spring',
        damping: 22,
        stiffness: 280
      });
      sound.playSnap();
    }
  };

  // Keyboard accessibility: Enter, Space, or ArrowRight triggers authorization
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || isCompleted) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      commitApproval();
    }
  };

  return (
    <div
      ref={containerRef}
      className="slide-track"
      tabIndex={disabled || isCompleted ? -1 : 0}
      role="slider"
      aria-label="Slide to authorize remediation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isCompleted ? 100 : 0}
      onKeyDown={handleKeyDown}
      style={{
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        background: isCompleted ? 'rgba(48, 209, 88, 0.14)' : 'var(--surface-secondary)',
        borderColor: isCompleted ? 'rgba(48, 209, 88, 0.35)' : 'var(--border-medium)',
        transition: 'background 240ms ease, border-color 240ms ease',
        outline: 'none'
      }}
    >
      {/* Visual Fill */}
      <motion.div
        className="slide-fill"
        style={{
          width: isCompleted ? '100%' : x,
          backgroundColor: fillColor
        }}
      />

      {/* Track Label */}
      <motion.div
        className="slide-text"
        style={{
          opacity: isCompleted ? 1 : textOpacity,
          color: isCompleted ? 'var(--apple-emerald-dark)' : 'var(--text-secondary)'
        }}
      >
        {isCompleted ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <ShieldCheck size={16} /> {successText}
          </span>
        ) : (
          <span>{text} <span style={{ fontSize: 11, opacity: 0.7 }}>(or press Enter)</span></span>
        )}
      </motion.div>

      {/* Draggable Knob */}
      {!isCompleted && (
        <motion.div
          className="slide-knob"
          drag="x"
          dragConstraints={{ left: 0, right: maxDrag }}
          dragElastic={0.06}
          dragMomentum={false}
          onDragStart={() => sound.playClick()}
          onDragEnd={handleDragEnd}
          style={{
            x,
            backgroundColor: knobBg,
            color: knobIconColor
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={22} strokeWidth={2.6} />
          </motion.div>
        </motion.div>
      )}

      {isCompleted && (
        <div
          style={{
            position: 'absolute',
            right: 14,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--apple-emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}
        >
          <Check size={18} strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
