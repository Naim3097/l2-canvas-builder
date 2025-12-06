import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, Folder, File, Type, Image as ImageIcon, Box, Circle as CircleIcon, PenTool, Frame, Component } from 'lucide-react';
import { Shape, GroupShape, ArtboardShape } from '@/types/shapes';
import { findShape, updateShapeInTree } from '@/utils/treeUtils';

interface LayersPanelProps {
    shapes: Shape[];
    onShapesChange: (shapes: Shape[]) => void;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

const LayerItem = ({ 
    shape, 
    depth = 0, 
    selectedIds, 
    onSelect, 
    onToggleVisibility, 
    onToggleLock,
    onToggleExpand
}: { 
    shape: Shape; 
    depth?: number; 
    selectedIds: string[]; 
    onSelect: (id: string, multi: boolean) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onToggleExpand: (id: string) => void;
}) => {
    const isSelected = selectedIds.includes(shape.id);
    const [isExpanded, setIsExpanded] = useState(true); // Default expanded for now

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
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
                            onToggleExpand={onToggleExpand}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default function LayersPanel({ shapes, onShapesChange, selectedIds, onSelectionChange }: LayersPanelProps) {
    
    const handleSelect = (id: string, multi: boolean) => {
        if (multi) {
            if (selectedIds.includes(id)) {
                onSelectionChange(selectedIds.filter(sid => sid !== id));
            } else {
                onSelectionChange([...selectedIds, id]);
            }
        } else {
            onSelectionChange([id]);
        }
    };

    const updateShape = (id: string, updates: Partial<Shape>) => {
        onShapesChange(updateShapeInTree(shapes, id, updates));
    };

    const handleToggleVisibility = (id: string) => {
        const shape = findShape(shapes, id);
        if (shape) {
            updateShape(id, { visible: shape.visible === false ? true : false });
        }
    };

    const handleToggleLock = (id: string) => {
        const shape = findShape(shapes, id);
        if (shape) {
            updateShape(id, { locked: !shape.locked });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-white select-none overflow-y-auto">
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
                        onToggleExpand={() => {}}
                    />
                ))}
            </div>
        </div>
    );
}
