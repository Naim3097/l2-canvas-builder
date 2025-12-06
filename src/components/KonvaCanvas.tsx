'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type { Shape } from '@/types/shapes';
import { exportToSVG } from '@/utils/svgExporter';
import { getShapeDimensions } from '@/utils/treeUtils';

import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { normalizePath } from '../utils/pathUtils';
import { decomposeMatrix } from '../utils/matrixUtils';
import { Quadtree } from '../utils/Quadtree';
import { useKeyboardRef } from '@/hooks/useKeyboardRef';
import { getSnapGuides, calculateSnap, drawGuides, clearGuides } from '@/utils/snappingUtils';

const getPathToNode = (shapes: Shape[], targetId: string, path: string[] = []): string[] | null => {
    for (const shape of shapes) {
        if (shape.id === targetId) return [...path, shape.id];
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            const result = getPathToNode(shape.children, targetId, [...path, shape.id]);
            if (result) return result;
        }
    }
    return null;
};

interface KonvaCanvasProps {
  width: number;
  height: number;
  shapes?: Shape[];
  components?: Record<string, Shape>;
  onShapesChange?: (shapes: Shape[]) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  activeTool?: 'select' | 'direct-select' | 'rect' | 'circle' | 'text' | 'pen' | 'artboard' | 'type-on-path' | 'shape-builder';
  exportRequest?: { format: 'png' | 'jpg' | 'svg' | 'pdf', scale: number } | null;
  onExportComplete?: () => void;
  activeGroupId?: string | null;
  onEnterGroup?: (id: string) => void;
  onExitGroup?: () => void;
  onMergeShapes?: (ids: string[]) => void;
  viewMode?: 'rgb' | 'cmyk' | 'outline';
  resetViewTrigger?: number | null;
}

const parsePathData = (d: string) => {
    try {
        const commands = makeAbsolute(parseSVG(d));
        return normalizePath(commands);
    } catch (e) {
        console.error("Path parse error", e);
        return [];
    }
};

const reconstructPathData = (points: any[]) => {
    return points.map(pt => {
        if (pt.type === 'M') return `M ${pt.x} ${pt.y}`;
        if (pt.type === 'L') return `L ${pt.x} ${pt.y}`;
        if (pt.type === 'C') return `C ${pt.cp1.x} ${pt.cp1.y}, ${pt.cp2.x} ${pt.cp2.y}, ${pt.x} ${pt.y}`;
        if (pt.type === 'Z') return 'Z';
        return '';
    }).join(' ');
};

