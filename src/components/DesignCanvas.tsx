'use client';

// Ensure React is available for react-konva BEFORE importing it
if (typeof window !== 'undefined') {
  (window as any).React = require('react');
}

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import Konva from 'konva';
import { Stage, Layer, Rect, Line, Group, Text, Path, Image as KonvaImage, Transformer } from 'react-konva';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Shape, ShapeType, BaseShape, RectShape, PathShape, ImageShape, GroupShape, ArtboardShape, TextShape, InstanceShape } from '../types/shapes';
import { getShapeDimensions } from '@/utils/treeUtils';

interface DesignCanvasProps {
  tool: 'select' | 'rect' | 'pen' | 'text' | 'artboard';
  shapes: Shape[];
  components?: Record<string, Shape>;
  onShapesChange: (shapes: Shape[]) => void;
  onSelectionChange: (id: string | null) => void;
  selectedId: string | null;
  exportRequest?: { format: 'png' | 'jpg', scale: number } | null;
  onExportComplete?: () => void;
  viewMode?: 'design' | 'preview';
}

// Helper component to render images correctly
const URLImage = ({ shape, commonProps, onChange }: { shape: ImageShape, commonProps: any, onChange: (newAttrs: any) => void }) => {
  const [img, setImg] = useState<HTMLImageElement | undefined>(shape.imageElement);

  useEffect(() => {
    if (!img && shape.src) {
      const image = new window.Image();
      image.src = shape.src;
      image.onload = () => {
        setImg(image);
      };
    }
  }, [shape.src]);

  return (
    <KonvaImage
      {...commonProps}
      image={img}
      width={shape.width}
      height={shape.height}
    />
  );
};

