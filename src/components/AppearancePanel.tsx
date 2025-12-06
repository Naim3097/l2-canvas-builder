import React, { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, MoreHorizontal, ChevronDown, ChevronUp, Settings, X } from 'lucide-react';
import { Shape, Fill, Stroke, GradientStop } from '@/types/shapes';

interface AppearancePanelProps {
    shape: Shape;
    onUpdate: (updates: Partial<Shape>) => void;
}

const GradientEditor = ({ stops, onChange }: { stops: GradientStop[], onChange: (stops: GradientStop[]) => void }) => {
    const updateStop = (index: number, updates: Partial<GradientStop>) => {
        const newStops = [...stops];
        newStops[index] = { ...newStops[index], ...updates };
        newStops.sort((a, b) => a.offset - b.offset);
        onChange(newStops);
    };

    const addStop = () => {
        const newStops = [...stops, { offset: 0.5, color: '#888888' }];
        newStops.sort((a, b) => a.offset - b.offset);
        onChange(newStops);
    };

    const removeStop = (index: number) => {
        if (stops.length <= 2) return;
        const newStops = stops.filter((_, i) => i !== index);
        onChange(newStops);
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-400">Color Stops</span>
                <button 
                    onClick={addStop} 
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    title="Add gradient stop"
                >
                    <Plus size={10} /> Add
                </button>
            </div>
            <div className="space-y-2">
                {stops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2 bg-black/30 p-1.5 rounded">
                        <div className="w-5 h-5 rounded border border-gray-600 overflow-hidden relative cursor-pointer" title="Click to change color">
                            <input 
                                type="color" 
                                value={stop.color} 
                                onChange={(e) => updateStop(i, { color: e.target.value })} 
                                className="absolute -top-2 -left-2 w-9 h-9 p-0 border-0 cursor-pointer" 
                            />
                        </div>
                        <span className="text-[10px] text-gray-500 w-10">Stop {i + 1}</span>
                        <input 
                            type="number" 
                            min="0" max="100" 
                            value={Math.round(stop.offset * 100)} 
                            onChange={(e) => updateStop(i, { offset: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                            className="w-12 bg-gray-800 text-right text-[11px] text-gray-300 px-1 py-0.5 rounded outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-[10px] text-gray-600">%</span>
                        {stops.length > 2 && (
                            <button onClick={() => removeStop(i)} className="ml-auto text-gray-600 hover:text-red-400" title="Remove stop">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const FillRow = ({ fill, index, onUpdate, onRemove }: { fill: Fill, index: number, onUpdate: (updates: Partial<Fill>) => void, onRemove: () => void }) => {
    // Always show gradient editor for gradient types
    const isGradient = fill.type === 'linear-gradient' || fill.type === 'radial-gradient';

    return (
        <div className="bg-[#1e1e1e] rounded mb-1 overflow-hidden">
            <div className="flex items-center gap-2 p-2 group">
                <button onClick={() => onUpdate({ visible: !fill.visible })} className="text-gray-500 hover:text-white">
                    {fill.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                
                {fill.type === 'solid' && (
                    <div className="w-4 h-4 rounded border border-gray-600 overflow-hidden relative cursor-pointer">
                        <input 
                            type="color" 
                            value={fill.color || '#000000'} 
                            onChange={(e) => onUpdate({ color: e.target.value })} 
                            className="absolute -top-2 -left-2 w-8 h-8 p-0 border-0" 
                        />
                    </div>
                )}
                
                {(fill.type === 'linear-gradient' || fill.type === 'radial-gradient') && (
                    <div className="w-4 h-4 rounded border border-gray-600 overflow-hidden" style={{
                        background: fill.type === 'linear-gradient' 
                            ? `linear-gradient(90deg, ${fill.gradientStops?.map(s => `${s.color} ${s.offset * 100}%`).join(', ') || '#000 0%, #fff 100%'})`
                            : `radial-gradient(circle, ${fill.gradientStops?.map(s => `${s.color} ${s.offset * 100}%`).join(', ') || '#000 0%, #fff 100%'})`
                    }}></div>
                )}
                
                <div className="flex-1 min-w-0">
                    <select 
                        value={fill.type} 
                        onChange={(e) => {
                            const newType = e.target.value as any;
                            const updates: any = { type: newType };
                            // Initialize gradient stops for gradients
                            if (newType === 'linear-gradient' || newType === 'radial-gradient') {
                                if (!fill.gradientStops) {
                                    updates.gradientStops = [{offset: 0, color: '#000000'}, {offset: 1, color: '#ffffff'}];
                                }
                            }
                            onUpdate(updates);
                        }}
                        className="w-full bg-transparent text-xs text-gray-300 outline-none border-none p-0 cursor-pointer hover:text-white truncate [&>option]:bg-gray-800 [&>option]:text-white"
                    >
                        <option value="solid">Solid</option>
                        <option value="linear-gradient">Linear Gradient</option>
                        <option value="radial-gradient">Radial Gradient</option>
                        <option value="image">Image</option>
                    </select>
                </div>

                <input 
                    type="number" 
                    min="0" max="100" 
                    value={Math.round((fill.opacity ?? 1) * 100)}
                    onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
                    className="w-8 bg-transparent text-right text-xs text-gray-400 focus:text-white outline-none"
                />
                <span className="text-[10px] text-gray-600">%</span>

                <button onClick={onRemove} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                </button>
            </div>

            {isGradient && (
                <div className="px-2 pb-2 space-y-2">
                    <div className="text-[10px] text-gray-500 mb-1">Gradient Stops</div>
                    <GradientEditor 
                        stops={fill.gradientStops || [{offset: 0, color: '#000000'}, {offset: 1, color: '#ffffff'}]} 
                        onChange={(stops) => onUpdate({ gradientStops: stops })}
                    />
                </div>
            )}

            {fill.type === 'image' && (
                <div className="px-2 pb-2">
                    {fill.image ? (
                        <div className="relative group w-full h-20 bg-black/20 rounded overflow-hidden">
                            <img src={fill.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <label className="cursor-pointer text-[10px] text-white hover:underline">
                                    Change
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => onUpdate({ image: ev.target?.result as string });
                                            reader.readAsDataURL(file);
                                        }
                                    }} />
                                </label>
                            </div>
                        </div>
                    ) : (
                        <label className="block w-full h-20 bg-black/20 hover:bg-black/30 rounded border border-dashed border-gray-600 flex items-center justify-center cursor-pointer text-[10px] text-gray-400 transition-colors">
                            Choose Image
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => onUpdate({ image: ev.target?.result as string });
                                    reader.readAsDataURL(file);
                                }
                            }} />
                        </label>
                    )}
                </div>
            )}
        </div>
    );
};

const StrokeRow = ({ stroke, index, onUpdate, onRemove }: { stroke: Stroke, index: number, onUpdate: (updates: Partial<Stroke>) => void, onRemove: () => void }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="bg-[#1e1e1e] rounded mb-1 overflow-hidden">
            <div className="flex items-center gap-2 p-2 group">
                <button onClick={() => onUpdate({ visible: !stroke.visible })} className="text-gray-500 hover:text-white">
                    {stroke.visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                
                <div className="w-4 h-4 rounded border border-gray-600 overflow-hidden relative cursor-pointer">
                    <input 
                        type="color" 
                        value={stroke.color || '#000000'} 
                        onChange={(e) => onUpdate({ color: e.target.value })} 
                        className="absolute -top-2 -left-2 w-8 h-8 p-0 border-0" 
                    />
                </div>

                <input 
                    type="number" 
                    min="0" 
                    value={stroke.width}
                    onChange={(e) => onUpdate({ width: Number(e.target.value) })}
                    className="w-8 bg-transparent text-right text-xs text-gray-400 focus:text-white outline-none border-b border-transparent focus:border-blue-500"
                />
                <span className="text-[10px] text-gray-600">px</span>

                <button onClick={() => setExpanded(!expanded)} className={`ml-auto text-gray-500 hover:text-white ${expanded ? 'text-blue-400' : ''}`}>
                    <MoreHorizontal size={12} />
                </button>

                <button onClick={onRemove} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                </button>
            </div>

            {expanded && (
                <div className="px-2 pb-2 space-y-2 border-t border-gray-800 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-1">Cap</label>
                            <select 
                                value={stroke.cap || 'butt'} 
                                onChange={(e) => onUpdate({ cap: e.target.value as any })}
                                className="w-full bg-black/20 text-xs text-gray-300 rounded px-1 py-1 outline-none [&>option]:bg-gray-800 [&>option]:text-white"
                            >
                                <option value="butt">Butt</option>
                                <option value="round">Round</option>
                                <option value="square">Square</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-1">Join</label>
                            <select 
                                value={stroke.join || 'miter'} 
                                onChange={(e) => onUpdate({ join: e.target.value as any })}
                                className="w-full bg-black/20 text-xs text-gray-300 rounded px-1 py-1 outline-none [&>option]:bg-gray-800 [&>option]:text-white"
                            >
                                <option value="miter">Miter</option>
                                <option value="round">Round</option>
                                <option value="bevel">Bevel</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Dash Array</label>
                        <input 
                            type="text" 
                            placeholder="4, 4"
                            value={stroke.dash?.join(', ') || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (!val) onUpdate({ dash: undefined });
                                else {
                                    const parts = val.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                                    onUpdate({ dash: parts });
                                }
                            }}
                            className="w-full bg-black/20 text-xs text-gray-300 rounded px-2 py-1 outline-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export const AppearancePanel: React.FC<AppearancePanelProps> = ({ shape, onUpdate }) => {
    
    const fills = shape.fills || (shape.type !== 'group' && (shape as any).fill ? [{
        id: 'default-fill',
        type: (shape as any).fillType || 'solid',
        color: (shape as any).fill,
        gradientStops: (shape as any).fillGradientStops,
        visible: true,
        opacity: 1
    } as Fill] : []);

    const strokes = shape.strokes || (shape.type !== 'group' && (shape as any).stroke ? [{
        id: 'default-stroke',
        color: (shape as any).stroke,
        width: (shape as any).strokeWidth || 1,
        dash: (shape as any).strokeDash,
        cap: (shape as any).strokeCap || (shape as any).lineCap, // Handle both just in case
        join: (shape as any).strokeJoin || (shape as any).lineJoin,
        visible: true,
        opacity: 1
    } as Stroke] : []);

    const handleAddFill = () => {
        const newFill: Fill = {
            id: `fill-${Date.now()}`,
            type: 'solid',
            color: '#cccccc',
            visible: true,
            opacity: 1
        };
        onUpdate({ fills: [newFill, ...fills] });
    };

    const handleAddStroke = () => {
        const newStroke: Stroke = {
            id: `stroke-${Date.now()}`,
            color: '#000000',
            width: 1,
            visible: true,
            opacity: 1
        };
        onUpdate({ strokes: [newStroke, ...strokes] });
    };

    const updateFill = (index: number, updates: Partial<Fill>) => {
        const newFills = [...fills];
        newFills[index] = { ...newFills[index], ...updates };
        onUpdate({ fills: newFills });
    };

    const removeFill = (index: number) => {
        const newFills = fills.filter((_, i) => i !== index);
        onUpdate({ fills: newFills });
    };

    const updateStroke = (index: number, updates: Partial<Stroke>) => {
        const newStrokes = [...strokes];
        newStrokes[index] = { ...newStrokes[index], ...updates };
        onUpdate({ strokes: newStrokes });
    };

    const removeStroke = (index: number) => {
        const newStrokes = strokes.filter((_, i) => i !== index);
        onUpdate({ strokes: newStrokes });
    };

    return (
        <div className="border-t border-gray-800 pt-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase">Appearance</h3>
            </div>

            {/* Fills */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2 px-2">
                    <span className="text-xs text-gray-500">Fills</span>
                    <button onClick={handleAddFill} className="text-gray-500 hover:text-white"><Plus size={12} /></button>
                </div>
                <div className="space-y-1">
                    {fills.map((fill, i) => (
                        <FillRow 
                            key={fill.id || i} 
                            fill={fill} 
                            index={i} 
                            onUpdate={(u) => updateFill(i, u)} 
                            onRemove={() => removeFill(i)} 
                        />
                    ))}
                </div>
            </div>

            {/* Strokes */}
            <div>
                <div className="flex justify-between items-center mb-2 px-2">
                    <span className="text-xs text-gray-500">Strokes</span>
                    <button onClick={handleAddStroke} className="text-gray-500 hover:text-white"><Plus size={12} /></button>
                </div>
                <div className="space-y-1">
                    {strokes.map((stroke, i) => (
                        <StrokeRow 
                            key={stroke.id || i} 
                            stroke={stroke} 
                            index={i} 
                            onUpdate={(u) => updateStroke(i, u)} 
                            onRemove={() => removeStroke(i)} 
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
