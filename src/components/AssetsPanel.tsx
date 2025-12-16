import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AssetsPanelProps {
    assets: string[];
    onAddAsset: (src: string) => void;
    onRemoveAsset: (src: string) => void;
    onAddImageToCanvas: (src: string, width: number, height: number, x?: number, y?: number) => void;
}

export default function AssetsPanel({ assets, onAddAsset, onRemoveAsset, onAddImageToCanvas }: AssetsPanelProps) {
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
    
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const src = event.target?.result as string;
                onAddAsset(src);
                
                const img = new window.Image();
                img.src = src;
                img.onload = () => {
                    onAddImageToCanvas(src, img.width, img.height);
                };
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const handleAssetClick = (src: string, e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            setSelectedAssets(prev => 
                prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]
            );
        } else {
            setSelectedAssets([src]);
        }
    };

    const handleAssetDoubleClick = (src: string) => {
        const img = new window.Image();
        img.src = src;
        img.onload = () => {
            onAddImageToCanvas(src, img.width, img.height);
        };
    };

    const handleAddSelected = () => {
        selectedAssets.forEach((src, index) => {
            const img = new window.Image();
            img.src = src;
            img.onload = () => {
                // Offset slightly so they don't stack perfectly
                const offset = index * 20;
                onAddImageToCanvas(src, img.width, img.height, 100 + offset, 100 + offset);
            };
        });
        setSelectedAssets([]);
    };

    const handleDragStart = (e: React.DragEvent, src: string) => {
        e.dataTransfer.setData('application/x-ide-asset', src);
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', src);
    };

    return (
        <div className="p-4">
            <div className="mb-4 flex gap-2">
                <label className="flex-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-center py-2 rounded cursor-pointer text-xs text-gray-300 border border-dashed border-gray-600">
                    + Upload Image
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                </label>
                {selectedAssets.length > 0 && (
                    <button 
                        onClick={handleAddSelected}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 rounded"
                    >
                        Add Selected ({selectedAssets.length})
                    </button>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
                {assets.map((src, i) => (
                    <div 
                        key={i} 
                        className={`group relative aspect-square bg-[#2d2d2d] rounded overflow-hidden cursor-pointer ${selectedAssets.includes(src) ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-600'}`}
                        onClick={(e) => handleAssetClick(src, e)}
                        onDoubleClick={() => handleAssetDoubleClick(src)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, src)}
                    >
                        <img src={src} className="w-full h-full object-cover" />
                        
                        {/* Overlay with Remove Button */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveAsset(src);
                                }}
                                className="bg-black/50 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-sm"
                                title="Remove Asset"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
