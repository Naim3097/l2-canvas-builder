import { useState, useRef, useCallback, useEffect } from 'react';
import Konva from 'konva';
import { Shape } from '../types/shapes';
import { reconstructPathData } from '../utils/pathUtils';
import { getShapeBounds } from '../utils/shapeBounds';

interface UsePenToolProps {
    stageRef: React.RefObject<Konva.Stage>;
    tempLayerRef: React.RefObject<Konva.Layer>;
    activeTool: string;
    shapes: Shape[];
    onShapesChange: (shapes: Shape[]) => void;
}

export const usePenTool = ({
    stageRef,
    tempLayerRef,
    activeTool,
    shapes,
    onShapesChange
}: UsePenToolProps) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const [points, setPoints] = useState<{x: number, y: number, type: 'M' | 'L' | 'C', cp1?: {x:number, y:number}, cp2?: {x:number, y:number}}[]>([]);
    const dragStartPos = useRef<{x: number, y: number} | null>(null);
    
    // Visual feedback
    useEffect(() => {
        if (!tempLayerRef.current) return;
        
        const layer = tempLayerRef.current;
        layer.destroyChildren();
        
        if (points.length > 0) {
            // Draw the path so far
            const d = reconstructPathData(points);
            const path = new Konva.Path({
                data: d,
                stroke: '#0099ff',
                strokeWidth: 2,
                fill: 'transparent',
                listening: false
            });
            layer.add(path);
            
            // Draw anchors and handles
            points.forEach((p, i) => {
                const circle = new Konva.Circle({
                    x: p.x,
                    y: p.y,
                    radius: 4,
                    fill: '#fff',
                    stroke: '#0099ff',
                    strokeWidth: 1
                });
                layer.add(circle);
                
                if (p.type === 'C' && p.cp2) {
                    // Draw handle line
                    const line = new Konva.Line({
                        points: [p.x, p.y, p.cp2.x, p.cp2.y],
                        stroke: '#0099ff',
                        strokeWidth: 1,
                        dash: [2, 2]
                    });
                    layer.add(line);
                    const cp = new Konva.Circle({
                        x: p.cp2.x,
                        y: p.cp2.y,
                        radius: 3,
                        fill: '#0099ff'
                    });
                    layer.add(cp);
                }
                
                // Draw incoming handle (cp1) if connected to previous
                const prev = points[i-1];
                if (prev && p.cp1) {
                     const line = new Konva.Line({
                        points: [prev.x, prev.y, p.cp1.x, p.cp1.y],
                        stroke: '#0099ff',
                        strokeWidth: 1,
                        dash: [2, 2]
                    });
                    layer.add(line);
                    const cp = new Konva.Circle({
                        x: p.cp1.x,
                        y: p.cp1.y,
                        radius: 3,
                        fill: '#0099ff'
                    });
                    layer.add(cp);
                }
            });
        }
        
        layer.batchDraw();
    }, [points, tempLayerRef]);

    const getSnappedPos = (pos: {x: number, y: number}) => {
        // Smart Snapping to other shapes
        let bestX = pos.x;
        let bestY = pos.y;
        let minDist = 10;
        
        shapes.forEach(shape => {
            const bounds = getShapeBounds(shape);
            // Snap to bounds center/corners
            const points = [
                { x: bounds.x, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y },
                { x: bounds.x, y: bounds.y + bounds.height },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2 }
            ];
            
            points.forEach(pt => {
                if (Math.abs(pt.x - pos.x) < minDist) {
                    bestX = pt.x;
                }
                if (Math.abs(pt.y - pos.y) < minDist) {
                    bestY = pt.y;
                }
            });
        });
        
        return { x: bestX, y: bestY };
    };

    const handleMouseDown = useCallback(() => {
        if (activeTool !== 'pen' || !stageRef.current) return;
        
        const stage = stageRef.current;
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const rawPos = transform.point(stage.getPointerPosition() || {x:0, y:0});
        const pos = getSnappedPos(rawPos);

        if (!isDrawing) {
            setIsDrawing(true);
            setPoints([{ x: pos.x, y: pos.y, type: 'M' }]); 
            dragStartPos.current = pos;
        } else {
            // Check for close path (click near start)
            if (points.length > 2) {
                const start = points[0];
                const dist = Math.sqrt(Math.pow(pos.x - start.x, 2) + Math.pow(pos.y - start.y, 2));
                if (dist < 10) {
                    // Close path
                    const closedPoints = [...points, { x: start.x, y: start.y, type: 'Z' as const }];
                    
                    // Create Shape
                    const xs = closedPoints.map(p => p.x);
                    const ys = closedPoints.map(p => p.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const width = maxX - minX;
                    const height = maxY - minY;

                    const normalizedPoints = closedPoints.map(p => {
                        if (p.type === 'Z') return p;
                        return {
                            ...p,
                            x: p.x - minX,
                            y: p.y - minY,
                            cp1: p.cp1 ? { x: p.cp1.x - minX, y: p.cp1.y - minY } : undefined,
                            cp2: p.cp2 ? { x: p.cp2.x - minX, y: p.cp2.y - minY } : undefined
                        };
                    });

                    const d = reconstructPathData(normalizedPoints);

                    const newShape: Shape = {
                        id: `path-${Date.now()}`,
                        type: 'path',
                        x: minX,
                        y: minY,
                        width: width,
                        height: height,
                        data: d,
                        stroke: '#000000',
                        strokeWidth: 2,
                        fill: '#cccccc', // Default fill for closed paths
                        name: 'Path'
                    };
                    onShapesChange([...shapes, newShape]);
                    
                    setPoints([]);
                    setIsDrawing(false);
                    dragStartPos.current = null;
                    return;
                }
            }

            setPoints(prev => [...prev, { x: pos.x, y: pos.y, type: 'L' }]);
            dragStartPos.current = pos;
        }
    }, [activeTool, isDrawing, stageRef, shapes, points, onShapesChange]);

    const handleMouseMove = useCallback(() => {
        if (activeTool !== 'pen' || !isDrawing || !stageRef.current) return;
        
        const stage = stageRef.current;
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const rawPos = transform.point(stage.getPointerPosition() || {x:0, y:0});
        // Don't snap while dragging handles for smooth curves
        const pos = rawPos; 

        if (dragStartPos.current) {
            const dx = pos.x - dragStartPos.current.x;
            const dy = pos.y - dragStartPos.current.y;
            
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                setPoints(prev => {
                    if (prev.length === 0) return prev;
                    const last = prev[prev.length - 1];
                    const secondLast = prev[prev.length - 2];
                    
                    const cp2 = { x: last.x - dx, y: last.y - dy };
                    const cp1 = secondLast ? { x: secondLast.x + dx, y: secondLast.y + dy } : { x: last.x, y: last.y };

                    const newPoints = [...prev];
                    newPoints[newPoints.length - 1] = {
                        ...last,
                        type: 'C',
                        cp1: cp1,
                        cp2: cp2
                    };
                    return newPoints;
                });
            }
        }
    }, [activeTool, isDrawing, stageRef]);

    const handleMouseUp = useCallback(() => {
        if (activeTool !== 'pen') return;
        dragStartPos.current = null;
    }, [activeTool]);

    const handleDoubleClick = useCallback(() => {
        if (activeTool !== 'pen' || !isDrawing) return;
        
        setIsDrawing(false);
        if (points.length > 1) {
            // Calculate bounds
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const width = maxX - minX;
            const height = maxY - minY;

            // Normalize points to be relative to (minX, minY)
            const normalizedPoints = points.map(p => ({
                ...p,
                x: p.x - minX,
                y: p.y - minY,
                cp1: p.cp1 ? { x: p.cp1.x - minX, y: p.cp1.y - minY } : undefined,
                cp2: p.cp2 ? { x: p.cp2.x - minX, y: p.cp2.y - minY } : undefined
            }));

            const d = reconstructPathData(normalizedPoints);

            const newShape: Shape = {
                id: `path-${Date.now()}`,
                type: 'path',
                x: minX,
                y: minY,
                width: width,
                height: height,
                data: d,
                stroke: '#000000',
                strokeWidth: 2,
                fill: 'transparent',
                name: 'Path'
            };
            onShapesChange([...shapes, newShape]);
        }
        setPoints([]);
        dragStartPos.current = null;
    }, [activeTool, isDrawing, points, shapes, onShapesChange]);

    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleDoubleClick,
        isDrawing,
        points
    };
};
