import { useEffect } from 'react';
import Konva from 'konva';
import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { normalizePath, reconstructPathData, PathPoint } from '../utils/pathUtils';
import { Shape } from '../types/shapes';

interface UseNodeEditorProps {
    activeTool: string;
    selectedIds: string[];
    shapes: Shape[];
    layerRef: React.RefObject<Konva.Layer>;
    uiLayerRef: React.RefObject<Konva.Layer>;
    onShapesChange?: (shapes: Shape[]) => void;
}

const parsePathData = (d: string) => {
    try {
        const commands = makeAbsolute(parseSVG(d));
        return normalizePath(commands);
    } catch (e) {
        // console.error("Path parse error", e);
        return [];
    }
};

export const useNodeEditor = ({
    activeTool,
    selectedIds,
    shapes,
    layerRef,
    uiLayerRef,
    onShapesChange
}: UseNodeEditorProps) => {
    useEffect(() => {
        if (!layerRef.current || !uiLayerRef.current) return;
        
        // Clear previous node editor
        const existingEditor = uiLayerRef.current.findOne('.node-editor');
        if (existingEditor) existingEditor.destroy();

        if (activeTool !== 'direct-select' || selectedIds.length !== 1) {
            uiLayerRef.current.batchDraw();
            return;
        }

        const shape = shapes.find(s => s.id === selectedIds[0]);
        if (!shape || shape.type !== 'path' || !shape.data) return;

        const pathNode = layerRef.current.findOne(`#${shape.id}`) as Konva.Path;
        if (!pathNode) return;

        const editorGroup = new Konva.Group({
            name: 'node-editor',
            x: shape.x,
            y: shape.y,
            rotation: shape.rotation || 0,
            scaleX: shape.scaleX || 1,
            scaleY: shape.scaleY || 1,
        });

        // Deep copy commands so we can mutate them locally
        const commands: PathPoint[] = JSON.parse(JSON.stringify(parsePathData(shape.data)));
        
        const updateLivePath = () => {
            const newData = reconstructPathData(commands);
            pathNode.data(newData);
            layerRef.current?.batchDraw();
        };

        const commitChanges = () => {
            const newData = reconstructPathData(commands);
            onShapesChange?.(shapes.map(s => s.id === shape.id ? { ...s, data: newData } : s));
        };

        commands.forEach((cmd, i) => {
            if (cmd.type === 'Z') return;
            
            // Ensure x and y exist for non-Z commands
            if (typeof cmd.x !== 'number' || typeof cmd.y !== 'number') return;

            // Main Anchor
            const anchor = new Konva.Circle({
                x: cmd.x,
                y: cmd.y,
                radius: 4,
                fill: '#fff',
                stroke: '#00aaff',
                strokeWidth: 1,
                draggable: true,
                hitStrokeWidth: 10
            });

            anchor.on('dragmove', (e) => {
                // Update command
                const dx = e.target.x() - (cmd.x as number);
                const dy = e.target.y() - (cmd.y as number);
                
                cmd.x = e.target.x();
                cmd.y = e.target.y();

                // If this point has an incoming curve (it is the end point of a C command)
                // we should move its cp2 (which is defined in THIS command)
                if (cmd.type === 'C' && cmd.cp2) {
                    cmd.cp2.x += dx;
                    cmd.cp2.y += dy;
                    
                    const cp2Node = editorGroup.findOne(`.cp2-${i}`);
                    if (cp2Node) {
                        cp2Node.position({ x: cmd.cp2.x, y: cmd.cp2.y });
                    }
                    const cp2Line = editorGroup.findOne(`.cp2-line-${i}`) as Konva.Line;
                    if (cp2Line) {
                        cp2Line.points([cmd.x as number, cmd.y as number, cmd.cp2.x, cmd.cp2.y]);
                    }
                }

                // If the NEXT command is a C, its cp1 is attached to THIS point.
                if (i + 1 < commands.length && commands[i+1].type === 'C') {
                    const nextCmd = commands[i+1];
                    if (nextCmd.cp1) {
                        nextCmd.cp1.x += dx;
                        nextCmd.cp1.y += dy;
                        
                        const nextCp1Node = editorGroup.findOne(`.cp1-${i+1}`);
                        if (nextCp1Node) {
                            nextCp1Node.position({ x: nextCmd.cp1.x, y: nextCmd.cp1.y });
                        }
                        const nextCp1Line = editorGroup.findOne(`.cp1-line-${i+1}`) as Konva.Line;
                        if (nextCp1Line) {
                            nextCp1Line.points([cmd.x as number, cmd.y as number, nextCmd.cp1.x, nextCmd.cp1.y]);
                        }
                    }
                }

                updateLivePath();
            });

            anchor.on('dragend', commitChanges);
            editorGroup.add(anchor);

            // Handles for Cubic Bezier
            if (cmd.type === 'C' && cmd.cp1 && cmd.cp2) {
                // CP2 (Control point for END of curve - attached to current anchor)
                const cp2Line = new Konva.Line({
                    name: `cp2-line-${i}`,
                    points: [cmd.x, cmd.y, cmd.cp2.x, cmd.cp2.y],
                    stroke: '#00aaff',
                    strokeWidth: 1,
                    dash: [2, 2]
                });
                const cp2 = new Konva.Circle({
                    name: `cp2-${i}`,
                    x: cmd.cp2.x,
                    y: cmd.cp2.y,
                    radius: 3,
                    fill: '#00aaff',
                    draggable: true
                });
                cp2.on('dragmove', (e) => {
                    if (cmd.cp2) {
                        cmd.cp2.x = e.target.x();
                        cmd.cp2.y = e.target.y();
                        cp2Line.points([cmd.x as number, cmd.y as number, cmd.cp2.x, cmd.cp2.y]);
                        updateLivePath();
                    }
                });
                cp2.on('dragend', commitChanges);
                
                editorGroup.add(cp2Line);
                editorGroup.add(cp2);
                
                // CP1 (Control point for START of curve - attached to PREVIOUS anchor)
                let prevX = 0, prevY = 0;
                if (i > 0) {
                    const prevCmd = commands[i-1];
                    if (typeof prevCmd.x === 'number' && typeof prevCmd.y === 'number') {
                        prevX = prevCmd.x;
                        prevY = prevCmd.y;
                    }
                }
                
                const cp1Line = new Konva.Line({
                    name: `cp1-line-${i}`,
                    points: [prevX, prevY, cmd.cp1.x, cmd.cp1.y],
                    stroke: '#00aaff',
                    strokeWidth: 1,
                    dash: [2, 2]
                });
                const cp1 = new Konva.Circle({
                    name: `cp1-${i}`,
                    x: cmd.cp1.x,
                    y: cmd.cp1.y,
                    radius: 3,
                    fill: '#00aaff',
                    draggable: true
                });
                cp1.on('dragmove', (e) => {
                    if (cmd.cp1) {
                        cmd.cp1.x = e.target.x();
                        cmd.cp1.y = e.target.y();
                        cp1Line.points([prevX, prevY, cmd.cp1.x, cmd.cp1.y]);
                        updateLivePath();
                    }
                });
                cp1.on('dragend', commitChanges);
                
                editorGroup.add(cp1Line);
                editorGroup.add(cp1);
            }
        });

        uiLayerRef.current.add(editorGroup);
        uiLayerRef.current.batchDraw();

    }, [activeTool, selectedIds, shapes, layerRef, uiLayerRef, onShapesChange]);
};
