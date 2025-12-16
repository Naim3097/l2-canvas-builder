import { useRef, useCallback } from 'react';
import Konva from 'konva';
import { Shape, PathShape } from '../types/shapes';
import { performBlobBrush, performEraser } from '../utils/booleanOperations';

interface UseFreehandToolProps {
    stageRef: React.RefObject<Konva.Stage>;
    layerRef: React.RefObject<Konva.Layer>;
    activeTool: string;
    shapes: Shape[];
    onShapesChange: (shapes: Shape[], recordHistory?: boolean) => void;
    selectedIds: string[];
}

export const useFreehandTool = ({
    stageRef,
    layerRef,
    activeTool,
    shapes,
    onShapesChange,
    selectedIds
}: UseFreehandToolProps) => {
    const isDrawing = useRef(false);
    const isProcessing = useRef(false);
    const currentLine = useRef<Konva.Line | null>(null);
    const points = useRef<number[]>([]);

    const handleMouseDown = useCallback(() => {
        if (activeTool !== 'pencil' && activeTool !== 'brush' && activeTool !== 'eraser') return;
        if (isProcessing.current) return; // Prevent new strokes while processing
        
        const stage = stageRef.current;
        if (!stage) return;

        const pos = stage.getRelativePointerPosition();
        if (!pos) return;

        isDrawing.current = true;
        points.current = [pos.x, pos.y];

        // Create temporary line for visual feedback
        let strokeColor = '#000000';
        let strokeWidth = 2;
        let opacity = 1;

        if (activeTool === 'brush') {
            strokeColor = '#3b82f6';
            strokeWidth = 10;
            opacity = 0.6;
        } else if (activeTool === 'eraser') {
            strokeColor = '#ff0000'; // Red for eraser feedback
            strokeWidth = 20;
            opacity = 0.4;
        }

        const line = new Konva.Line({
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            globalCompositeOperation: 'source-over',
            points: points.current,
            lineCap: 'round',
            lineJoin: 'round',
            tension: 0.5,
            listening: false,
            opacity: opacity
        });

        layerRef.current?.add(line);
        currentLine.current = line;
    }, [activeTool, stageRef, layerRef]);

    const handleMouseMove = useCallback(() => {
        if (!isDrawing.current || !currentLine.current) return;

        const stage = stageRef.current;
        if (!stage) return;

        const pos = stage.getRelativePointerPosition();
        if (!pos) return;

        // Add new point
        const newPoints = currentLine.current.points().concat([pos.x, pos.y]);
        currentLine.current.points(newPoints);
        points.current = newPoints;
        
        // Optimize: batch draw if needed, but Konva handles this reasonably well
        layerRef.current?.batchDraw();
    }, [stageRef, layerRef]);

    const handleMouseUp = useCallback(async () => {
        if (!isDrawing.current) return;
        
        isDrawing.current = false;
        isProcessing.current = true;
        
        // Clean up temporary line
        if (currentLine.current) {
            currentLine.current.destroy();
            currentLine.current = null;
            layerRef.current?.batchDraw();
        }

        if (points.current.length < 4) {
            isProcessing.current = false;
            return; // Need at least 2 points (x,y, x,y)
        }

        // Convert points to SVG Path Data
        // M x1 y1 L x2 y2 ...
        let pathData = `M ${points.current[0]} ${points.current[1]}`;
        for (let i = 2; i < points.current.length; i += 2) {
            pathData += ` L ${points.current[i]} ${points.current[i+1]}`;
        }

        try {
            if (activeTool === 'pencil') {
                // Create a simple PathShape
                const newShape: PathShape = {
                    id: `path-${Date.now()}`,
                    type: 'path',
                    x: 0,
                    y: 0,
                    width: 0, // Will be calculated by renderer or helper
                    height: 0,
                    data: pathData,
                    stroke: '#000000',
                    strokeWidth: 2,
                    strokeCap: 'round',
                    strokeJoin: 'round',
                    fill: 'transparent',
                    name: 'Path',
                    rotation: 0,
                    opacity: 1
                };
                onShapesChange([...shapes, newShape], true);
            } else if (activeTool === 'brush') {
                // Blob Brush Logic
                const brushWidth = 10;
                const brushColor = '#3b82f6'; // Default blue for now

                const result = await performBlobBrush(shapes, pathData, brushWidth, brushColor, selectedIds);
                if (result) {
                    onShapesChange(result, true);
                }
            } else if (activeTool === 'eraser') {
                // Eraser Logic
                const eraserWidth = 20;
                const result = await performEraser(shapes, pathData, eraserWidth);
                if (result) {
                    onShapesChange(result, true);
                }
            }
        } catch (error) {
            console.error("Freehand tool operation failed", error);
        } finally {
            isProcessing.current = false;
            points.current = [];
        }
    }, [activeTool, shapes, onShapesChange, selectedIds, layerRef]);

    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp
    };
};
