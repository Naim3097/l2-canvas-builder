import React, { useState } from 'react';

interface AssetsPanelProps {
    assets: string[];
    onAddAsset: (src: string) => void;
    onAddImageToCanvas: (src: string, width: number, height: number) => void;
}

export default function AssetsPanel({ assets, onAddAsset, onAddImageToCanvas }: AssetsPanelProps) {
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
                // We can't easily pass offset here without changing onAddImageToCanvas signature or logic
                // But onAddImageToCanvas likely puts it at a default position.
                // Let's just add them.
                onAddImageToCanvas(src, img.width, img.height);
            };
        });
        setSelectedAssets([]);
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
                        className={`aspect-square bg-[#2d2d2d] rounded overflow-hidden cursor-pointer ${selectedAssets.includes(src) ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-gray-600'}`}
                        onClick={(e) => handleAssetClick(src, e)}
                        onDoubleClick={() => handleAssetDoubleClick(src)}
                    >
                        <img src={src} className="w-full h-full object-cover" />
                    </div>
                ))}
            </div>
        </div>
    );
}
