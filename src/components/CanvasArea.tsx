import React, { useState, useEffect, useRef } from 'react';
import KonvaCanvas from '@/components/KonvaCanvas';
import { Shape } from '@/types/shapes';
import { ContextMenu } from './ContextMenu';

interface CanvasAreaProps {
    shapes: Shape[];
    components?: Record<string, Shape>;
    onShapesChange: (shapes: Shape[]) => void;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    activeTool: 'select' | 'direct-select' | 'rect' | 'pen' | 'text' | 'type-on-path' | 'artboard' | 'shape-builder' | 'pencil' | 'brush' | 'eraser';
    exportRequest: { format: 'png' | 'jpg' | 'svg' | 'pdf', scale: number } | null;
    onExportComplete: () => void;
    onMergeShapes?: (ids: string[]) => void;
    viewMode: 'rgb' | 'cmyk' | 'outline';
    onContextMenuAction?: (action: string) => void;
    canUngroup?: boolean;
    canGroup?: boolean;
    resetViewTrigger?: number | null;
    resetStateTrigger?: number | null;
    onAddImageToCanvas?: (src: string, width: number, height: number, x?: number, y?: number) => void;
    onAddShape?: (type: string, data?: any, x?: number, y?: number) => void;
}

export default function CanvasArea({
    shapes,
    components,
    onShapesChange,
    selectedIds,
    onSelectionChange,
    activeTool,
    exportRequest,
    onExportComplete,
    onMergeShapes,
    viewMode,
    onContextMenuAction,
    canUngroup = false,
    canGroup = false,
    resetViewTrigger,
    resetStateTrigger,
    onAddImageToCanvas,
    onAddShape
}: CanvasAreaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setCanvasSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        
        window.addEventListener('resize', updateSize);
        updateSize(); // Initial size
        
        // Small delay to ensure layout is settled
        setTimeout(updateSize, 100);
    
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const handleAction = (action: string) => {
        onContextMenuAction?.(action);
        setContextMenu(null);
    };

    return (
        <div 
            className="w-full h-full relative overflow-hidden bg-[#1a1a1a] outline-none" 
            ref={containerRef}
            tabIndex={0}
            onClick={() => containerRef.current?.focus()}
            onContextMenu={handleContextMenu}
        >
          <KonvaCanvas 
            width={canvasSize.width}
            height={canvasSize.height}
            shapes={shapes}
            components={components}
            onShapesChange={onShapesChange}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            activeTool={activeTool}
            exportRequest={exportRequest}
            onExportComplete={onExportComplete}
            onMergeShapes={onMergeShapes}
            viewMode={viewMode}
            resetViewTrigger={resetViewTrigger}
            resetStateTrigger={resetStateTrigger}
            onAddImageToCanvas={onAddImageToCanvas}
            onAddShape={onAddShape}
          />
          
          {contextMenu && (
              <ContextMenu 
                  x={contextMenu.x} 
                  y={contextMenu.y} 
                  onClose={() => setContextMenu(null)} 
                  onAction={handleAction}
                  selectedCount={selectedIds.length}
                  canUngroup={canUngroup}
                  canGroup={canGroup}
              />
          )}

          {/* Bottom Info Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#0f0f0f] border-t border-gray-800 flex items-center px-4 text-xs text-gray-400 gap-6">
            <span>{shapes.length} objects</span>
            <span>•</span>
            <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Nothing selected'}</span>
          </div>
        </div>
    );
}
