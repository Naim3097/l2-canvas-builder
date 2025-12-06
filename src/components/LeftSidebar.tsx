import React, { useState } from 'react';
import LayersPanel from './LayersPanel';
import AssetsPanel from './AssetsPanel';
import { ElementsPanel } from './ElementsPanel';
import { Shape } from '@/types/shapes';

interface LeftSidebarProps {
    shapes: Shape[];
    onShapesChange: (shapes: Shape[]) => void;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
    assets: string[];
    onAddAsset: (src: string) => void;
    onAddImageToCanvas: (src: string, width: number, height: number) => void;
    onAddShape: (type: string, data?: any) => void;
}

export default function LeftSidebar({ 
    shapes, 
    onShapesChange, 
    selectedIds, 
    onSelectionChange,
    assets,
    onAddAsset,
    onAddImageToCanvas,
    onAddShape
}: LeftSidebarProps) {
    const [activeTab, setActiveTab] = useState<'layers' | 'assets' | 'elements'>('layers');

    return (
        <div className="w-60 border-r border-gray-800 flex flex-col bg-[#0f0f0f]">
          <div className="flex border-b border-gray-800">
             <button onClick={() => setActiveTab('layers')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'layers' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>Layers</button>
             <button onClick={() => setActiveTab('elements')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'elements' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>Elements</button>
             <button onClick={() => setActiveTab('assets')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'assets' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>Assets</button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'layers' && (
                <LayersPanel 
                  shapes={shapes} 
                  onShapesChange={onShapesChange}
                  selectedIds={selectedIds} 
                  onSelectionChange={onSelectionChange}
                />
            )}
            {activeTab === 'elements' && (
                <ElementsPanel onAddShape={onAddShape} />
            )}
            {activeTab === 'assets' && (
                <AssetsPanel 
                    assets={assets}
                    onAddAsset={onAddAsset}
                    onAddImageToCanvas={onAddImageToCanvas}
                />
            )}
          </div>
        </div>
    );
}
