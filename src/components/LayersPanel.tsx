import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, Folder, File, Type, Image as ImageIcon, Box, Circle as CircleIcon, PenTool, Frame, Component, X } from 'lucide-react';
import { Shape, GroupShape, ArtboardShape } from '@/types/shapes';
import { findShape, updateShapeInTree } from '@/utils/treeUtils';
import { ContextMenu } from './ContextMenu';

interface LayersPanelProps {
    shapes: Shape[];
    onShapesChange: (shapes: Shape[]) => void;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    onDelete: (id: string) => void;
    onContextMenuAction: (action: string) => void;
}

const LayerItem = React.memo(({ 
    shape, 
    depth = 0, 
    selectedIds, 
    onSelect, 
    onToggleVisibility, 
    onToggleLock,
    onDelete,
    collapsedIds,
    onToggleExpand,
    onContextMenu
}: { 
    shape: Shape; 
    depth?: number; 
    selectedIds: string[]; 
    onSelect: (id: string, multi: boolean) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onDelete: (id: string) => void;
    collapsedIds: Set<string>;
    onToggleExpand: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
}) => {
    const isSelected = selectedIds.includes(shape.id);
    const isExpanded = !collapsedIds.has(shape.id);

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleExpand(shape.id);
    };

    const getIcon = () => {
        if (shape.type === 'artboard') return <Frame size={14} className="text-purple-400" />;
        if (shape.type === 'group') return <Folder size={14} className="text-blue-400" />;
        if (shape.type === 'text') return <Type size={14} className="text-gray-400" />;
        if (shape.type === 'image') return <ImageIcon size={14} className="text-green-400" />;
        if (shape.type === 'rect') return <Box size={14} className="text-gray-400" />;
        if (shape.type === 'circle') return <CircleIcon size={14} className="text-gray-400" />;
        if (shape.type === 'path') return <PenTool size={14} className="text-gray-400" />;
        if (shape.type === 'instance') return <Component size={14} className="text-orange-400" />;
        return <File size={14} className="text-gray-400" />;
    };

    const hasChildren = (shape.type === 'group' || shape.type === 'artboard') && (shape as GroupShape | ArtboardShape).children?.length > 0;
    const children = hasChildren ? (shape as GroupShape | ArtboardShape).children : [];

    return (
        <div>
            <div 
                className={`flex items-center h-8 px-2 text-xs border-b border-[#333] cursor-pointer hover:bg-[#2a2a2a] ${isSelected ? 'bg-[#0044aa] hover:bg-[#0055cc]' : ''}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={(e) => onSelect(shape.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                onContextMenu={(e) => onContextMenu(e, shape.id)}
            >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    {hasChildren ? (
                        <button onClick={handleExpand} className="p-0.5 hover:bg-white/10 rounded">
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                    ) : <div className="w-4" />}
                    {getIcon()}
                    <span className="truncate ml-1 select-none">{shape.name || shape.type}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); onToggleLock(shape.id); }} className={`p-1 rounded hover:bg-white/10 ${shape.locked ? 'text-red-400 opacity-100' : 'text-gray-500'}`}>
                        {shape.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(shape.id); }} className={`p-1 rounded hover:bg-white/10 ${shape.visible === false ? 'text-gray-500' : 'text-gray-300'}`}>
                        {shape.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(shape.id); }} className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400">
                        <X size={12} />
                    </button>
                </div>
            </div>
            {isExpanded && hasChildren && (
                <div>
                    {[...children].reverse().map((child: Shape) => (
                        <LayerItem 
                            key={child.id} 
                            shape={child} 
                            depth={depth + 1} 
                            selectedIds={selectedIds}
                            onSelect={onSelect}
                            onToggleVisibility={onToggleVisibility}
                            onToggleLock={onToggleLock}
                            onDelete={onDelete}
                            collapsedIds={collapsedIds}
                            onToggleExpand={onToggleExpand}
                            onContextMenu={onContextMenu}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});

export default function LayersPanel({ shapes, onShapesChange, selectedIds, onSelectionChange, onDelete, onContextMenuAction }: LayersPanelProps) {
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

    // Refs to keep latest values accessible in stable callbacks
    const shapesRef = useRef(shapes);
    const selectedIdsRef = useRef(selectedIds);
    const onShapesChangeRef = useRef(onShapesChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onDeleteRef = useRef(onDelete);
    const onContextMenuActionRef = useRef(onContextMenuAction);

    // Update refs on every render
    shapesRef.current = shapes;
    selectedIdsRef.current = selectedIds;
    onShapesChangeRef.current = onShapesChange;
    onSelectionChangeRef.current = onSelectionChange;
    onDeleteRef.current = onDelete;
    onContextMenuActionRef.current = onContextMenuAction;

    const handleToggleExpand = useCallback((id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);
    
    const handleSelect = useCallback((id: string, multi: boolean) => {
        const currentSelectedIds = selectedIdsRef.current;
        const onChange = onSelectionChangeRef.current;

        if (multi) {
            if (currentSelectedIds.includes(id)) {
                onChange(currentSelectedIds.filter(sid => sid !== id));
            } else {
                onChange([...currentSelectedIds, id]);
            }
        } else {
            onChange([id]);
        }
    }, []);

    const handleToggleVisibility = useCallback((id: string) => {
        const currentShapes = shapesRef.current;
        const onChange = onShapesChangeRef.current;
        
        const shape = findShape(currentShapes, id);
        if (shape) {
            onChange(updateShapeInTree(currentShapes, id, { visible: shape.visible === false ? true : false }));
        }
    }, []);

    const handleToggleLock = useCallback((id: string) => {
        const currentShapes = shapesRef.current;
        const onChange = onShapesChangeRef.current;

        const shape = findShape(currentShapes, id);
        if (shape) {
            onChange(updateShapeInTree(currentShapes, id, { locked: !shape.locked }));
        }
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const currentSelectedIds = selectedIdsRef.current;
        const onSelectionChange = onSelectionChangeRef.current;

        // If the item is not already selected, select it (and deselect others unless Ctrl is held)
        if (!currentSelectedIds.includes(id)) {
            if (e.ctrlKey || e.metaKey) {
                onSelectionChange([...currentSelectedIds, id]);
            } else {
                onSelectionChange([id]);
            }
        }
        
        setContextMenu({ x: e.clientX, y: e.clientY });
    }, []);

    const handleAction = useCallback((action: string) => {
        onContextMenuActionRef.current(action);
        setContextMenu(null);
    }, []);

    // Calculate capabilities for context menu
    const canGroup = selectedIds.length > 1;
    const canUngroup = selectedIds.length === 1 && (() => {
        const shape = findShape(shapes, selectedIds[0]);
        return shape ? (shape.type === 'group' || shape.type === 'artboard') : false;
    })();

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-white select-none overflow-y-auto relative">
            <div className="p-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-[#333]">Layers</div>
            <div className="flex-1">
                {[...shapes].reverse().map(shape => (
                    <LayerItem 
                        key={shape.id} 
                        shape={shape} 
                        selectedIds={selectedIds}
                        onSelect={handleSelect}
                        onToggleVisibility={handleToggleVisibility}
                        onToggleLock={handleToggleLock}
                        onDelete={onDelete}
                        collapsedIds={collapsedIds}
                        onToggleExpand={handleToggleExpand}
                        onContextMenu={handleContextMenu}
                    />
                ))}
            </div>
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
        </div>
    );
}
