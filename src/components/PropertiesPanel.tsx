import React from 'react';
import { 
    Copy, Component as ComponentIcon, Ungroup as UngroupIcon, 
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, 
    AlignStartVertical, AlignCenterVertical, AlignEndVertical, 
    ChevronUp, ChevronDown, ArrowLeftRight, ArrowUpDown, 
    Bold, Italic, Underline, Strikethrough, 
    AlignLeft, AlignCenter, AlignRight, X 
} from 'lucide-react';
import { Shape } from '../types/shapes';
import { AppearancePanel } from './AppearancePanel';
import { getShapeDimensions } from '@/utils/treeUtils';
import { decomposeMatrix, createSkew, createRotation, createScale, createTranslation, multiplyMatrices } from '@/utils/matrixUtils';

// Helper function
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

interface PropertiesPanelProps {
    selectedIds: string[];
    shapes: Shape[];
    onUpdate: (updates: Partial<Shape>) => void;
    onMove: (direction: 'up' | 'down' | 'top' | 'bottom') => void;
    onCreateComponent: () => void;
    onDetachInstance: () => void;
    onExport: (format: 'png' | 'jpg' | 'svg' | 'pdf', scale: number) => void;
    onSelectSimilar: () => void;
    onTraceImage?: () => void;
    onReleaseMask?: () => void;
    onCropImage?: () => void;
    viewMode: 'rgb' | 'cmyk' | 'outline';
    setViewMode: (mode: 'rgb' | 'cmyk' | 'outline') => void;
    globalEditMode: boolean;
    setGlobalEditMode: (mode: boolean) => void;
}

const GOOGLE_FONTS = [
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald', 'Source Sans Pro',
    'Slabo 27px', 'Raleway', 'PT Sans', 'Merriweather', 'Noto Sans', 'Nunito',
    'Concert One', 'Prompt', 'Work Sans'
];