export default function KonvaCanvas({ 
  width, 
  height, 
  shapes = [],
  components = {},
  onShapesChange,
  selectedIds = [],
  onSelectionChange,
  activeTool = 'select',
  exportRequest,
  onExportComplete,
  activeGroupId,
  onEnterGroup,
  onExitGroup,
  onMergeShapes,
  viewMode = 'rgb',
  resetViewTrigger
}: KonvaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const gradientGroupRef = useRef<Konva.Group | null>(null);
  
  // Node reconciliation map: shapeId -> Konva.Node
  const nodeMapRef = useRef<Map<string, Konva.Node>>(new Map());
  
  // State health monitoring - detect and recover from stuck states
  const lastRenderAttempt = useRef<number>(0);
  const consecutiveFailures = useRef<number>(0);
  
  const [isDrawing, setIsDrawing] = useState(false);
  // Bezier Path State
  const [currentPathPoints, setCurrentPathPoints] = useState<{x: number, y: number, type: 'M' | 'L' | 'C', cp1?: {x:number, y:number}, cp2?: {x:number, y:number}}[]>([]);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<{x: number, y: number} | null>(null);
  
  // Zoom & Pan State
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Reset View Effect
  useEffect(() => {
    if (resetViewTrigger) {
      setStageScale(1);
      setStagePos({ x: 0, y: 0 });
      
      if (stageRef.current) {
        stageRef.current.scale({ x: 1, y: 1 });
        stageRef.current.position({ x: 0, y: 0 });
        stageRef.current.batchDraw();
      }
    }
  }, [resetViewTrigger]);
  
  const keys = useKeyboardRef();

  // Quadtree State
  const quadtreeRef = useRef<Quadtree<any>>(new Quadtree({ x: -50000, y: -50000, width: 100000, height: 100000 }));
  const [visibleShapes, setVisibleShapes] = useState<Shape[]>([]);

  // Refs for event handlers to avoid stale closures without re-rendering
  const selectedIdsRef = useRef(selectedIds);
  const activeToolRef = useRef(activeTool);

  useEffect(() => {
      selectedIdsRef.current = selectedIds;
      activeToolRef.current = activeTool;
  }, [selectedIds, activeTool]);

  const updateVisibleShapes = useCallback(() => {
      if (!stageRef.current) {
          setVisibleShapes(shapes);
          return;
      }
      const stage = stageRef.current;
      const scale = stage.scaleX();
      const x = -stage.x() / scale;
      const y = -stage.y() / scale;
      const width = stage.width() / scale;
      const height = stage.height() / scale;
      
      const padding = 100;
      const viewRect = { 
          x: x - padding, 
          y: y - padding, 
          width: width + padding * 2, 
          height: height + padding * 2 
      };
      
      const visible = quadtreeRef.current.retrieve([], viewRect);
      const visibleIds = new Set(visible.map(v => v.id));
      // Maintain z-order
      const sortedVisible = shapes.filter(s => visibleIds.has(s.id));
      setVisibleShapes(sortedVisible);
  }, [shapes]);

  useEffect(() => {
      const qt = quadtreeRef.current;
      qt.clear();
      shapes.forEach(s => {
          const dims = getShapeDimensions(s);
          qt.insert({ ...s, ...dims });
      });
      updateVisibleShapes();
  }, [shapes, updateVisibleShapes, stageScale, stagePos]); // Added stageScale and stagePos deps

  // Node Editing Effect
  useEffect(() => {
      if (!layerRef.current || !stageRef.current) return;
      
      // Clear previous node editor
      const existingEditor = layerRef.current.findOne('.node-editor');
      if (existingEditor) existingEditor.destroy();

      if (activeTool !== 'direct-select' || selectedIds.length !== 1) {
          layerRef.current.batchDraw();
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
          scaleX: (shape as any).scaleX || 1,
          scaleY: (shape as any).scaleY || 1,
      });

      // Deep copy commands so we can mutate them locally
      const commands = JSON.parse(JSON.stringify(parsePathData(shape.data)));
      
      const updateLivePath = () => {
          const newData = reconstructPathData(commands);
          pathNode.data(newData);
          layerRef.current?.batchDraw();
      };

      const commitChanges = () => {
          const newData = reconstructPathData(commands);
          onShapesChange?.(shapes.map(s => s.id === shape.id ? { ...s, data: newData } : s));
      };

      commands.forEach((cmd: any, i: number) => {
          if (cmd.type === 'Z') return;

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
              const dx = e.target.x() - cmd.x;
              const dy = e.target.y() - cmd.y;
              
              cmd.x = e.target.x();
              cmd.y = e.target.y();

              // If this point has an incoming curve (it is the end point of a C command)
              // we should move its cp2 (which is defined in THIS command)
              if (cmd.type === 'C') {
                  cmd.cp2.x += dx;
                  cmd.cp2.y += dy;
                  // We need to update the visual handle for cp2 as well, but it's tricky to reference it here easily without storing refs.
                  // Actually, we can just redraw the whole editor or update specific nodes if we named them.
                  // For MVP, let's just update the path. The handles might visually lag or detach until dragend if we don't update them.
                  // Let's try to update them.
                  const cp2Node = editorGroup.findOne(`.cp2-${i}`);
                  if (cp2Node) {
                      cp2Node.position({ x: cmd.cp2.x, y: cmd.cp2.y });
                  }
                  const cp2Line = editorGroup.findOne(`.cp2-line-${i}`) as Konva.Line;
                  if (cp2Line) {
                      cp2Line.points([cmd.x, cmd.y, cmd.cp2.x, cmd.cp2.y]);
                  }
              }

              // If the NEXT command is a C, its cp1 is attached to THIS point.
              if (i + 1 < commands.length && commands[i+1].type === 'C') {
                  const nextCmd = commands[i+1];
                  nextCmd.cp1.x += dx;
                  nextCmd.cp1.y += dy;
                  
                  const nextCp1Node = editorGroup.findOne(`.cp1-${i+1}`);
                  if (nextCp1Node) {
                      nextCp1Node.position({ x: nextCmd.cp1.x, y: nextCmd.cp1.y });
                  }
                  const nextCp1Line = editorGroup.findOne(`.cp1-line-${i+1}`) as Konva.Line;
                  if (nextCp1Line) {
                      nextCp1Line.points([cmd.x, cmd.y, nextCmd.cp1.x, nextCmd.cp1.y]);
                  }
              }

              updateLivePath();
          });

          anchor.on('dragend', commitChanges);
          editorGroup.add(anchor);

          // Handles for Cubic Bezier
          if (cmd.type === 'C') {
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
                  cmd.cp2.x = e.target.x();
                  cmd.cp2.y = e.target.y();
                  cp2Line.points([cmd.x, cmd.y, cmd.cp2.x, cmd.cp2.y]);
                  updateLivePath();
              });
              cp2.on('dragend', commitChanges);
              
              editorGroup.add(cp2Line);
              editorGroup.add(cp2);
              
              // CP1 (Control point for START of curve - attached to PREVIOUS anchor)
              let prevX = 0, prevY = 0;
              if (i > 0) {
                  prevX = commands[i-1].x;
                  prevY = commands[i-1].y;
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
                  cmd.cp1.x = e.target.x();
                  cmd.cp1.y = e.target.y();
                  cp1Line.points([prevX, prevY, cmd.cp1.x, cmd.cp1.y]);
                  updateLivePath();
              });
              cp1.on('dragend', commitChanges);
              
              editorGroup.add(cp1Line);
              editorGroup.add(cp1);
          }
      });

      layerRef.current.add(editorGroup);
      layerRef.current.batchDraw();

  }, [activeTool, selectedIds, shapes]);

  // Initialize stage and layer
  useEffect(() => {
    if (!containerRef.current) return;

    const stage = new Konva.Stage({
      container: containerRef.current,
      width: width || 800,
      height: height || 600,
      draggable: activeTool === 'select', // Allow panning in select mode via middle click or space (handled separately)
    });

    // Zoom Handling
    stage.on('wheel', (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
        
        // Limit zoom (0.05x to 50x)
        if (newScale < 0.05 || newScale > 50) return;

        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
        
        setStageScale(newScale);
        setStagePos(newPos);
        // Update visible shapes on zoom
        // We need to call updateVisibleShapes, but it's defined outside.
        // We can't call it directly here because this useEffect has empty deps (or width/height).
        // We should use a separate effect or ref to trigger update.
    });
    
    // Panning with Middle Mouse or Space+Drag
    stage.on('dragstart', (e) => {
        if (e.target === stage) {
            // Panning
            containerRef.current!.style.cursor = 'grabbing';
        }
    });
    
    stage.on('dragmove', (e) => {
        if (e.target === stage) {
            setStagePos(stage.position());
        }
    });

    stage.on('dragend', (e) => {
        if (e.target === stage) {
            containerRef.current!.style.cursor = 'default';
            setStagePos(stage.position());
        }
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const transformer = new Konva.Transformer({
      enabledAnchors: ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'],
      ignoreStroke: true,
      borderStroke: '#0099ff',
      anchorStroke: '#0099ff',
      anchorFill: '#ffffff',
      anchorSize: 8,
      rotateEnabled: true,
      rotateAnchorOffset: 30,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
    });
    layer.add(transformer);

    stageRef.current = stage;
    layerRef.current = layer;
    transformerRef.current = transformer;

    // Handle background click to deselect
    stage.on('click tap', (e) => {
      if (e.target === stage) {
        if (activeTool === 'select') {
             onSelectionChange?.([]);
        }
      }
    });

    return () => {
      stage.destroy();
    };
  }, [width, height]); // Re-create stage only on resize (or init)

  // Spacebar Panning Logic
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.code === 'Space' && !e.repeat) {
              if (stageRef.current) {
                  stageRef.current.draggable(true);
                  if (containerRef.current) containerRef.current.style.cursor = 'grab';
              }
          }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              if (stageRef.current) {
                  stageRef.current.draggable(false);
                  if (containerRef.current) containerRef.current.style.cursor = 'default';
              }
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, []);

  // Handle Export
  useEffect(() => {
    if (exportRequest) {
        // Temporarily hide UI elements (transformer, guides)
        const transformer = transformerRef.current;
        const guideLayer = layerRef.current?.findOne('.guide-layer');
        
        if (transformer) transformer.hide();
        if (guideLayer) guideLayer.hide();
        
        // Force draw
        layerRef.current?.batchDraw();

        setTimeout(() => {
            if (exportRequest.format === 'svg') {
                const svgContent = exportToSVG(shapes, width, height, components);
                const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `design-export.svg`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else if (exportRequest.format === 'pdf') {
                if (stageRef.current) {
                    const pdf = new jsPDF({
                        orientation: width > height ? 'landscape' : 'portrait',
                        unit: 'px',
                        format: [width, height]
                    });

                    const uri = stageRef.current.toDataURL({
                        pixelRatio: exportRequest.scale,
                        mimeType: 'image/jpeg',
                        quality: 1
                    });

                    pdf.addImage(uri, 'JPEG', 0, 0, width, height);
                    pdf.save('design-export.pdf');
                }
            } else if (stageRef.current) {
                const uri = stageRef.current.toDataURL({
                    pixelRatio: exportRequest.scale,
                    mimeType: exportRequest.format === 'jpg' ? 'image/jpeg' : 'image/png',
                    quality: 1
                });
                
                const link = document.createElement('a');
                link.download = `design-export.${exportRequest.format}`;
                link.href = uri;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            
            // Restore UI
            if (transformer) transformer.show();
            if (guideLayer) guideLayer.show();
            layerRef.current?.batchDraw();
            
            onExportComplete?.();
        }, 100);
    }
  }, [exportRequest, onExportComplete, shapes, width, height]);

  // Helper: Update node properties without recreating
  const updateNodeProperties = useCallback((node: Konva.Node, shapeData: Shape, commonProps: any) => {
    // Update transform properties
    node.setAttrs(commonProps);
    
    // Update shape-specific properties based on type
    if (shapeData.type === 'rect' && node instanceof Konva.Rect) {
      node.setAttrs({
        width: (shapeData as any).width,
        height: (shapeData as any).height,
        cornerRadius: (shapeData as any).cornerRadius,
      });
    } else if (shapeData.type === 'circle' && node instanceof Konva.Circle) {
      node.setAttrs({
        radius: (shapeData as any).radius,
      });
    } else if (shapeData.type === 'text' && node instanceof Konva.Text) {
      node.setAttrs({
        text: (shapeData as any).text,
        fontSize: (shapeData as any).fontSize,
        fontFamily: (shapeData as any).fontFamily,
        fontStyle: (shapeData as any).fontWeight === 'bold' ? 'bold' : 'normal',
        align: (shapeData as any).align,
      });
    } else if (shapeData.type === 'path' && node instanceof Konva.Path) {
      node.setAttrs({
        data: (shapeData as any).data,
      });
    }
    
    // Update appearance
    if (shapeData.fills && shapeData.fills.length > 0) {
      const fill = shapeData.fills[0];
      if (fill.visible && fill.type === 'solid') {
        node.setAttr('fill', fill.color);
      }
    } else if ((shapeData as any).fill) {
      node.setAttr('fill', (shapeData as any).fill);
    }
    
    if (shapeData.strokes && shapeData.strokes.length > 0) {
      const stroke = shapeData.strokes[0];
      if (stroke.visible) {
        node.setAttr('stroke', stroke.color);
        node.setAttr('strokeWidth', stroke.width);
      }
    } else if ((shapeData as any).stroke) {
      node.setAttr('stroke', (shapeData as any).stroke);
      node.setAttr('strokeWidth', (shapeData as any).strokeWidth);
    }
  }, []);

  // Helper to render a single shape (recursive)
  const activeGroupPath = React.useMemo(() => activeGroupId ? getPathToNode(shapes, activeGroupId) : null, [shapes, activeGroupId]);

  const renderShape = (shapeData: Shape, insideActiveGroup: boolean = false): Konva.Node | null => {
    let node: Konva.Shape | Konva.Group | null = null;

    // Handle Instance Shape
    if (shapeData.type === 'instance') {
        const master = components[shapeData.componentId];
        if (!master) {
            // Render placeholder for missing component
            const group = new Konva.Group({
                x: shapeData.x,
                y: shapeData.y,
                width: shapeData.width,
                height: shapeData.height,
                opacity: shapeData.opacity ?? 1,
                rotation: shapeData.rotation ?? 0,
                listening: true,
                id: shapeData.id,
                name: shapeData.id
            });
            const rect = new Konva.Rect({
                width: shapeData.width,
                height: shapeData.height,
                stroke: 'red',
                strokeWidth: 1,
                dash: [5, 5]
            });
            const text = new Konva.Text({
                text: 'Missing Component',
                fill: 'red',
                fontSize: 10,
                y: shapeData.height / 2 - 5,
                width: shapeData.width,
                align: 'center'
            });
            group.add(rect);
            group.add(text);
            return group;
        }

        // Create a group to represent the instance
        const group = new Konva.Group({
            x: shapeData.x,
            y: shapeData.y,
            width: shapeData.width,
            height: shapeData.height,
            rotation: shapeData.rotation ?? 0,
            opacity: shapeData.opacity ?? 1,
            listening: true,
            id: shapeData.id,
            name: shapeData.id,
            draggable: activeTool === 'select' && !shapeData.locked
        });

        // Calculate scale based on instance size vs master size
        const { width: masterWidth, height: masterHeight } = getShapeDimensions(master);
        const scaleX = shapeData.width / masterWidth;
        const scaleY = shapeData.height / masterHeight;

        // Render master content scaled
        const contentGroup = new Konva.Group({
            scaleX,
            scaleY
        });

        // Recursive render of master content
        // Note: We need to handle overrides here in a real implementation
        // For now, we just render the master's visual representation
        
        // We can't easily reuse renderShape for the master because it would attach event listeners 
        // and IDs that conflict. We need a "visual only" render or just clone the result.
        // However, Konva nodes aren't easily cloned with logic.
        // Let's try to render the master shape but override its props to be non-interactive
        
        const masterNode = renderShape({ ...master, x: 0, y: 0, id: `instance-content-${shapeData.id}`, locked: true } as Shape, true);
        if (masterNode) {
            // Disable listening on internal nodes to treat instance as one object
            masterNode.listening(false); 
            contentGroup.add(masterNode as any);
        }

        group.add(contentGroup);
        return group;
    }

    const isTargetGroup = shapeData.id === activeGroupId;
    const isParentOfTarget = activeGroupPath?.includes(shapeData.id) && !isTargetGroup;
    const effectiveInside = insideActiveGroup || isTargetGroup;
    
    let isDimmed = false;
    let isListening = true;
    
    if (activeGroupId) {
        if (effectiveInside) {
            isDimmed = false;
            isListening = true;
        } else if (isParentOfTarget) {
            isDimmed = false;
            isListening = false;
        } else {
            isDimmed = true;
            isListening = false;
        }
    }

    const isOutline = viewMode === 'outline';

    let transformProps: any = {
        x: shapeData.x || 0,
        y: shapeData.y || 0,
        rotation: shapeData.rotation || 0,
        scaleX: shapeData.scaleX || 1,
        scaleY: shapeData.scaleY || 1,
    };

    if (shapeData.transform) {
        const decomp = decomposeMatrix(shapeData.transform);
        transformProps = {
            x: decomp.x,
            y: decomp.y,
            rotation: decomp.rotation,
            scaleX: decomp.scaleX,
            scaleY: decomp.scaleY,
            skewX: decomp.skewX,
            skewY: decomp.skewY
        };
    }

    const commonProps = {
      ...transformProps,
      opacity: (shapeData.opacity ?? 1) * (isDimmed ? 0.3 : 1),
      draggable: (activeTool === 'select' || activeTool === 'direct-select') && !shapeData.locked && isListening,
      listening: isListening,
      name: shapeData.id,
      id: shapeData.id, // Important for finding it later
      globalCompositeOperation: (shapeData.blendMode || 'source-over') as any,
      shadowColor: isOutline ? undefined : shapeData.shadowColor,
      shadowBlur: isOutline ? 0 : shapeData.shadowBlur,
      shadowOffsetX: isOutline ? 0 : shapeData.shadowOffsetX,
      shadowOffsetY: isOutline ? 0 : shapeData.shadowOffsetY,
      filters: (!isOutline && (shapeData as any).blurRadius) ? [Konva.Filters.Blur] : [],
      blurRadius: isOutline ? 0 : ((shapeData as any).blurRadius || 0),
    };

    // --- New Appearance Model Support ---
    const hasMultipleAppearance = !isOutline && ((shapeData.fills && shapeData.fills.length > 0) || (shapeData.strokes && shapeData.strokes.length > 0));
    
    if (hasMultipleAppearance && shapeData.type !== 'group' && shapeData.type !== 'artboard' && shapeData.type !== 'image') {
        const group = new Konva.Group(commonProps);
        
        // Helper to apply fill props
        const applyFill = (props: any, fill: any) => {
            const { width, height } = getShapeDimensions(shapeData);
            if (fill.type === 'solid') {
                props.fill = fill.color;
            } else if (fill.type === 'linear-gradient') {
                props.fillLinearGradientStartPoint = fill.gradientStart || { x: 0, y: 0 };
                props.fillLinearGradientEndPoint = fill.gradientEnd || { x: width, y: height };
                props.fillLinearGradientColorStops = fill.gradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
            } else if (fill.type === 'radial-gradient') {
                props.fillRadialGradientStartPoint = fill.gradientStart || { x: 50, y: 50 };
                props.fillRadialGradientEndPoint = fill.gradientEnd || { x: 50, y: 50 };
                props.fillRadialGradientStartRadius = 0;
                props.fillRadialGradientEndRadius = 50; // simplified
                props.fillRadialGradientColorStops = fill.gradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
            } else if (fill.type === 'image' && fill.image) {
                const img = new window.Image();
                img.src = fill.image;
                props.fillPatternImage = img;
                props.fillPatternRepeat = 'repeat';
                img.onload = () => {
                    if (layerRef.current) layerRef.current.batchDraw();
                };
            }
            props.opacity = (props.opacity ?? 1) * (fill.opacity ?? 1);
        };

        // Render Fills
        shapeData.fills?.forEach(fill => {
            if (fill.visible === false) return;
            
            let node: Konva.Shape | null = null;
            const { width, height } = getShapeDimensions(shapeData);
            const props: any = { 
                width: width, 
                height: height,
                strokeEnabled: false, 
                listening: false 
            };
            applyFill(props, fill);

            if (shapeData.type === 'rect') {
                props.cornerRadius = (shapeData as any).cornerRadius;
                node = new Konva.Rect(props);
            } else if (shapeData.type === 'circle') {
                props.radius = (shapeData as any).radius;
                node = new Konva.Circle(props);
            } else if (shapeData.type === 'path') {
                props.data = (shapeData as any).data;
                node = new Konva.Path(props);
            } else if (shapeData.type === 'text') {
                props.text = (shapeData as any).text;
                props.fontSize = (shapeData as any).fontSize;
                props.fontFamily = (shapeData as any).fontFamily;
                props.fontStyle = (shapeData as any).fontWeight === 'bold' ? 'bold' : (shapeData as any).fontStyle;
                node = new Konva.Text(props);
            }
            
            if (node) group.add(node);
        });
        // Render Strokes
        shapeData.strokes?.forEach(stroke => {
            if (stroke.visible === false) return;
            
            let node: Konva.Shape | null = null;
            const { width, height } = getShapeDimensions(shapeData);
            const props: any = { 
                width: width, 
                height: height,
                fillEnabled: false, 
                listening: false,
                stroke: stroke.color,
                strokeWidth: stroke.width,
                dash: stroke.dash,
                lineCap: stroke.cap || 'butt',
                lineJoin: stroke.join || 'miter',
                opacity: stroke.opacity ?? 1
            };

            if (shapeData.type === 'rect') {
                props.cornerRadius = (shapeData as any).cornerRadius;
                node = new Konva.Rect(props);
            } else if (shapeData.type === 'circle') {
                props.radius = (shapeData as any).radius;
                node = new Konva.Circle(props);
            } else if (shapeData.type === 'path') {
                props.data = (shapeData as any).data;
                node = new Konva.Path(props);
            } else if (shapeData.type === 'text') {
                props.text = (shapeData as any).text;
                props.fontSize = (shapeData as any).fontSize;
                props.fontFamily = (shapeData as any).fontFamily;
                props.fontStyle = (shapeData as any).fontWeight === 'bold' ? 'bold' : (shapeData as any).fontStyle;
                node = new Konva.Text(props);
            }
            
            if (node) group.add(node);
        });

        return group;
    }

    if (shapeData.type === 'group' || shapeData.type === 'artboard') {
      const group = new Konva.Group({
        ...commonProps,
        width: (shapeData as any).width,
        height: (shapeData as any).height,
      });

      if (shapeData.type === 'artboard') {
          // Artboard Background
          const bg = new Konva.Rect({
              width: (shapeData as any).width,
              height: (shapeData as any).height,
              fill: (shapeData as any).fill || '#ffffff',
              listening: false
          });
          group.add(bg);

          // Artboard Clipping
          group.clipFunc((ctx) => {
              ctx.rect(0, 0, (shapeData as any).width, (shapeData as any).height);
          });
      } else if (shapeData.clipData) {
          const p = new Path2D(shapeData.clipData);
          group.clipFunc((ctx) => {
              ctx.clip(p);
          });
      } else if ((shapeData as any).clip && (shapeData as any).width && (shapeData as any).height) {
          // Rectangular Clip for Groups
          group.clipFunc((ctx) => {
              ctx.rect(0, 0, (shapeData as any).width, (shapeData as any).height);
          });
      }
      
      if (shapeData.children) {
        shapeData.children.forEach(child => {
          const childNode = renderShape(child, effectiveInside);
          if (childNode) group.add(childNode as any);
        });
      }
      node = group;
    } else if (shapeData.type === 'rect') {
      const rectProps: any = {
        ...commonProps,
        width: (shapeData as any).width || 100,
        height: (shapeData as any).height || 100,
        stroke: isOutline ? '#000000' : (shapeData as any).stroke,
        strokeWidth: isOutline ? 1 : (shapeData as any).strokeWidth,
        dash: isOutline ? [] : (shapeData as any).strokeDash,
        lineCap: (shapeData as any).lineCap || 'butt',
        lineJoin: (shapeData as any).lineJoin || 'miter',
        cornerRadius: (shapeData as any).cornerRadius,
      };

      if (isOutline) {
          rectProps.fillEnabled = false;
      } else if ((shapeData as any).fillType === 'image' && (shapeData as any).fillImage) {
          const imageObj = new window.Image();
          imageObj.src = (shapeData as any).fillImage;
          rectProps.fillPatternImage = imageObj;
          // Scale pattern to fit
          imageObj.onload = () => {
             if (layerRef.current) layerRef.current.batchDraw();
          };
      } else if ((shapeData as any).fillType === 'linear-gradient') {
          rectProps.fillLinearGradientStartPoint = (shapeData as any).fillGradientStart || { x: 0, y: 0 };
          rectProps.fillLinearGradientEndPoint = (shapeData as any).fillGradientEnd || { x: (shapeData as any).width, y: (shapeData as any).height };
          rectProps.fillLinearGradientColorStops = (shapeData as any).fillGradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
      } else if ((shapeData as any).fillType === 'radial-gradient') {
          rectProps.fillRadialGradientStartPoint = (shapeData as any).fillGradientStart || { x: (shapeData as any).width / 2, y: (shapeData as any).height / 2 };
          rectProps.fillRadialGradientEndPoint = (shapeData as any).fillGradientEnd || { x: (shapeData as any).width / 2, y: (shapeData as any).height / 2 };
          rectProps.fillRadialGradientStartRadius = 0;
          rectProps.fillRadialGradientEndRadius = Math.max((shapeData as any).width, (shapeData as any).height) / 2;
          rectProps.fillRadialGradientColorStops = (shapeData as any).fillGradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
      } else {
          rectProps.fill = (shapeData as any).fill || '#cccccc';
      }

      node = new Konva.Rect(rectProps);
      
      // Post-init fix for image fill scaling if needed
      if ((shapeData as any).fillType === 'image' && (shapeData as any).fillImage) {
          const img = new window.Image();
          img.src = (shapeData as any).fillImage;
          img.onload = () => {
              if (!node) return;
              const scale = Math.max(
                  (shapeData as any).width / img.width,
                  (shapeData as any).height / img.height
              );
              node.setAttrs({
                  fillPatternScaleX: scale,
                  fillPatternScaleY: scale,
                  fillPatternRepeat: 'no-repeat',
                  // Center it
                  fillPatternX: ((shapeData as any).width - img.width * scale) / 2,
                  fillPatternY: ((shapeData as any).height - img.height * scale) / 2
              });
              if (layerRef.current) layerRef.current.batchDraw();
          };
      }

    } else if (shapeData.type === 'path') {
        if ((shapeData as any).data) {
             const pathProps: any = {
                ...commonProps,
                data: (shapeData as any).data,
                stroke: isOutline ? '#000000' : ((shapeData as any).stroke || '#000000'),
                strokeWidth: isOutline ? 1 : ((shapeData as any).strokeWidth || 2),
                lineCap: (shapeData as any).lineCap || 'round',
                lineJoin: (shapeData as any).lineJoin || 'round',
                dash: isOutline ? [] : (shapeData as any).strokeDash,
                fillRule: (shapeData as any).fillRule || 'nonzero',
             };

             if (isOutline) {
                 pathProps.fillEnabled = false;
             } else if ((shapeData as any).fillType === 'linear-gradient') {
                 pathProps.fillLinearGradientStartPoint = (shapeData as any).fillGradientStart || { x: 0, y: 0 };
                 pathProps.fillLinearGradientEndPoint = (shapeData as any).fillGradientEnd || { x: 100, y: 100 };
                 pathProps.fillLinearGradientColorStops = (shapeData as any).fillGradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
             } else if ((shapeData as any).fillType === 'radial-gradient') {
                 pathProps.fillRadialGradientStartPoint = (shapeData as any).fillGradientStart || { x: 50, y: 50 };
                 pathProps.fillRadialGradientEndPoint = (shapeData as any).fillGradientEnd || { x: 50, y: 50 };
                 pathProps.fillRadialGradientStartRadius = 0;
                 pathProps.fillRadialGradientEndRadius = 50;
                 pathProps.fillRadialGradientColorStops = (shapeData as any).fillGradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
             } else {
                 pathProps.fill = (shapeData as any).fill;
             }

             node = new Konva.Path(pathProps);
        } else {
            node = new Konva.Line({
                ...commonProps,
                points: (shapeData as any).points || [],
                stroke: (shapeData as any).stroke || '#000000',
                strokeWidth: (shapeData as any).strokeWidth || 2,
                tension: 0.5, // Smooth curves
                lineCap: (shapeData as any).lineCap || 'round',
                lineJoin: (shapeData as any).lineJoin || 'round',
                dash: (shapeData as any).strokeDash,
            });
        }
    } else if (shapeData.type === 'circle') {
      node = new Konva.Circle({
        ...commonProps,
        radius: (shapeData as any).radius || 50,
        fill: isOutline ? null : ((shapeData as any).fill || '#cccccc'),
        stroke: isOutline ? '#000000' : (shapeData as any).stroke,
        strokeWidth: isOutline ? 1 : (shapeData as any).strokeWidth,
        dash: isOutline ? [] : (shapeData as any).strokeDash,
        lineCap: (shapeData as any).lineCap || 'butt',
        lineJoin: (shapeData as any).lineJoin || 'miter',
      });
    } else if (shapeData.type === 'text') {
      const textProps: any = {
        ...commonProps,
        text: (shapeData as any).text || 'Text',
        fontSize: (shapeData as any).fontSize || 16,
        fontFamily: (shapeData as any).fontFamily || 'Arial',
        fontStyle: (shapeData as any).fontWeight === 'bold' ? 'bold' : (shapeData as any).fontStyle || 'normal',
        textDecoration: (shapeData as any).textDecoration || '',
        align: (shapeData as any).align || 'left',
        letterSpacing: (shapeData as any).letterSpacing || 0,
        lineHeight: (shapeData as any).lineHeight || 1.2,
        stroke: isOutline ? '#000000' : (shapeData as any).stroke,
        strokeWidth: isOutline ? 1 : (shapeData as any).strokeWidth,
        dash: isOutline ? [] : (shapeData as any).strokeDash,
        lineCap: (shapeData as any).lineCap || 'butt',
        lineJoin: (shapeData as any).lineJoin || 'miter',
      };

      if ((shapeData as any).pathData) {
          textProps.data = (shapeData as any).pathData;
      }

      if (isOutline) {
          textProps.fillEnabled = false;
      } else if ((shapeData as any).fillType === 'linear-gradient') {
          textProps.fillLinearGradientStartPoint = (shapeData as any).fillGradientStart || { x: 0, y: 0 };
          textProps.fillLinearGradientEndPoint = (shapeData as any).fillGradientEnd || { x: (shapeData as any).width || 100, y: 0 }; // Text usually horizontal gradient
          textProps.fillLinearGradientColorStops = (shapeData as any).fillGradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
      } else if ((shapeData as any).fillType === 'radial-gradient') {
          // ... similar defaults
          textProps.fillRadialGradientStartPoint = (shapeData as any).fillGradientStart || { x: 50, y: 10 };
          textProps.fillRadialGradientEndPoint = (shapeData as any).fillGradientEnd || { x: 50, y: 10 };
          textProps.fillRadialGradientStartRadius = 0;
          textProps.fillRadialGradientEndRadius = 50;
          textProps.fillRadialGradientColorStops = (shapeData as any).fillGradientStops?.flatMap((s: any) => [s.offset, s.color]) || [0, 'black', 1, 'white'];
      } else {
          textProps.fill = (shapeData as any).fill || '#000000';
      }

      if ((shapeData as any).pathData) {
          node = new Konva.TextPath(textProps);
      } else {
          node = new Konva.Text(textProps);
      }
    } else if (shapeData.type === 'image') {
        const imageObj = new window.Image();
        imageObj.src = (shapeData as any).src;
        imageObj.crossOrigin = 'Anonymous'; // Enable CORS for filters

        const filters = [];
        if (!isOutline) {
             if (((shapeData as any).blur || 0) > 0 || ((shapeData as any).blurRadius || 0) > 0) filters.push(Konva.Filters.Blur);
             if ((shapeData as any).brightness) filters.push(Konva.Filters.Brighten);
             if ((shapeData as any).contrast) filters.push(Konva.Filters.Contrast);
             if ((shapeData as any).saturation || (shapeData as any).hue) filters.push(Konva.Filters.HSL);
        }
        
        node = new Konva.Image({
            ...commonProps,
            image: isOutline ? undefined : imageObj,
            width: (shapeData as any).width || 100,
            height: (shapeData as any).height || 100,
            cornerRadius: (shapeData as any).cornerRadius,
            stroke: isOutline ? '#000000' : (shapeData as any).stroke,
            strokeWidth: isOutline ? 1 : (shapeData as any).strokeWidth,
            shadowBlur: shapeData.shadowBlur,
            shadowColor: shapeData.shadowColor,
            shadowOffsetX: shapeData.shadowOffsetX,
            shadowOffsetY: shapeData.shadowOffsetY,
            filters: filters,
            brightness: (shapeData as any).brightness || 0,
            contrast: (shapeData as any).contrast || 0,
            saturation: (shapeData as any).saturation || 0,
            hue: (shapeData as any).hue || 0,
            blurRadius: ((shapeData as any).blur || 0) + ((shapeData as any).blurRadius || 0),
        });

        imageObj.onload = () => {
            if (filters.length > 0) {
                try {
                    node?.cache();
                } catch (e) {
                    console.warn('Failed to cache image for filters', e);
                }
            }
            if (layerRef.current) layerRef.current.batchDraw();
        };
    }

    if (node) {
      // Event Handling
      node.on('click tap', (e) => {
        if (activeTool === 'select' || activeTool === 'direct-select') {
            e.cancelBubble = true; // Stop propagation so stage doesn't deselect
            
            let targetId = shapeData.id;
            const isDeepSelect = e.evt.ctrlKey || e.evt.metaKey;

            if (!isDeepSelect) {
                // Walk up to find the top-level group
                let current: any = e.target;
                let maxDepth = 10; // Prevent infinite loops
                while (current.parent && current.parent !== layerRef.current && maxDepth > 0) {
                     // If we have an active group context, stop when we hit it
                     if (activeGroupId && current.parent.id() === activeGroupId) break;
                     
                     current = current.parent;
                     maxDepth--;
                }
                if (current && current.id) {
                    targetId = current.id();
                }
            }
            
            // Validate targetId before proceeding
            if (!targetId || targetId === '' || targetId === 'undefined') {
                console.warn('Invalid targetId in selection', targetId);
                return;
            }
            
            // Handle Multi-selection
            const isShift = e.evt.shiftKey;
            const currentSelectedIds = selectedIdsRef.current;
            let newSelection = currentSelectedIds ? [...currentSelectedIds] : [];
            
            if (isShift) {
                if (newSelection.includes(targetId)) {
                    newSelection = newSelection.filter(id => id !== targetId);
                } else {
                    newSelection.push(targetId);
                }
            } else {
                newSelection = [targetId];
            }
            
            onSelectionChange?.(newSelection);
        }
      });

      node.on('dragmove', (e) => {
        if (activeTool === 'select' || activeTool === 'direct-select') {
            const target = e.target;
            const layer = layerRef.current;
            if (!layer) return;

            // Disable snapping if Shift is held
            if (keys.current.shift) {
                clearGuides(layer);
                layer.batchDraw();
                return;
            }

            const guideStops = getSnapGuides(layer, target, transformerRef.current, width, height);
            const snapResult = calculateSnap(target, guideStops);

            if (snapResult.x !== null) target.x(snapResult.x);
            if (snapResult.y !== null) target.y(snapResult.y);

            drawGuides(layer, snapResult.guides);
            layer.batchDraw();
        }
      });

      node.on('dragend', (e) => {
        clearGuides(layerRef.current!);
        
        if (activeTool === 'select') {
            const currentSelectedIds = selectedIdsRef.current;
            const isMultiSelected = currentSelectedIds?.includes(shapeData.id);
            
            if (isMultiSelected && currentSelectedIds && currentSelectedIds.length > 1) {
                // Update ALL selected nodes
                const changes = new Map<string, {x: number, y: number}>();
                currentSelectedIds.forEach(id => {
                    const node = layerRef.current?.findOne(`#${id}`);
                    if (node) {
                        changes.set(id, { x: node.x(), y: node.y() });
                    }
                });

                const updateTree = (items: Shape[]): Shape[] => {
                    return items.map(item => {
                        if (changes.has(item.id)) {
                            return { ...item, ...changes.get(item.id)! };
                        }
                        if ((item as any).children) {
                            return { ...item, children: updateTree((item as any).children) } as Shape;
                        }
                        return item;
                    });
                };
                onShapesChange?.(updateTree(shapes));
            } else {
                const newX = e.target.x();
                const newY = e.target.y();
                
                const updateShapeInTree = (items: Shape[]): Shape[] => {
                    return items.map(item => {
                        if (item.id === shapeData.id) {
                            return { ...item, x: newX, y: newY };
                        }
                        if ((item as any).children) {
                            return { ...item, children: updateShapeInTree((item as any).children) } as Shape;
                        }
                        return item;
                    });
                };
                
                onShapesChange?.(updateShapeInTree(shapes));
            }
        }
      });

      node.on('transformend', (e) => {
        if (activeTool === 'select') {
            const currentSelectedIds = selectedIdsRef.current;
            const isMultiSelected = currentSelectedIds?.includes(shapeData.id);

            if (isMultiSelected && currentSelectedIds && currentSelectedIds.length > 1) {
                 // Multi-transform
                 const changes = new Map<string, any>();
                 currentSelectedIds.forEach(id => {
                    const node = layerRef.current?.findOne(`#${id}`);
                    if (node) {
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);
                        
                        changes.set(id, {
                            x: node.x(),
                            y: node.y(),
                            rotation: node.rotation(),
                            scaleX: scaleX, // We need to apply scale to width/height/fontSize
                            scaleY: scaleY
                        });
                    }
                 });

                 const updateTree = (items: Shape[]): Shape[] => {
                    return items.map(item => {
                        if (changes.has(item.id)) {
                            const change = changes.get(item.id);
                            const updates: any = {
                                x: change.x,
                                y: change.y,
                                rotation: change.rotation
                            };
                            
                            if (item.type === 'rect' || item.type === 'image' || item.type === 'group' || item.type === 'artboard') {
                                 updates.width = Math.max(5, (item as any).width * change.scaleX);
                                 updates.height = Math.max(5, (item as any).height * change.scaleY);
                            } else if (item.type === 'circle') {
                                 updates.radius = Math.max(5, (item as any).radius * change.scaleX);
                            } else if (item.type === 'text') {
                                 updates.fontSize = Math.max(5, (item as any).fontSize * change.scaleX);
                            } else if (item.type === 'path') {
                                 updates.scaleX = (item.scaleX || 1) * change.scaleX;
                                 updates.scaleY = (item.scaleY || 1) * change.scaleY;
                            }
                            return { ...item, ...updates };
                        }
                        if ((item as any).children) {
                            return { ...item, children: updateTree((item as any).children) } as Shape;
                        }
                        return item;
                    });
                };
                onShapesChange?.(updateTree(shapes));

            } else {
                const node = e.target;
                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // Reset scale to 1 to avoid compounding
                node.scaleX(1);
                node.scaleY(1);

                const newX = node.x();
                const newY = node.y();
                const newRotation = node.rotation();
                
                const updateShapeInTree = (items: Shape[]): Shape[] => {
                    return items.map(item => {
                        if (item.id === shapeData.id) {
                            const updates: any = {
                                x: newX,
                                y: newY,
                                rotation: newRotation
                            };
                            
                            if (item.type === 'rect' || item.type === 'image' || item.type === 'group' || item.type === 'artboard') {
                                updates.width = Math.max(5, (item as any).width * scaleX);
                                updates.height = Math.max(5, (item as any).height * scaleY);
                            } else if (item.type === 'circle') {
                                updates.radius = Math.max(5, (item as any).radius * scaleX);
                            } else if (item.type === 'text') {
                                updates.fontSize = Math.max(5, (item as any).fontSize * scaleX);
                            } else if (item.type === 'path') {
                                updates.scaleX = (item.scaleX || 1) * scaleX;
                                updates.scaleY = (item.scaleY || 1) * scaleY;
                            }
                            
                            return { ...item, ...updates };
                        }
                        if ((item as any).children) {
                            return { ...item, children: updateShapeInTree((item as any).children) } as Shape;
                        }
                        return item;
                    });
                };
                
                onShapesChange?.(updateShapeInTree(shapes));
            }
        }
      });
    }

    return node;
  };

  // Render shapes effect - with reconciliation (update instead of destroy/recreate)
  useEffect(() => {
    if (!layerRef.current || !transformerRef.current) return;

    const layer = layerRef.current;
    const transformer = transformerRef.current;
    const nodeMap = nodeMapRef.current;
    
    // CRITICAL: Detach transformer AND clear its internal state during updates
    try {
      transformer.nodes([]);
      transformer.detach(); // Force complete detachment
    } catch (e) {
      console.warn('Error detaching transformer:', e);
    }

    // Track which shape IDs we've seen in this render
    const currentShapeIds = new Set<string>();
    const getAllShapeIds = (shapes: Shape[]): void => {
      shapes.forEach(shape => {
        currentShapeIds.add(shape.id);
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
          getAllShapeIds(shape.children);
        }
      });
    };
    getAllShapeIds(visibleShapes);

    // Remove nodes that no longer exist in shapes - with safe cleanup
    Array.from(nodeMap.entries()).forEach(([id, node]) => {
      if (!currentShapeIds.has(id)) {
        try {
          node.off(); // Remove all event listeners
          node.destroy();
        } catch (e) {
          console.warn(`Error destroying node ${id}:`, e);
        }
        nodeMap.delete(id);
      }
    });

    // Render/update shapes
    visibleShapes.forEach(shape => {
      try {
        const existingNode = nodeMap.get(shape.id);
        
        // Check if node is still valid
        const nodeIsValid = existingNode && existingNode.getLayer();
        
        if (nodeIsValid) {
          // Node exists - just update its properties
          // Note: For complex cases (type changes, appearance system), still recreate
          const needsRecreate = 
            (shape.fills && shape.fills.length > 1) || 
            (shape.strokes && shape.strokes.length > 1) ||
            existingNode.className !== shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
          
          if (needsRecreate) {
            // Safe cleanup before recreate
            try {
              existingNode.off();
              existingNode.destroy();
            } catch (e) {
              console.warn('Error destroying node:', e);
            }
            nodeMap.delete(shape.id);
            const newNode = renderShape(shape);
            if (newNode) {
              layer.add(newNode as any);
              nodeMap.set(shape.id, newNode);
            }
          } else {
            // Just update properties - much faster!
            const commonProps = {
              x: shape.x,
              y: shape.y,
              rotation: shape.rotation || 0,
              scaleX: (shape as any).scaleX || 1,
              scaleY: (shape as any).scaleY || 1,
              opacity: shape.opacity ?? 1,
              visible: shape.visible !== false,
              draggable: (activeTool === 'select' || activeTool === 'direct-select') && !shape.locked,
            };
            
            try {
              updateNodeProperties(existingNode, shape, commonProps);
            } catch (e) {
              console.warn('Failed to update node properties, recreating:', e);
              try {
                existingNode.off();
                existingNode.destroy();
              } catch (destroyErr) {
                console.warn('Error during cleanup:', destroyErr);
              }
              nodeMap.delete(shape.id);
              const newNode = renderShape(shape);
              if (newNode) {
                layer.add(newNode as any);
                nodeMap.set(shape.id, newNode);
              }
            }
          }
        } else {
          // Node doesn't exist or is invalid - create it
          if (existingNode) {
            // Clean up invalid node reference
            nodeMap.delete(shape.id);
          }
          const newNode = renderShape(shape);
          if (newNode) {
            layer.add(newNode as any);
            nodeMap.set(shape.id, newNode);
          }
        }
      } catch (err) {
        console.error('Critical error rendering shape:', shape.id, err);
        // Try to clean up and continue
        const existingNode = nodeMap.get(shape.id);
        if (existingNode) {
          try {
            existingNode.off();
            existingNode.destroy();
          } catch (e) {
            // Ignore cleanup errors
          }
          nodeMap.delete(shape.id);
        }
      }
    });
    
    // Force layer to update DOM
    layer.batchDraw();

    // Render temporary path being drawn
    if (currentPathPoints.length > 0) {
        const d = currentPathPoints.map(p => {
            if (p.type === 'M') return `M ${p.x} ${p.y}`;
            if (p.type === 'L') return `L ${p.x} ${p.y}`;
            if (p.type === 'C') return `C ${p.cp1?.x} ${p.cp1?.y}, ${p.cp2?.x} ${p.cp2?.y}, ${p.x} ${p.y}`;
            return '';
        }).join(' ');

        const pathNode = new Konva.Path({
            data: d,
            stroke: '#0099ff',
            strokeWidth: 2,
            listening: false
        });
        layerRef.current.add(pathNode);

        // Render handles
        currentPathPoints.forEach((p, i) => {
            const anchor = new Konva.Circle({
                x: p.x,
                y: p.y,
                radius: 4,
                fill: '#ffffff',
                stroke: '#0099ff',
                strokeWidth: 1,
                listening: false
            });
            layerRef.current?.add(anchor);

            if (p.type === 'C') {
                if (p.cp2) {
                    const line = new Konva.Line({
                        points: [p.x, p.y, p.cp2.x, p.cp2.y],
                        stroke: '#0099ff',
                        strokeWidth: 1,
                        dash: [2, 2],
                        listening: false
                    });
                    layerRef.current?.add(line);
                    const cp = new Konva.Circle({
                        x: p.cp2.x,
                        y: p.cp2.y,
                        radius: 3,
                        fill: '#0099ff',
                        listening: false
                    });
                    layerRef.current?.add(cp);
                }
                const prev = currentPathPoints[i-1];
                if (prev && p.cp1) {
                     const line = new Konva.Line({
                        points: [prev.x, prev.y, p.cp1.x, p.cp1.y],
                        stroke: '#0099ff',
                        strokeWidth: 1,
                        dash: [2, 2],
                        listening: false
                    });
                    layerRef.current?.add(line);
                    const cp = new Konva.Circle({
                        x: p.cp1.x,
                        y: p.cp1.y,
                        radius: 3,
                        fill: '#0099ff',
                        listening: false
                    });
                    layerRef.current?.add(cp);
                }
            }
        });
    }



    // Move transformer to top
    transformer.moveToTop();
    
    // State health check - detect stuck renders
    const now = Date.now();
    if (now - lastRenderAttempt.current < 100) {
      consecutiveFailures.current++;
      if (consecutiveFailures.current > 10) {
        console.error('EMERGENCY: Detected render loop, clearing node map');
        // Emergency cleanup
        try {
          Array.from(nodeMap.entries()).forEach(([id, node]) => {
            try {
              node.off();
              node.destroy();
            } catch (e) {
              // ignore
            }
          });
          nodeMap.clear();
          transformer.nodes([]);
          consecutiveFailures.current = 0;
        } catch (e) {
          console.error('Emergency cleanup failed:', e);
        }
      }
    } else {
      consecutiveFailures.current = 0;
    }
    lastRenderAttempt.current = now;
    
    layerRef.current.batchDraw();

  }, [visibleShapes, shapes, activeTool, currentPathPoints]);

  // Selection and Gradient Editor Effect - with comprehensive error handling
  useEffect(() => {
      if (!layerRef.current || !transformerRef.current) return;
      
      console.log('Selection effect triggered:', { 
        selectedIds, 
        nodeMapSize: nodeMapRef.current.size,
        transformerAttached: transformerRef.current.getLayer() ? 'yes' : 'no'
      });
      
      try {
          const transformer = transformerRef.current;
          const nodeMap = nodeMapRef.current;

          // Validate transformer is still attached
          if (!transformer.getLayer()) {
              console.warn('Transformer detached from layer, reattaching');
              layerRef.current.add(transformer);
          }

          // Handle Selection - use node map for direct access
          if (selectedIds && selectedIds.length > 0) {
              const nodes: Konva.Node[] = [];
              const failedIds: string[] = [];
              
              selectedIds.forEach(id => {
                  try {
                      // Try node map first (faster), fallback to findOne
                      let node = nodeMap.get(id);
                      if (!node || !node.getLayer()) {
                          // Node is stale or destroyed, try finding it again
                          node = layerRef.current?.findOne(`#${id}`);
                          
                          // Update node map if we found it
                          if (node && node.getLayer()) {
                              nodeMap.set(id, node);
                          }
                      }
                      
                      if (node && node.getLayer() && node.isVisible()) {
                          nodes.push(node);
                      } else {
                          failedIds.push(id);
                      }
                  } catch (err) {
                      console.warn(`Error selecting node ${id}:`, err);
                      failedIds.push(id);
                  }
              });
              
              if (failedIds.length > 0) {
                  console.warn('Failed to select nodes:', failedIds);
              }
              
              if (nodes.length > 0) {
                  transformer.nodes(nodes);
                  transformer.moveToTop();
              } else {
                  console.warn('No valid nodes found for selection');
                  transformer.nodes([]);
              }
          } else {
              transformer.nodes([]);
          }
      } catch (err) {
          console.error('Critical error in selection effect:', err);
          // Emergency cleanup
          try {
              transformerRef.current?.nodes([]);
          } catch (e) {
              console.error('Failed to reset transformer:', e);
          }
      }

      // Gradient Editor Logic
      const gradientGroup = gradientGroupRef.current;
      gradientGroup?.destroy();
      gradientGroupRef.current = null;

      if (selectedIds && selectedIds.length === 1) {
        const id = selectedIds[0];
        const shapeNode = layerRef.current?.findOne(`#${id}`) as Konva.Shape;
        
        const findShape = (items: Shape[], targetId: string): Shape | null => {
            for (const item of items) {
                if (item.id === targetId) return item;
                if ((item.type === 'group' || item.type === 'artboard') && item.children) {
                    const found = findShape(item.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };
        const shapeData = findShape(shapes, id);

        if (shapeNode && shapeData && (shapeData as any).fillType === 'linear-gradient') {
             const group = new Konva.Group({ name: 'gradient-editor' });
             layerRef.current?.add(group);
             gradientGroupRef.current = group;

             const start = shapeNode.getAttr('fillLinearGradientStartPoint') || { x: 0, y: 0 };
             const end = shapeNode.getAttr('fillLinearGradientEndPoint') || { x: (shapeData as any).width || 100, y: (shapeData as any).height || 100 };

             const transform = shapeNode.getAbsoluteTransform();
             const absStart = transform.point(start);
             const absEnd = transform.point(end);

             const line = new Konva.Line({
                 points: [absStart.x, absStart.y, absEnd.x, absEnd.y],
                 stroke: '#000000',
                 strokeWidth: 1,
                 dash: [4, 4]
             });
             
             const startHandle = new Konva.Circle({
                 x: absStart.x,
                 y: absStart.y,
                 radius: 6,
                 fill: '#ffffff',
                 stroke: '#000000',
                 strokeWidth: 1,
                 draggable: true
             });

             const endHandle = new Konva.Circle({
                 x: absEnd.x,
                 y: absEnd.y,
                 radius: 6,
                 fill: '#000000',
                 stroke: '#ffffff',
                 strokeWidth: 1,
                 draggable: true
             });

             group.add(line);
             group.add(startHandle);
             group.add(endHandle);

             const updateGradient = () => {
                 const newAbsStart = { x: startHandle.x(), y: startHandle.y() };
                 const newAbsEnd = { x: endHandle.x(), y: endHandle.y() };
                 
                 line.points([newAbsStart.x, newAbsStart.y, newAbsEnd.x, newAbsEnd.y]);
                 
                 const invTransform = shapeNode.getAbsoluteTransform().copy().invert();
                 const newStart = invTransform.point(newAbsStart);
                 const newEnd = invTransform.point(newAbsEnd);
                 
                 shapeNode.setAttrs({
                     fillLinearGradientStartPoint: newStart,
                     fillLinearGradientEndPoint: newEnd
                 });
                 layerRef.current?.batchDraw();
                 return { newStart, newEnd };
             };

             startHandle.on('dragmove', updateGradient);
             endHandle.on('dragmove', updateGradient);

             const handleDragEnd = () => {
                 const { newStart, newEnd } = updateGradient();
                 const updateShapeInTree = (items: Shape[]): Shape[] => {
                    return items.map(item => {
                        if (item.id === id) {
                            return { 
                                ...item, 
                                fillGradientStart: newStart,
                                fillGradientEnd: newEnd
                            };
                        }
                        if ((item as any).children) {
                            return { ...item, children: updateShapeInTree((item as any).children) } as Shape;
                        }
                        return item;
                    });
                };
                onShapesChange?.(updateShapeInTree(shapes));
             };

             startHandle.on('dragend', handleDragEnd);
             endHandle.on('dragend', handleDragEnd);
             
             // Sync on shape move (basic)
             shapeNode.on('dragmove transform', () => {
                 const t = shapeNode.getAbsoluteTransform();
                 const s = shapeNode.getAttr('fillLinearGradientStartPoint') || { x: 0, y: 0 };
                 const e = shapeNode.getAttr('fillLinearGradientEndPoint') || { x: 100, y: 100 };
                 const as = t.point(s);
                 const ae = t.point(e);
                 startHandle.position(as);
                 endHandle.position(ae);
                 line.points([as.x, as.y, ae.x, ae.y]);
             });
        }
      }

      transformerRef.current?.moveToTop();
      gradientGroupRef.current?.moveToTop();
      layerRef.current.batchDraw();
  }, [selectedIds, shapes, visibleShapes, activeTool]);

  // Drawing Logic (Rect/Text/Pen)
  useEffect(() => {
    if (!stageRef.current) return;
    const stage = stageRef.current;

    const handleMouseDown = () => {
        if (activeTool === 'select' || activeTool === 'direct-select') return;
        
        // Transform pointer position to local stage coordinates (accounting for zoom/pan)
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point(stage.getPointerPosition() || {x:0, y:0});

        if (pos) {
            if (activeTool === 'type-on-path') {
                const pointerPos = stage.getPointerPosition();
                if (!pointerPos) return;
                
                const clickedNode = stage.getIntersection(pointerPos);
                if (clickedNode) {
                    const shapeId = clickedNode.id();
                    const findShape = (items: Shape[]): Shape | null => {
                        for (const item of items) {
                            if (item.id === shapeId) return item;
                            if ((item.type === 'group' || item.type === 'artboard') && item.children) {
                                const found = findShape(item.children);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    
                    const targetShape = findShape(shapes);
                    if (targetShape) {
                        let pathData = '';
                        if (targetShape.type === 'path') pathData = (targetShape as any).data;
                        else if (targetShape.type === 'circle') {
                             const r = (targetShape as any).radius;
                             // Circle path approximation
                             pathData = `M -${r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 -${r} 0`; 
                        } else if (targetShape.type === 'rect') {
                             const w = (targetShape as any).width;
                             const h = (targetShape as any).height;
                             pathData = `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
                        }

                        if (pathData) {
                            const newText: Shape = {
                                id: `text-${Date.now()}`,
                                type: 'text',
                                x: targetShape.x,
                                y: targetShape.y,
                                text: 'Type on Path',
                                fontSize: 20,
                                fontFamily: 'Arial',
                                fontWeight: 'normal',
                                fill: '#000000',
                                pathData: pathData,
                                align: 'center'
                            };
                            onShapesChange?.([...shapes, newText]);
                        }
                    }
                }
                return;
            }

            if (activeTool === 'pen') {
                if (!isDrawing) {
                    // Start new path
                    setIsDrawing(true);
                    // Start with Move command
                    setCurrentPathPoints([{ x: pos.x, y: pos.y, type: 'M' }]); 
                    setDragStartPos(pos);
                } else {
                    // Add Line command initially, will become Curve if dragged
                    setCurrentPathPoints(prev => [...prev, { x: pos.x, y: pos.y, type: 'L' }]);
                    setDragStartPos(pos);
                }
            } else if (activeTool === 'shape-builder') {
                setStartPos(pos);
                setIsDrawing(true);
                // Initialize touched shapes
                (window as any).touchedShapes = new Set<string>();
            } else {
                setStartPos(pos);
                setIsDrawing(true);
            }
        }
    };

    const handleMouseMove = () => {
        if (!isDrawing) return;
        
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point(stage.getPointerPosition() || {x:0, y:0});
        
        if (!pos) return;

        if (activeTool === 'shape-builder') {
            // Draw a trail
            const trail = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: 5,
                fill: 'rgba(0, 153, 255, 0.5)',
                listening: false
            });
            layerRef.current?.add(trail);
            
            // Detect intersection
            const pointerPos = stage.getPointerPosition();
            if (pointerPos) {
                const shape = stage.getIntersection(pointerPos);
                if (shape && shape.id()) {
                    const id = shape.id();
                    // Only add if it's one of the selected shapes (if any are selected), or any shape if none selected
                    if (selectedIds && selectedIds.length > 0) {
                        if (selectedIds.includes(id)) {
                            (window as any).touchedShapes.add(id);
                        }
                    } else {
                        (window as any).touchedShapes.add(id);
                    }
                }
            }
            return;
        }

        if (activeTool === 'pen') {
            // If dragging, update the last point to be a Curve
            if (dragStartPos) {
                const dx = pos.x - dragStartPos.x;
                const dy = pos.y - dragStartPos.y;
                
                // Only convert to curve if dragged significantly
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    setCurrentPathPoints(prev => {
                        const last = prev[prev.length - 1];
                        const secondLast = prev[prev.length - 2];
                        
                        // Calculate control points based on drag
                        // CP2 is opposite to drag direction relative to anchor
                        const cp2 = { x: last.x - dx, y: last.y - dy };
                        // CP1 depends on previous point
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
        }
    };

    const handleMouseUp = () => {
        if (!isDrawing || activeTool === 'select' || activeTool === 'direct-select') return;
        
        if (activeTool === 'shape-builder') {
            setIsDrawing(false);
            const touched = Array.from((window as any).touchedShapes || []) as string[];
            if (touched.length >= 2) {
                onMergeShapes?.(touched);
            }
            // Clear trails
            layerRef.current?.find('Circle').forEach(c => {
                if ((c as Konva.Shape).fill() === 'rgba(0, 153, 255, 0.5)') c.destroy();
            });
            return;
        }

        if (activeTool === 'pen') {
            setDragStartPos(null);
            return;
        }

        setIsDrawing(false);
        
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = transform.point(stage.getPointerPosition() || {x:0, y:0});
        
        if (!pos) return;

        const width = Math.abs(pos.x - startPos.x);
        const height = Math.abs(pos.y - startPos.y);
        const finalX = Math.min(startPos.x, pos.x);
        const finalY = Math.min(startPos.y, pos.y);

        if (activeTool === 'artboard') {
             const newArtboard: Shape = {
                id: `artboard-${Date.now()}`,
                type: 'artboard',
                x: finalX,
                y: finalY,
                width: width,
                height: height,
                fill: '#ffffff',
                name: 'Artboard ' + (shapes.filter(s => s.type === 'artboard').length + 1),
                children: []
            };
            onShapesChange?.([...shapes, newArtboard]);
            return;
        }

        // Check if we dropped inside an Artboard
        const targetArtboard = shapes.find(s => 
            s.type === 'artboard' && 
            finalX >= s.x && finalX <= s.x + (s as any).width &&
            finalY >= s.y && finalY <= s.y + (s as any).height
        );

        // Create new shape
        const newShape: Shape = {
            id: `${activeTool}-${Date.now()}`,
            type: activeTool as any,
            x: targetArtboard ? finalX - targetArtboard.x : finalX,
            y: targetArtboard ? finalY - targetArtboard.y : finalY,
            width: width,
            height: height,
            fill: '#cccccc',
            name: 'New Shape'
        };
        
        if (activeTool === 'text') {
            (newShape as any).text = 'Type here';
            (newShape as any).fontSize = 20;
            newShape.fill = '#ffffff';
        }

        if (targetArtboard) {
            const updateTree = (items: Shape[]): Shape[] => {
                return items.map(item => {
                    if (item.id === targetArtboard.id) {
                        return { ...item, children: [...((item as any).children || []), newShape] } as Shape;
                    }
                    return item;
                });
            };
            onShapesChange?.(updateTree(shapes));
        } else {
            onShapesChange?.([...shapes, newShape]);
        }
    };

    // Finish Pen Tool & Isolation Mode
    const handleDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (activeTool === 'pen' && isDrawing) {
            setIsDrawing(false);
            if (currentPathPoints.length > 1) {
                // Convert points to SVG Path Data
                const d = reconstructPathData(currentPathPoints);

                const newShape: Shape = {
                    id: `path-${Date.now()}`,
                    type: 'path',
                    x: 0,
                    y: 0,
                    data: d,
                    stroke: '#ffffff',
                    strokeWidth: 2,
                    name: 'Path'
                };
                onShapesChange?.([...shapes, newShape]);
            }
            setCurrentPathPoints([]);
            setDragStartPos(null);
            return;
        }

        if (activeTool === 'select') {
            const target = e.target;
            if (target === stage) {
                onExitGroup?.();
            } else {
                let group = target.getParent();
                while (group && group !== layerRef.current) {
                    if (group.getClassName() === 'Group') {
                        const groupId = group.id();
                        if (groupId && groupId !== activeGroupId) {
                             onEnterGroup?.(groupId);
                             e.cancelBubble = true;
                             return;
                        }
                    }
                    group = group.getParent();
                }
            }
        }
    };

    stage.on('mousedown touchstart', handleMouseDown);
    stage.on('mousemove touchmove', handleMouseMove);
    stage.on('mouseup touchend', handleMouseUp);
    stage.on('dblclick dbltap', handleDoubleClick);

    return () => {
        stage.off('mousedown touchstart', handleMouseDown);
        stage.off('mousemove touchmove', handleMouseMove);
        stage.off('mouseup touchend', handleMouseUp);
        stage.off('dblclick dbltap', handleDoubleClick);
    };
  }, [isDrawing, activeTool, startPos, shapes, currentPathPoints]);

  return (
      <div 
        ref={containerRef} 
        className="w-full h-full bg-[#1e1e1e]" 
        style={{ 
            filter: viewMode === 'cmyk' ? 'grayscale(0.1) contrast(0.9) sepia(0.1)' : 'none' 
        }}
      />
  );
}