// Recursive Shape Renderer
const ShapeRenderer = ({ 
    shape, 
    isSelected, 
    onSelect, 
    onChange,
    onDragMove,
    onDragEnd,
    onDoubleClick,
    components,
    viewMode = 'design'
}: { 
    shape: Shape, 
    isSelected: boolean, 
    onSelect: (id: string) => void, 
    onChange: (newShape: Shape) => void,
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void,
    onDoubleClick?: (id: string, e: Konva.KonvaEventObject<MouseEvent>) => void,
    components?: Record<string, Shape>,
    viewMode?: 'design' | 'preview'
}) => {
    if (shape.visible === false) return null;

    const handleInteraction = () => {
        if (shape.interaction?.type === 'navigate' && shape.interaction.targetId) {
            // In a real app, this would change the route or scroll
            console.log(`[Interaction] Navigating to ${shape.interaction.targetId} with transition ${shape.interaction.transition}`);
            const target = document.getElementById(shape.interaction.targetId); // Fallback for demo
            if (target) target.scrollIntoView({ behavior: 'smooth' });
            else alert(`Navigate to Artboard: ${shape.interaction.targetId}`);
        }
    };

    const commonProps = {
        id: shape.id,
        locked: shape.locked,
        x: shape.x,
        y: shape.y,
        rotation: shape.rotation,
        opacity: shape.opacity ?? 1,
        shadowBlur: shape.shadowBlur ?? 0,
        shadowColor: shape.shadowColor ?? 'black',
        shadowOffsetX: shape.shadowOffsetX ?? 0,
        shadowOffsetY: shape.shadowOffsetY ?? 0,
        draggable: viewMode === 'design' && !shape.locked,
        listening: true, // Always listen for clicks
        onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true;
            if (viewMode === 'preview') {
                handleInteraction();
            } else {
                onSelect(shape.id);
            }
        },
        onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true;
            if (viewMode === 'design' && onDoubleClick) onDoubleClick(shape.id, e);
        },
        onDragMove: viewMode === 'design' ? onDragMove : undefined,
        onDragEnd: viewMode === 'design' ? onDragEnd : undefined,
        onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
            if (viewMode !== 'design') return;
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            
            const updates: any = {
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
            };

            if (shape.type === 'rect' || shape.type === 'image' || shape.type === 'artboard' || shape.type === 'instance') {
                const { width, height } = getShapeDimensions(shape);
                updates.width = Math.max(5, width * scaleX);
                updates.height = Math.max(5, height * scaleY);
            } else if (shape.type === 'text') {
                updates.width = Math.max(5, (node as any).width() * scaleX);
            }
            
            onChange({ ...shape, ...updates });
        }
    };

    if (shape.type === 'artboard') {
        return (
            <Group
                {...commonProps}
            >
                {/* Label - Only in Design Mode */}
                {viewMode === 'design' && (
                    <Text 
                        text={shape.name} 
                        y={-20} 
                        fontSize={12} 
                        fill="#888" 
                    />
                )}
                {/* Background */}
                <Rect
                    width={shape.width}
                    height={shape.height}
                    fill={shape.fill}
                    shadowColor="black"
                    shadowBlur={10}
                    shadowOpacity={0.1}
                />
                {/* Content Container with Clip */}
                <Group clipX={0} clipY={0} clipWidth={shape.width} clipHeight={shape.height}>
                    {shape.children.map((child) => (
                        <ShapeRenderer
                            key={child.id}
                            shape={child}
                            isSelected={false} 
                            onSelect={onSelect} 
                            onChange={(newChild) => {
                                const newChildren = shape.children.map(c => c.id === newChild.id ? newChild : c);
                                onChange({ ...shape, children: newChildren });
                            }}
                            onDragMove={onDragMove}
                            onDragEnd={onDragEnd}
                            onDoubleClick={onDoubleClick}
                            components={components}
                            viewMode={viewMode}
                        />
                    ))}
                </Group>
            </Group>
        );
    }

    if (shape.type === 'group') {
        return (
            <Group
                {...commonProps}
                clip={shape.clip}
            >
                {shape.children.map((child) => (
                    <ShapeRenderer
                        key={child.id}
                        shape={child}
                        isSelected={false} 
                        onSelect={onSelect} 
                        onChange={(newChild) => {
                            const newChildren = shape.children.map(c => c.id === newChild.id ? newChild : c);
                            onChange({ ...shape, children: newChildren });
                        }}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        onDoubleClick={onDoubleClick}
                        components={components}
                        viewMode={viewMode}
                    />
                ))}
            </Group>
        );
    }

    if (shape.type === 'instance') {
        const master = components?.[shape.componentId];
        if (!master) return <Group {...commonProps}><Text text="Missing Component" fill="red" /></Group>;
        
        const { width: masterWidth, height: masterHeight } = getShapeDimensions(master);
        
        const scaleX = shape.width / masterWidth;
        const scaleY = shape.height / masterHeight;

        // Helper to apply overrides recursively
        const renderWithOverrides = (child: Shape): React.ReactNode => {
            const override = shape.overrides?.[child.id] || {};
            const overriddenChild = { ...child, ...override } as Shape;
            
            // If it's a group, we need to recurse
            if ((overriddenChild.type === 'group' || overriddenChild.type === 'artboard') && overriddenChild.children) {
                 return (
                    <Group 
                        key={child.id} 
                        x={overriddenChild.x} 
                        y={overriddenChild.y} 
                        rotation={overriddenChild.rotation}
                        opacity={overriddenChild.opacity}
                        clip={overriddenChild.type === 'group' ? overriddenChild.clip : undefined}
                    >
                        {overriddenChild.children.map(grandChild => renderWithOverrides(grandChild))}
                    </Group>
                 );
            }

            return (
                <ShapeRenderer
                    key={child.id}
                    shape={overriddenChild}
                    isSelected={false}
                    onSelect={() => onSelect(shape.id)}
                    onChange={() => {}}
                    onDragMove={() => {}}
                    onDragEnd={() => {}}
                    components={components}
                    viewMode={viewMode}
                />
            );
        };

        return (
            <Group {...commonProps} scaleX={scaleX} scaleY={scaleY}>
                {(master.type === 'group' || master.type === 'artboard') ? (
                    <Group clip={master.type === 'group' ? master.clip : undefined}>
                        {master.children.map((child) => renderWithOverrides(child))}
                    </Group>
                ) : (
                     renderWithOverrides(master)
                )}
            </Group>
        );
    }

    if (shape.type === 'rect') {
        return (
            <Rect
                {...commonProps}
                width={shape.width}
                height={shape.height}
                fill={shape.fill}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                cornerRadius={shape.cornerRadius}
            />
        );
    }

    if (shape.type === 'path') {
        if (shape.data) {
             return (
                <Path
                    {...commonProps}
                    data={shape.data}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    fill={shape.fill}
                    lineCap="round"
                    lineJoin="round"
                />
            );
        }
        return (
            <Line
                {...commonProps}
                points={shape.points || []}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                tension={0}
                lineCap="round"
                lineJoin="round"
            />
        );
    }

    if (shape.type === 'image') {
        return (
            <URLImage 
                shape={shape} 
                commonProps={commonProps}
                onChange={onChange} 
            />
        );
    }

    if (shape.type === 'text') {
        return (
            <Text
                {...commonProps}
                text={shape.text}
                fontSize={shape.fontSize}
                fontFamily={shape.fontFamily}
                fontStyle={shape.fontWeight}
                fill={shape.fill}
                align={shape.align}
                width={shape.width}
            />
        );
    }

    return null;
};

