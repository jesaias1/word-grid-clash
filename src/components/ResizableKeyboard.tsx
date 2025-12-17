import { useState, useRef, useEffect, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResizableKeyboardProps {
  children: ReactNode;
}

const ResizableKeyboard = ({ children }: ResizableKeyboardProps) => {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() => {
    const saved = localStorage.getItem('keyboard-scale');
    return saved ? parseFloat(saved) : 1;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startScaleRef = useRef(1);

  useEffect(() => {
    localStorage.setItem('keyboard-scale', scale.toString());
  }, [scale]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startScaleRef.current = scale;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const scaleDelta = deltaY / 100;
      const newScale = Math.min(1.5, Math.max(0.6, startScaleRef.current + scaleDelta));
      setScale(newScale);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // On mobile, just render children directly without resize capability
  if (isMobile) {
    return (
      <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-1 sm:p-2 mx-auto mt-auto mb-1 shrink-0">
        {children}
      </div>
    );
  }

  return (
    <div className="mt-auto mb-1 shrink-0">
      <div 
        ref={containerRef}
        className="relative bg-card/90 backdrop-blur-sm border rounded-lg p-1 sm:p-2 mx-auto"
        style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}
      >
        {/* Resize handle at top-right corner */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute -top-2 -right-2 w-5 h-5 bg-muted hover:bg-accent border border-border rounded cursor-ns-resize flex items-center justify-center transition-colors ${isResizing ? 'bg-accent' : ''}`}
          title="Drag to resize keyboard"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground rotate-90" />
        </div>
        {children}
      </div>
    </div>
  );
};

export default ResizableKeyboard;
