import React from 'react';
import { X, File, Smartphone, Monitor, Printer } from 'lucide-react';

interface NewDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (width: number, height: number, name: string) => void;
}

const PRESETS = [
    { name: 'iPhone 14 Pro', width: 393, height: 852, icon: <Smartphone size={24} /> },
    { name: 'Web Large', width: 1920, height: 1080, icon: <Monitor size={24} /> },
    { name: 'Instagram Post', width: 1080, height: 1080, icon: <Monitor size={24} /> },
    { name: 'A4 (Print)', width: 595, height: 842, icon: <Printer size={24} /> }, // 72 DPI
    { name: 'Letter (Print)', width: 612, height: 792, icon: <Printer size={24} /> },
];

export const NewDocumentModal: React.FC<NewDocumentModalProps> = ({ isOpen, onClose, onCreate }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] w-[600px] rounded-lg shadow-2xl border border-gray-800 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-white">New Document</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 grid grid-cols-3 gap-4">
                    {PRESETS.map((preset) => (
                        <button 
                            key={preset.name}
                            onClick={() => onCreate(preset.width, preset.height, preset.name)}
                            className="flex flex-col items-center justify-center gap-3 p-4 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-transparent hover:border-blue-500 transition group"
                        >
                            <div className="text-gray-400 group-hover:text-blue-400">
                                {preset.icon}
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-medium text-white">{preset.name}</div>
                                <div className="text-xs text-gray-500 mt-1">{preset.width} x {preset.height}</div>
                            </div>
                        </button>
                    ))}
                    
                    <button 
                        onClick={() => onCreate(800, 600, 'Custom')}
                        className="flex flex-col items-center justify-center gap-3 p-4 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-transparent hover:border-blue-500 transition group"
                    >
                        <div className="text-gray-400 group-hover:text-blue-400">
                            <File size={24} />
                        </div>
                        <div className="text-center">
                            <div className="text-sm font-medium text-white">Custom</div>
                            <div className="text-xs text-gray-500 mt-1">800 x 600</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