export function PropertiesPanel({ selectedIds, shapes, onUpdate, onMove, onCreateComponent, onDetachInstance, onExport, onSelectSimilar, onTraceImage, onReleaseMask, onCropImage, viewMode, setViewMode, globalEditMode, setGlobalEditMode }: PropertiesPanelProps) {
    const selectedId = selectedIds[0];
    const shape = selectedId ? findShape(shapes, selectedId) : null;

    if (!shape) {
        return (
            <div className="p-4 space-y-6">
                <div className="border-b border-gray-800 pb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Document Settings</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-2">View Mode</label>
                            <div className="flex bg-gray-800 rounded p-1">
                                {['rgb', 'cmyk', 'outline'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode as any)}
                                        className={`flex-1 text-xs py-1 rounded ${viewMode === mode ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {mode.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (selectedIds.length > 1) {
        return (
            <div className="p-4 text-center text-gray-500 text-sm">
                <p>{selectedIds.length} objects selected</p>
                <p className="text-xs mt-2">Multi-editing coming soon</p>
            </div>
        );
    }

    const artboards = shapes.filter(s => s.type === 'artboard');

    // Transform Logic
    let rotation = shape.rotation || 0;
    let skewX = 0;
    let skewY = 0;
    
    if (shape.transform) {
        const decomp = decomposeMatrix(shape.transform);
        rotation = decomp.rotation;
        skewX = decomp.skewX;
        skewY = decomp.skewY;
    }

    const handleTransformChange = (prop: 'rotation' | 'skewX' | 'skewY', value: number) => {
        let currentX = shape.x;
        let currentY = shape.y;
        let currentScaleX = shape.scaleX || 1;
        let currentScaleY = shape.scaleY || 1;
        
        if (shape.transform) {
            const d = decomposeMatrix(shape.transform);
            currentX = d.x;
            currentY = d.y;
            currentScaleX = d.scaleX;
            currentScaleY = d.scaleY;
        }
        
        let newRotation = rotation;
        let newSkewX = skewX;
        let newSkewY = skewY;
        
        if (prop === 'rotation') newRotation = value;
        if (prop === 'skewX') newSkewX = value;
        if (prop === 'skewY') newSkewY = value;
        
        const T = createTranslation(currentX, currentY);
        const R = createRotation((newRotation * Math.PI) / 180);
        const Sk = createSkew((newSkewX * Math.PI) / 180, (newSkewY * Math.PI) / 180);
        const S = createScale(currentScaleX, currentScaleY);
        
        const M = multiplyMatrices(multiplyMatrices(multiplyMatrices(T, R), Sk), S);
        
        onUpdate({ transform: M });
    };

    const findParent = (items: Shape[], targetId: string): Shape | null => {
        for (const item of items) {
            if ((item.type === 'group' || item.type === 'artboard') && item.children) {
                if (item.children.find(c => c.id === targetId)) return item;
                const found = findParent(item.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };

    const parent = findParent(shapes, selectedId);
    const canAlign = !!parent;

    const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (!parent) return;
        const { width: parentWidth, height: parentHeight } = getShapeDimensions(parent);
        const { width: myWidth, height: myHeight } = getShapeDimensions(shape);

        if (type === 'left') onUpdate({ x: 0 });
        if (type === 'center') onUpdate({ x: (parentWidth - myWidth) / 2 });
        if (type === 'right') onUpdate({ x: parentWidth - myWidth });
        if (type === 'top') onUpdate({ y: 0 });
        if (type === 'middle') onUpdate({ y: (parentHeight - myHeight) / 2 });
        if (type === 'bottom') onUpdate({ y: parentHeight - myHeight });
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Alignment */}
            <div className="border-b border-gray-800 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">{shape.type}</span>
                        <span className="text-xs text-gray-500">{shape.id.split('-')[1]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onSelectSimilar} className="text-gray-500 hover:text-white" title="Select Similar">
                            <Copy size={14} />
                        </button>
                        {shape.type !== 'instance' && (
                            <button onClick={onCreateComponent} className="text-gray-500 hover:text-white" title="Create Component">
                                <ComponentIcon size={14} />
                            </button>
                        )}
                        {shape.type === 'instance' && (
                            <button onClick={onDetachInstance} className="text-gray-500 hover:text-white" title="Detach Instance">
                                <UngroupIcon size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Global Edit Toggle */}
                <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-xs text-gray-400">Global Edit</span>
                    <button 
                        onClick={() => setGlobalEditMode(!globalEditMode)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${globalEditMode ? 'bg-blue-500' : 'bg-gray-700'}`}
                    >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform`} style={{ left: globalEditMode ? '18px' : '2px' }} />
                    </button>
                </div>
                
                {/* Alignment Tools */}
                <div className="flex justify-between px-2 flex-wrap gap-1">
                    <button disabled={!canAlign} onClick={() => handleAlign('left')} className={`p-1 rounded ${!canAlign ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} title="Align Left"><AlignStartHorizontal size={16} /></button>
                    <button disabled={!canAlign} onClick={() => handleAlign('center')} className={`p-1 rounded ${!canAlign ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} title="Align Center"><AlignCenterHorizontal size={16} /></button>
                    <button disabled={!canAlign} onClick={() => handleAlign('right')} className={`p-1 rounded ${!canAlign ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} title="Align Right"><AlignEndHorizontal size={16} /></button>
                    <div className="w-px bg-gray-800 mx-1"></div>
                    <button disabled={!canAlign} onClick={() => handleAlign('top')} className={`p-1 rounded ${!canAlign ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} title="Align Top"><AlignStartVertical size={16} /></button>
                    <button disabled={!canAlign} onClick={() => handleAlign('middle')} className={`p-1 rounded ${!canAlign ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} title="Align Middle"><AlignCenterVertical size={16} /></button>
                    <button disabled={!canAlign} onClick={() => handleAlign('bottom')} className={`p-1 rounded ${!canAlign ? 'text-gray-700 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`} title="Align Bottom"><AlignEndVertical size={16} /></button>
                    <div className="w-px bg-gray-800 mx-1"></div>
                    <button onClick={() => onMove('up')} className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded" title="Bring Forward"><ChevronUp size={16} /></button>
                    <button onClick={() => onMove('down')} className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded" title="Send Backward"><ChevronDown size={16} /></button>
                </div>
            </div>

            {/* Layout Section */}
            <div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="relative group">
                        <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">X</label>
                        <input type="number" value={Math.round(shape.x)} onChange={(e) => onUpdate({ x: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" />
                    </div>
                    <div className="relative group">
                        <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">Y</label>
                        <input type="number" value={Math.round(shape.y)} onChange={(e) => onUpdate({ y: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" />
                    </div>
                </div>
                {(shape.type === 'rect' || shape.type === 'image' || shape.type === 'group' || shape.type === 'artboard' || shape.type === 'path' || shape.type === 'circle') && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="relative group">
                            <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">W</label>
                            <input 
                                type="number" 
                                value={Math.round(shape.type === 'path' ? ((shape as any).width || 0) * ((shape as any).scaleX || 1) : getShapeDimensions(shape).width)} 
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (shape.type === 'path') {
                                        const baseW = (shape as any).width || 1;
                                        onUpdate({ scaleX: val / baseW });
                                    } else {
                                        onUpdate({ width: val });
                                    }
                                }} 
                                className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" 
                            />
                        </div>
                        <div className="relative group">
                            <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">H</label>
                            <input 
                                type="number" 
                                value={Math.round(shape.type === 'path' ? ((shape as any).height || 0) * ((shape as any).scaleY || 1) : getShapeDimensions(shape).height)} 
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (shape.type === 'path') {
                                        const baseH = (shape as any).height || 1;
                                        onUpdate({ scaleY: val / baseH });
                                    } else {
                                        onUpdate({ height: val });
                                    }
                                }} 
                                className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" 
                            />
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                     <div className="relative group">
                        <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">R</label>
                        <input type="number" value={Math.round(rotation)} onChange={(e) => handleTransformChange('rotation', Number(e.target.value))} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" />
                    </div>
                    <div className="relative group">
                        <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">SkX</label>
                        <input type="number" value={Math.round(skewX)} onChange={(e) => handleTransformChange('skewX', Number(e.target.value))} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" />
                    </div>
                    <div className="relative group">
                        <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">SkY</label>
                        <input type="number" value={Math.round(skewY)} onChange={(e) => handleTransformChange('skewY', Number(e.target.value))} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" />
                    </div>
                </div>
                {shape.type === 'rect' && (
                    <div className="grid grid-cols-1 gap-4 mt-2">
                        <div className="relative group">
                            <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500 cursor-ew-resize">C</label>
                            <input type="number" value={(shape as any).cornerRadius || 0} onChange={(e) => onUpdate({ cornerRadius: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none transition-colors" />
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <button onClick={() => onUpdate({ scaleX: ((shape as any).scaleX ?? 1) * -1 })} className="flex items-center justify-center gap-2 bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors" title="Flip Horizontal">
                        <ArrowLeftRight size={14} /> Flip H
                    </button>
                    <button onClick={() => onUpdate({ scaleY: ((shape as any).scaleY ?? 1) * -1 })} className="flex items-center justify-center gap-2 bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors" title="Flip Vertical">
                        <ArrowUpDown size={14} /> Flip V
                    </button>
                </div>
            </div>

            {/* Blend Mode */}
            <div className="border-t border-gray-800 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase">Layer</h3>
                </div>
                <div className="flex gap-2">
                    <select 
                        value={shape.blendMode || 'normal'} 
                        onChange={(e) => onUpdate({ blendMode: e.target.value as any })}
                        className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none"
                    >
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="darken">Darken</option>
                        <option value="lighten">Lighten</option>
                        <option value="color-dodge">Color Dodge</option>
                        <option value="color-burn">Color Burn</option>
                        <option value="hard-light">Hard Light</option>
                        <option value="soft-light">Soft Light</option>
                        <option value="difference">Difference</option>
                        <option value="exclusion">Exclusion</option>
                        <option value="hue">Hue</option>
                        <option value="saturation">Saturation</option>
                        <option value="color">Color</option>
                        <option value="luminosity">Luminosity</option>
                    </select>
                    <div className="relative w-20">
                        <input 
                            type="number" 
                            value={Math.round((shape.opacity ?? 1) * 100)} 
                            onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })} 
                            className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none text-right"
                        />
                        <span className="absolute right-6 top-1.5 text-xs text-gray-500">%</span>
                    </div>
                </div>
            </div>

            {/* Fill & Stroke Section */}
            {(shape.type === 'rect' || shape.type === 'circle' || shape.type === 'path' || shape.type === 'text' || shape.type === 'artboard') && (
                <div className="border-t border-gray-800 pt-4">
                    {/* Fill */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Fill</h3>
                            <button className="text-gray-500 hover:text-white">+</button>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded border border-gray-600 overflow-hidden relative">
                                <input 
                                    type="color" 
                                    value={(shape as any).fill || '#000000'} 
                                    onChange={(e) => onUpdate({ fill: e.target.value })}
                                    className="absolute -top-2 -left-2 w-10 h-10 p-0 border-0 cursor-pointer"
                                />
                            </div>
                            <input 
                                type="text" 
                                value={(shape as any).fill || ''} 
                                onChange={(e) => onUpdate({ fill: e.target.value })}
                                className="flex-1 bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none uppercase"
                                placeholder="#000000"
                            />
                            <div className="relative w-16">
                                <input 
                                    type="number" 
                                    value={Math.round(((shape as any).opacity ?? 1) * 100)} 
                                    onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })} 
                                    className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none text-right"
                                />
                                <span className="absolute right-4 top-1.5 text-xs text-gray-500">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Stroke */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Stroke</h3>
                            <button className="text-gray-500 hover:text-white">+</button>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded border border-gray-600 overflow-hidden relative">
                                <input 
                                    type="color" 
                                    value={(shape as any).stroke || '#000000'} 
                                    onChange={(e) => onUpdate({ stroke: e.target.value })}
                                    className="absolute -top-2 -left-2 w-10 h-10 p-0 border-0 cursor-pointer"
                                />
                            </div>
                            <input 
                                type="text" 
                                value={(shape as any).stroke || ''} 
                                onChange={(e) => onUpdate({ stroke: e.target.value })}
                                className="flex-1 bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none uppercase"
                                placeholder="None"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative group">
                                <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">Width</label>
                                <input 
                                    type="number" 
                                    value={(shape as any).strokeWidth || 0} 
                                    onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })} 
                                    className="w-full bg-[#1e1e1e] text-white text-xs pl-10 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" 
                                />
                            </div>
                            <select 
                                value={(shape as any).strokeAlign || 'center'} 
                                onChange={(e) => onUpdate({ strokeAlign: e.target.value as any })}
                                className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none"
                            >
                                <option value="center">Center</option>
                                <option value="inside">Inside</option>
                                <option value="outside">Outside</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Typography Section */}
            {shape.type === 'text' && (
                <div className="border-t border-gray-800 pt-4">
                    <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Typography</h3>
                    <div className="space-y-3">
                        {/* Text Content Editor */}
                        <div className="mb-2">
                            <label className="text-[10px] text-gray-500 mb-1 block">Content</label>
                            <textarea 
                                value={(shape as any).text || ''} 
                                onChange={(e) => onUpdate({ text: e.target.value })}
                                className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none resize-y min-h-[60px]"
                                placeholder="Text content..."
                            />
                        </div>

                        <div className="relative">
                            <input 
                                list="font-options"
                                type="text" 
                                value={shape.fontFamily} 
                                onChange={(e) => {
                                    const font = e.target.value;
                                    onUpdate({ fontFamily: font });
                                    // Try to load from Google Fonts
                                    const linkId = `font-${font.replace(/\s+/g, '-')}`;
                                    if (!document.getElementById(linkId)) {
                                        const link = document.createElement('link');
                                        link.id = linkId;
                                        link.rel = 'stylesheet';
                                        link.href = `https://fonts.googleapis.com/css?family=${font.replace(/\s+/g, '+')}:400,700&display=swap`;
                                        document.head.appendChild(link);
                                    }
                                }} 
                                className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none"
                                placeholder="Font Family"
                            />
                            <datalist id="font-options">
                                <option value="Inter" />
                                <option value="Roboto" />
                                <option value="Open Sans" />
                                <option value="Lato" />
                                <option value="Montserrat" />
                                <option value="Poppins" />
                                <option value="Playfair Display" />
                                <option value="Merriweather" />
                                <option value="Nunito" />
                                <option value="Raleway" />
                                <option value="Ubuntu" />
                                <option value="Oswald" />
                                <option value="Source Sans Pro" />
                                <option value="Slabo 27px" />
                                <option value="PT Sans" />
                                <option value="Roboto Condensed" />
                                <option value="Droid Sans" />
                                <option value="Droid Serif" />
                                <option value="Fira Sans" />
                                <option value="Lora" />
                                <option value="Mukta" />
                                <option value="Muli" />
                                <option value="Inconsolata" />
                                <option value="Kanit" />
                                <option value="Barlow" />
                                <option value="Quicksand" />
                                <option value="Heebo" />
                                <option value="IBM Plex Sans" />
                                <option value="Rubik" />
                                <option value="Crimson Text" />
                                <option value="Work Sans" />
                                <option value="Karla" />
                                <option value="Josefin Sans" />
                                <option value="Anton" />
                                <option value="Libre Baskerville" />
                                <option value="Lobster" />
                                <option value="Pacifico" />
                                <option value="Shadows Into Light" />
                                <option value="Dancing Script" />
                                <option value="Amatic SC" />
                                <option value="Caveat" />
                                <option value="Comfortaa" />
                                <option value="Righteous" />
                                <option value="Fredoka One" />
                                <option value="Bangers" />
                                <option value="Permanent Marker" />
                                <option value="Arial" />
                                <option value="Helvetica" />
                                <option value="Times New Roman" />
                                <option value="Courier New" />
                                <option value="Verdana" />
                            </datalist>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <select value={shape.fontWeight} onChange={(e) => onUpdate({ fontWeight: e.target.value })} className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none">
                                <option value="normal">Regular</option>
                                <option value="bold">Bold</option>
                                <option value="lighter">Light</option>
                            </select>
                            <input type="number" value={shape.fontSize} onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative group">
                                <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">LS</label>
                                <input type="number" value={(shape as any).letterSpacing || 0} onChange={(e) => onUpdate({ letterSpacing: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" />
                            </div>
                            <div className="relative group">
                                <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">LH</label>
                                <input type="number" value={(shape as any).lineHeight || 1.2} step="0.1" onChange={(e) => onUpdate({ lineHeight: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" />
                            </div>
                        </div>

                        <div className="flex bg-[#1e1e1e] rounded border border-gray-800 p-0.5 mb-2">
                            <button onClick={() => onUpdate({ fontWeight: shape.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`flex-1 py-1 rounded text-xs ${shape.fontWeight === 'bold' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`} title="Bold"><Bold size={14} className="mx-auto" /></button>
                            <button onClick={() => onUpdate({ fontStyle: (shape as any).fontStyle === 'italic' ? 'normal' : 'italic' })} className={`flex-1 py-1 rounded text-xs ${(shape as any).fontStyle === 'italic' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`} title="Italic"><Italic size={14} className="mx-auto" /></button>
                            <button onClick={() => onUpdate({ textDecoration: (shape as any).textDecoration === 'underline' ? '' : 'underline' })} className={`flex-1 py-1 rounded text-xs ${(shape as any).textDecoration === 'underline' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`} title="Underline"><Underline size={14} className="mx-auto" /></button>
                            <button onClick={() => onUpdate({ textDecoration: (shape as any).textDecoration === 'line-through' ? '' : 'line-through' })} className={`flex-1 py-1 rounded text-xs ${(shape as any).textDecoration === 'line-through' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`} title="Strikethrough"><Strikethrough size={14} className="mx-auto" /></button>
                        </div>

                        <div className="flex bg-[#1e1e1e] rounded border border-gray-800 p-0.5">
                            <button onClick={() => onUpdate({ align: 'left' })} className={`flex-1 py-1 rounded text-xs ${shape.align === 'left' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}><AlignLeft size={14} className="mx-auto" /></button>
                            <button onClick={() => onUpdate({ align: 'center' })} className={`flex-1 py-1 rounded text-xs ${shape.align === 'center' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}><AlignCenter size={14} className="mx-auto" /></button>
                            <button onClick={() => onUpdate({ align: 'right' })} className={`flex-1 py-1 rounded text-xs ${shape.align === 'right' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}><AlignRight size={14} className="mx-auto" /></button>
                        </div>

                        <textarea value={shape.text} onChange={(e) => onUpdate({ text: e.target.value })} className="w-full bg-[#1e1e1e] text-white text-xs px-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none resize-y min-h-[60px]" />
                    </div>
                </div>
            )}

            {/* Appearance Section */}
            {(shape.type === 'rect' || shape.type === 'text' || shape.type === 'artboard' || shape.type === 'path') && (
                <AppearancePanel shape={shape} onUpdate={onUpdate} />
            )}

            {/* Image Trace */}
            {shape.type === 'image' && onTraceImage && (
                <div className="border-t border-gray-800 pt-4">
                    <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Image Trace</h3>
                    <button 
                        onClick={onTraceImage}
                        className="w-full py-1.5 bg-[#333] hover:bg-[#444] text-xs rounded text-white transition"
                    >
                        Trace Image (Vectorize)
                    </button>
                </div>
            )}

            {/* Release Mask */}
            {shape.type === 'group' && (shape as any).clip && onReleaseMask && (
                <div className="border-t border-gray-800 pt-4">
                    <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Masking</h3>
                    <button 
                        onClick={onReleaseMask}
                        className="w-full py-1.5 bg-[#333] hover:bg-[#444] text-xs rounded text-white transition"
                    >
                        Release Mask
                    </button>
                </div>
            )}

            {/* Image Adjustments */}
            {shape.type === 'image' && (
                <div className="border-t border-gray-800 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase">Image Adjustments</h3>
                        {onCropImage && (
                            <button 
                                onClick={onCropImage}
                                className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
                            >
                                Crop
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {/* Brightness */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>Brightness</span>
                                <span>{Math.round(((shape as any).brightness || 0) * 100)}%</span>
                            </div>
                            <input 
                                type="range" min="-1" max="1" step="0.05" 
                                value={(shape as any).brightness || 0} 
                                onChange={(e) => onUpdate({ brightness: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        {/* Contrast */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>Contrast</span>
                                <span>{(shape as any).contrast || 0}</span>
                            </div>
                            <input 
                                type="range" min="-100" max="100" step="1" 
                                value={(shape as any).contrast || 0} 
                                onChange={(e) => onUpdate({ contrast: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        {/* Saturation */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>Saturation</span>
                                <span>{(shape as any).saturation || 0}</span>
                            </div>
                            <input 
                                type="range" min="-2" max="2" step="0.1" 
                                value={(shape as any).saturation || 0} 
                                onChange={(e) => onUpdate({ saturation: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        {/* Hue */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>Hue</span>
                                <span>{(shape as any).hue || 0}°</span>
                            </div>
                            <input 
                                type="range" min="0" max="360" step="1" 
                                value={(shape as any).hue || 0} 
                                onChange={(e) => onUpdate({ hue: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        {/* Blur */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>Blur</span>
                                <span>{(shape as any).blur || 0}px</span>
                            </div>
                            <input 
                                type="range" min="0" max="40" step="1" 
                                value={(shape as any).blur || 0} 
                                onChange={(e) => onUpdate({ blur: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Effects Section */}
            <div className="border-t border-gray-800 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase">Effects</h3>
                    <button className="text-gray-500 hover:text-white">+</button>
                </div>
                
                {/* Shadow */}
                <div className="mb-2">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={!!shape.shadowBlur} onChange={(e) => onUpdate({ shadowBlur: e.target.checked ? 10 : 0, shadowColor: 'rgba(0,0,0,0.5)', shadowOffsetX: 0, shadowOffsetY: 4 })} className="rounded bg-[#1e1e1e] border-gray-700" />
                            <span className="text-xs text-gray-300">Drop Shadow</span>
                        </div>
                    </div>
                    {shape.shadowBlur ? (
                        <div className="space-y-2 pl-4 border-l border-gray-800 ml-1">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative group">
                                    <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">Blur</label>
                                    <input type="number" value={shape.shadowBlur} onChange={(e) => onUpdate({ shadowBlur: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-8 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" />
                                </div>
                                <div className="relative group">
                                    <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">Color</label>
                                    <div className="flex items-center w-full bg-[#1e1e1e] rounded border border-transparent hover:border-gray-700 focus-within:border-blue-500">
                                        <div className="w-6 h-6 ml-1 rounded border border-gray-600 overflow-hidden relative flex-shrink-0">
                                            <input 
                                                type="color" 
                                                value={shape.shadowColor || '#000000'} 
                                                onChange={(e) => onUpdate({ shadowColor: e.target.value })}
                                                className="absolute -top-2 -left-2 w-10 h-10 p-0 border-0 cursor-pointer"
                                            />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={shape.shadowColor} 
                                            onChange={(e) => onUpdate({ shadowColor: e.target.value })} 
                                            className="w-full bg-transparent text-white text-xs pl-2 pr-2 py-1.5 outline-none" 
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative group">
                                    <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">X</label>
                                    <input type="number" value={shape.shadowOffsetX || 0} onChange={(e) => onUpdate({ shadowOffsetX: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" />
                                </div>
                                <div className="relative group">
                                    <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">Y</label>
                                    <input type="number" value={shape.shadowOffsetY || 0} onChange={(e) => onUpdate({ shadowOffsetY: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-6 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Layer Blur */}
                <div className="mb-2">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" checked={!!(shape as any).blurRadius} onChange={(e) => onUpdate({ blurRadius: e.target.checked ? 10 : 0 })} className="rounded bg-[#1e1e1e] border-gray-700" />
                            <span className="text-xs text-gray-300">Layer Blur</span>
                        </div>
                    </div>
                    {!!(shape as any).blurRadius && (
                        <div className="space-y-2 pl-4 border-l border-gray-800 ml-1">
                            <div className="relative group">
                                <label className="absolute left-2 top-1.5 text-[10px] text-gray-500 group-hover:text-blue-500">Radius</label>
                                <input type="number" value={(shape as any).blurRadius || 0} onChange={(e) => onUpdate({ blurRadius: Number(e.target.value) })} className="w-full bg-[#1e1e1e] text-white text-xs pl-10 pr-2 py-1.5 rounded border border-transparent hover:border-gray-700 focus:border-blue-500 outline-none" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Export Section */}
            <div className="border-t border-gray-800 pt-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Export</h3>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onExport('png', 1)} className="bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors">PNG 1x</button>
                    <button onClick={() => onExport('png', 2)} className="bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors">PNG 2x</button>
                    <button onClick={() => onExport('jpg', 1)} className="bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors">JPG 1x</button>
                    <button onClick={() => onExport('jpg', 2)} className="bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors">JPG 2x</button>
                    <button onClick={() => onExport('svg', 1)} className="bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors">SVG</button>
                    <button onClick={() => onExport('pdf', 1)} className="bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors">PDF</button>
                    <button onClick={() => {
                        onExport('png', 1);
                        setTimeout(() => onExport('png', 2), 500);
                        setTimeout(() => onExport('png', 3), 1000);
                    }} className="col-span-2 bg-[#1e1e1e] hover:bg-gray-700 text-white text-xs py-1.5 rounded border border-transparent hover:border-gray-600 transition-colors border-t border-gray-700 mt-1">Export for Screens (1x, 2x, 3x)</button>
                </div>
            </div>
        </div>
    );
}