const findShape = (shapes: Shape[], id: string): Shape | null => {
    for (const shape of shapes) {
        if (shape.id === id) return shape;
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            const found = findShape(shape.children, id);
            if (found) return found;
        }
    }
    return null;
};

export default function DesignCanvas({ tool, shapes, onShapesChange, onSelectionChange, selectedId, components, exportRequest, onExportComplete, viewMode = 'design' }: DesignCanvasProps) {
  const [newShape, setNewShape] = useState<Shape | null>(null);
  const [guides, setGuides] = useState<Array<{ vertical: boolean, pos: number }>>([]);
  
  // Text Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingPos, setEditingPos] = useState({ x: 0, y: 0, width: 0, height: 0, rotation: 0 });
  const [editingStyle, setEditingStyle] = useState<any>({});
  
  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Finish drawing path on Enter/Esc
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.key === 'Enter' || e.key === 'Escape') && newShape?.type === 'path') {
              // Finish path
              const points = (newShape as PathShape).points || [];
              // Remove the last point which is the "rubber band" point
              const finalPoints = points.slice(0, points.length - 2);
              
              if (finalPoints.length >= 4) { // At least 2 points (4 coords)
                  // Convert to SVG Path Data
                  let d = `M ${finalPoints[0]} ${finalPoints[1]}`;
                  for (let i = 2; i < finalPoints.length; i += 2) {
                      d += ` L ${finalPoints[i]} ${finalPoints[i+1]}`;
                  }

                  const finalShape: PathShape = {
                      ...newShape as PathShape,
                      points: undefined, // Clear legacy points
                      data: d
                  };
                  onShapesChange([...shapes, finalShape]);
              }
              setNewShape(null);
              isDrawing.current = false;
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [newShape, shapes, onShapesChange]);

  // Export Handler
  useEffect(() => {
    if (exportRequest && stageRef.current) {
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
        
        if (onExportComplete) onExportComplete();
    }
  }, [exportRequest, onExportComplete]);

  // Handle selection
  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne('#' + selectedId);
      if (node && !node.attrs.locked) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
      } else {
        transformerRef.current.nodes([]);
      }
    } else {
      transformerRef.current?.nodes([]);
    }
  }, [selectedId, shapes]);

  // Snapping Logic
  const getLineGuideStops = (skipShapeId: string) => {
      const vertical = [0, window.innerWidth / 2, window.innerWidth];
      const horizontal = [0, window.innerHeight / 2, window.innerHeight];

      // Flatten shapes for snapping (simplified, only top level for now)
      // Flatten shapes for snapping (simplified, only top level for now)
      shapes.forEach(guideItem => {
          if (guideItem.id === skipShapeId) return;
          
          const { width, height } = getShapeDimensions(guideItem);
          const box = {
              x: guideItem.x,
              y: guideItem.y,
              width: width,
              height: height,
          };

          vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
          horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
      });
      return { vertical, horizontal };
  };

  const getObjectSnappingEdges = (node: Konva.Node) => {
      const box = node.getClientRect();
      const absPos = node.absolutePosition();
      
      return {
          vertical: [
              { guide: Math.round(box.x), offset: Math.round(absPos.x - box.x), snap: 'start' },
              { guide: Math.round(box.x + box.width / 2), offset: Math.round(absPos.x - box.x - box.width / 2), snap: 'center' },
              { guide: Math.round(box.x + box.width), offset: Math.round(absPos.x - box.x - box.width), snap: 'end' },
          ],
          horizontal: [
              { guide: Math.round(box.y), offset: Math.round(absPos.y - box.y), snap: 'start' },
              { guide: Math.round(box.y + box.height / 2), offset: Math.round(absPos.y - box.y - box.height / 2), snap: 'center' },
              { guide: Math.round(box.y + box.height), offset: Math.round(absPos.y - box.y - box.height), snap: 'end' },
          ],
      };
  };

  const getGuides = (lineGuideStops: any, itemBounds: any) => {
      const resultV: any[] = [];
      const resultH: any[] = [];
      const GUIDELINE_OFFSET = 5;

      lineGuideStops.vertical.forEach((lineGuide: number) => {
          itemBounds.vertical.forEach((itemBound: any) => {
              const diff = Math.abs(lineGuide - itemBound.guide);
              if (diff < GUIDELINE_OFFSET) {
                  resultV.push({ lineGuide: lineGuide, diff: diff, snap: itemBound.snap, offset: itemBound.offset });
              }
          });
      });

      lineGuideStops.horizontal.forEach((lineGuide: number) => {
          itemBounds.horizontal.forEach((itemBound: any) => {
              const diff = Math.abs(lineGuide - itemBound.guide);
              if (diff < GUIDELINE_OFFSET) {
                  resultH.push({ lineGuide: lineGuide, diff: diff, snap: itemBound.snap, offset: itemBound.offset });
              }
          });
      });

      const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
      const minH = resultH.sort((a, b) => a.diff - b.diff)[0];

      return { minV, minH };
  };

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      // Clear guides
      setGuides([]);
      
      const lineGuideStops = getLineGuideStops(node.id());
      const itemBounds = getObjectSnappingEdges(node);
      const guides = getGuides(lineGuideStops, itemBounds);

      const newGuides = [];

      if (guides.minV) {
          node.x(guides.minV.lineGuide + guides.minV.offset);
          newGuides.push({ vertical: true, pos: guides.minV.lineGuide });
      }

      if (guides.minH) {
          node.y(guides.minH.lineGuide + guides.minH.offset);
          newGuides.push({ vertical: false, pos: guides.minH.lineGuide });
      }

      setGuides(newGuides);
  };

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      setGuides([]);
      // Update shape in state
      const node = e.target;
      const shape = shapes.find(s => s.id === node.id());
      if (shape) {
          const newShapes = shapes.map(s => s.id === shape.id ? { ...s, x: node.x(), y: node.y() } : s);
          onShapesChange(newShapes);
      }
  };

  // Handle Image Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    stage.setPointersPositions(e);
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Adjust for zoom/pan
    const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY()
    };

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const src = event.target?.result as string;
            const img = new window.Image();
            img.src = src;
            img.onload = () => {
                const newImage: ImageShape = {
                    id: `image-${Date.now()}`,
                    type: 'image',
                    x: stagePos.x,
                    y: stagePos.y,
                    width: img.width > 500 ? 500 : img.width, // Limit initial size
                    height: img.height > 500 ? 500 * (img.height / img.width) : img.height,
                    src: src,
                    imageElement: img
                };
                onShapesChange([...shapes, newImage]);
            };
        };
        reader.readAsDataURL(file);
    }
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    setScale(newScale);
    setPosition(newPos);
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Middle click or Space+Click for panning
    if (e.evt.button === 1) return; 
    if (viewMode === 'preview') return;

    if (tool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        onSelectionChange(null);
        setEditingId(null); // Stop editing if clicked elsewhere
      }
      return;
    }

    const stage = e.target.getStage();
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;

    isDrawing.current = true;

    if (tool === 'rect') {
      const id = `rect-${Date.now()}`;
      const shape: RectShape = {
        id,
        type: 'rect',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        fill: '#3b82f6', // Tailwind blue-500
      };
      setNewShape(shape);
      onSelectionChange(null);
    } else if (tool === 'pen') {
        if (newShape && newShape.type === 'path') {
            // Add point to existing path
            const currentPoints = (newShape as PathShape).points || [];
            setNewShape({
                ...newShape,
                points: [...currentPoints, pos.x, pos.y]
            });
        } else {
            // Start new path
            const id = `path-${Date.now()}`;
            const shape: PathShape = {
                id,
                type: 'path',
                x: 0,
                y: 0,
                points: [pos.x, pos.y, pos.x, pos.y],
                stroke: '#ffffff',
                strokeWidth: 2
            };
            setNewShape(shape);
        }
    } else if (tool === 'artboard') {
        const id = `artboard-${Date.now()}`;
        const shape: ArtboardShape = {
            id,
            type: 'artboard',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            fill: '#ffffff',
            children: [],
            name: 'Artboard 1'
        };
        setNewShape(shape);
        onSelectionChange(null);
    } else if (tool === 'text') {
        const id = `text-${Date.now()}`;
        const shape: TextShape = {
            id,
            type: 'text',
            x: pos.x,
            y: pos.y,
            text: 'Type something...',
            fontSize: 20,
            fontFamily: 'Arial',
            fontWeight: 'normal',
            fill: '#ffffff',
            align: 'left'
        };
        onShapesChange([...shapes, shape]);
        onSelectionChange(shape.id);
        // Immediately start editing
        // We need to wait for render to get position, but we can approximate
        // Actually, let's just select it. User can double click to edit.
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current || !newShape) return;

    const stage = e.target.getStage();
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return;

    if (newShape.type === 'rect' || newShape.type === 'artboard') {
        setNewShape({
            ...newShape,
            width: pos.x - newShape.x,
            height: pos.y - newShape.y,
        });
    } else if (newShape.type === 'path') {
        // Update the last point (the moving point)
        const currentPoints = (newShape as PathShape).points || [];
        const newPoints = [...currentPoints];
        newPoints[newPoints.length - 2] = pos.x;
        newPoints[newPoints.length - 1] = pos.y;
        
        setNewShape({
            ...newShape,
            points: newPoints
        });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing.current && newShape) {
      // For Pen tool, we don't finish on mouse up
      if (newShape.type === 'path') return;

      let finalShape = { ...newShape };
      
      if (finalShape.type === 'rect' || finalShape.type === 'artboard') {
        // Normalize negative width/height
        if (finalShape.width < 0) {
            finalShape.x += finalShape.width;
            finalShape.width = Math.abs(finalShape.width);
        }
        if (finalShape.height < 0) {
            finalShape.y += finalShape.height;
            finalShape.height = Math.abs(finalShape.height);
        }
      }
      
      onShapesChange([...shapes, finalShape]);
      setNewShape(null);
      isDrawing.current = false;
      onSelectionChange(finalShape.id);
    }
  };

  const handleShapeChange = (updatedShape: Shape) => {
      const newShapes = shapes.map(s => s.id === updatedShape.id ? updatedShape : s);
      onShapesChange(newShapes);
  };

  const handleDoubleClick = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      const shape = shapes.find(s => s.id === id); // Note: this only finds top level, need recursive find if we want to edit nested text
      // Actually, we can use the node from event
      const node = e.target;
      if (node.getClassName() === 'Text') {
          const textNode = node as Konva.Text;
          const absPos = textNode.absolutePosition();
          const stage = textNode.getStage();
          if (!stage) return;
          
          const containerRect = stage.container().getBoundingClientRect();
          
          setEditingId(id);
          setEditingText(textNode.text());
          setEditingPos({
              x: containerRect.left + absPos.x,
              y: containerRect.top + absPos.y,
              width: textNode.width() * textNode.scaleX(),
              height: textNode.height() * textNode.scaleY(),
              rotation: textNode.rotation()
          });
          setEditingStyle({
              fontSize: textNode.fontSize() * textNode.scaleY(),
              fontFamily: textNode.fontFamily(),
              color: textNode.fill(),
              textAlign: textNode.align(),
              lineHeight: textNode.lineHeight(),
          });
      }
  };

  const handleTextEditEnd = () => {
      if (editingId) {
          // Find shape recursively
          // Since we don't have recursive find here easily available (it's in page.tsx), 
          // we might need to pass a callback that handles the update.
          // But wait, handleShapeChange only updates top level.
          // We need a way to update nested shapes from here.
          // Actually, let's just assume for now we only edit top level or we pass a recursive updater.
          // Better: DesignCanvas should just call onShapesChange with the full new tree.
          // But DesignCanvas doesn't know how to traverse.
          // Let's use a trick: We pass the ID and the new text to a prop onTextUpdate.
          
          // For now, let's just update if it's top level.
          // To support nested, we need to lift the find/update logic to DesignCanvas or pass it down.
          // Let's assume the user will implement recursive update in onShapesChange if they pass a tree.
          // Wait, onShapesChange expects the full array.
          
          // I'll implement a simple recursive finder here just for this.
          const updateRecursive = (items: Shape[]): Shape[] => {
              return items.map(item => {
                  if (item.id === editingId) {
                      return { ...item, text: editingText } as TextShape;
                  }
                  if ((item.type === 'group' || item.type === 'artboard') && item.children) {
                      return { ...item, children: updateRecursive(item.children) };
                  }
                  return item;
              });
          };
          
          onShapesChange(updateRecursive(shapes));
          setEditingId(null);
      }
  };

  const handleZoom = (direction: 1 | -1) => {
      const stage = stageRef.current;
      if (!stage) return;
      
      const scaleBy = 1.2;
      const oldScale = stage.scaleX();
      const center = {
          x: stage.width() / 2,
          y: stage.height() / 2,
      };

      const relatedTo = {
          x: (center.x - stage.x()) / oldScale,
          y: (center.y - stage.y()) / oldScale,
      };

      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      
      stage.scale({ x: newScale, y: newScale });

      const newPos = {
          x: center.x - relatedTo.x * newScale,
          y: center.y - relatedTo.y * newScale,
      };
      stage.position(newPos);
      stage.batchDraw();
      setScale(newScale);
      setPosition(newPos);
  };

  const handleResetZoom = () => {
      const stage = stageRef.current;
      if (!stage) return;
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      setScale(1);
      setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
        className="w-full h-full bg-[#1e1e1e] relative"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        width={window.innerWidth - 460}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        ref={stageRef}
        draggable={tool === 'select' && !selectedId}
      >
        <Layer>
          {shapes.map((shape) => (
            <ShapeRenderer
                key={shape.id}
                shape={shape}
                isSelected={selectedId === shape.id}
                onSelect={onSelectionChange}
                onChange={handleShapeChange}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onDoubleClick={handleDoubleClick}
                components={components}
            />
          ))}
          
          {/* Render the shape currently being drawn */}
          {newShape && (
             <ShapeRenderer
                shape={newShape}
                isSelected={false}
                onSelect={() => {}}
                onChange={() => {}}
                onDragMove={() => {}}
                onDragEnd={() => {}}
                components={components}
             />
          )}

          {/* Render Guides */}
          {guides.map((guide, i) => (
              <Line
                  key={i}
                  points={guide.vertical ? [guide.pos, 0, guide.pos, window.innerHeight] : [0, guide.pos, window.innerWidth, guide.pos]}
                  stroke="#ff00ff"
                  strokeWidth={1}
                  dash={[4, 4]}
              />
          ))}

          <Transformer ref={transformerRef} />
        </Layer>
      </Stage>

      {/* Text Editor Overlay */}
      {editingId && (
          <textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onBlur={handleTextEditEnd}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleTextEditEnd(); }}
            style={{
                position: 'absolute',
                left: editingPos.x,
                top: editingPos.y,
                width: editingPos.width + 20,
                height: editingPos.height + 20,
                fontSize: editingStyle.fontSize,
                fontFamily: editingStyle.fontFamily,
                color: editingStyle.color,
                textAlign: editingStyle.textAlign,
                border: '1px solid blue',
                background: 'transparent',
                resize: 'none',
                outline: 'none',
                overflow: 'hidden',
                zIndex: 1000,
            }}
            autoFocus
          />
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 bg-white p-2 rounded-lg shadow-lg border border-gray-200 z-50">
        <button
          onClick={() => handleZoom(-1)}
          className="p-2 hover:bg-gray-100 rounded text-gray-600"
          title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>
        <div className="flex items-center px-2 text-sm text-gray-500 min-w-[60px] justify-center border-x border-gray-100">
          {Math.round(scale * 100)}%
        </div>
        <button
          onClick={() => handleZoom(1)}
          className="p-2 hover:bg-gray-100 rounded text-gray-600"
          title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-2 hover:bg-gray-100 rounded text-gray-600 border-l border-gray-100 ml-1"
          title="Reset Zoom"
        >
          <Maximize size={20} />
        </button>
      </div>
    </div>
  );
}
