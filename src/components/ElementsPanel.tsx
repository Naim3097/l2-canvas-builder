import React from 'react';
import { 
    Square, Circle, Triangle, Star, Heart, ArrowRight, Minus, Hexagon, 
    MessageSquare, Plus, Octagon, 
    Home, User, Search, Menu, Settings, Check, X, Mail, Bell,
    Layout, CreditCard, Type
} from 'lucide-react';

interface ElementsPanelProps {
    onAddShape: (type: string, data?: any) => void;
}

const SHAPES = [
    { label: 'Rectangle', type: 'rect', icon: Square },
    { label: 'Circle', type: 'circle', icon: Circle },
    { label: 'Triangle', type: 'path', icon: Triangle, data: 'M 50 0 L 100 100 L 0 100 Z' },
    { label: 'Star', type: 'path', icon: Star, data: 'M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z' },
    { label: 'Heart', type: 'path', icon: Heart, data: 'M 50 88.9 L 42.8 82.4 C 17.2 59.2 0.3 43.9 0.3 25.1 C 0.3 9.8 12.3 -2.2 27.6 -2.2 C 36.3 -2.2 44.6 6.2 50 12.6 C 55.4 6.2 63.7 -2.2 72.4 -2.2 C 87.7 -2.2 99.7 9.8 99.7 25.1 C 99.7 43.9 82.8 59.2 57.2 82.4 L 50 88.9 Z' },
    { label: 'Arrow', type: 'path', icon: ArrowRight, data: 'M 0 30 L 60 30 L 60 10 L 100 50 L 60 90 L 60 70 L 0 70 Z' },
    { label: 'Line', type: 'path', icon: Minus, data: 'M 0 5 L 100 5 L 100 -5 L 0 -5 Z' },
    { label: 'Hexagon', type: 'path', icon: Hexagon, data: 'M 25 0 L 75 0 L 100 43.3 L 75 86.6 L 25 86.6 L 0 43.3 Z' },
    { label: 'Octagon', type: 'path', icon: Octagon, data: 'M 29.3 0 L 70.7 0 L 100 29.3 L 100 70.7 L 70.7 100 L 29.3 100 L 0 70.7 L 0 29.3 Z' },
    { label: 'Speech', type: 'path', icon: MessageSquare, data: 'M 10 10 L 90 10 L 90 70 L 60 70 L 40 90 L 40 70 L 10 70 Z' },
    { label: 'Cross', type: 'path', icon: Plus, data: 'M 35 0 L 65 0 L 65 35 L 100 35 L 100 65 L 65 65 L 65 100 L 35 100 L 35 65 L 0 65 L 0 35 L 35 35 Z' },
];

const ICONS = [
    { label: 'Home', icon: Home, data: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
    { label: 'User', icon: User, data: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
    { label: 'Search', icon: Search, data: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35' },
    { label: 'Menu', icon: Menu, data: 'M3 12h18 M3 6h18 M3 18h18' },
    { label: 'Settings', icon: Settings, data: 'M12.22 2h-.44a2 2 0 0 1-2-1.08l-.12-.24a2 2 0 0 0-2.66-.96l-.24.1a2 2 0 0 1-2.42-.64l-.1-.14a2 2 0 0 0-2.72-.34l-.2.16a2 2 0 0 1-2.56.22l-.16-.1a2 2 0 0 0-2.8.62l-.08.2a2 2 0 0 1-2.16 1.34l-.24.04a2 2 0 0 0-2.16 1.92l.04.24a2 2 0 0 1-1.34 2.16l-.2.08a2 2 0 0 0-.62 2.8l.1.16a2 2 0 0 1-.22 2.56l-.16.2a2 2 0 0 0 .34 2.72l.14.1a2 2 0 0 1 .64 2.42l-.1.24a2 2 0 0 0 .96 2.66l.24.12a2 2 0 0 1 1.08 2h.44a2 2 0 0 1 2 1.08l.12.24a2 2 0 0 0 2.66.96l.24-.1a2 2 0 0 1 2.42.64l.1.14a2 2 0 0 0 2.72.34l.2-.16a2 2 0 0 1 2.56-.22l.16.1a2 2 0 0 0 2.8-.62l.08-.2a2 2 0 0 1 2.16-1.34l.24-.04a2 2 0 0 0 2.16-1.92l-.04-.24a2 2 0 0 1 1.34-2.16l.2-.08a2 2 0 0 0 .62-2.8l-.1-.16a2 2 0 0 1 .22-2.56l.16-.2a2 2 0 0 0-.34-2.72l-.14-.1a2 2 0 0 1-.64-2.42l.1-.24a2 2 0 0 0-.96-2.66l-.24-.12a2 2 0 0 1-1.08-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' }, // Simplified path for demo
    { label: 'Check', icon: Check, data: 'M20 6L9 17l-5-5' },
    { label: 'Close', icon: X, data: 'M18 6L6 18M6 6l12 12' },
    { label: 'Mail', icon: Mail, data: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6' },
    { label: 'Bell', icon: Bell, data: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0' },
];

const UI_KITS = [
    { label: 'Button', type: 'button', icon: Layout },
    { label: 'Card', type: 'card', icon: CreditCard },
    { label: 'Input', type: 'input', icon: Type },
];

export function ElementsPanel({ onAddShape }: ElementsPanelProps) {
    return (
        <div className="p-4 space-y-6">
            {/* Basic Shapes */}
            <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Basic Shapes</h3>
                <div className="grid grid-cols-3 gap-2">
                    {SHAPES.map((shape, i) => (
                        <button
                            key={i}
                            onClick={() => onAddShape(shape.type, shape.data)}
                            className="flex flex-col items-center justify-center p-2 bg-[#1e1e1e] hover:bg-[#2a2a2a] rounded border border-transparent hover:border-gray-600 transition-all group"
                            title={shape.label}
                        >
                            <shape.icon size={24} className="text-gray-400 group-hover:text-white mb-1" />
                            <span className="text-[10px] text-gray-500 group-hover:text-gray-300">{shape.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Wireframe Kit */}
            <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Wireframe Kit</h3>
                <div className="grid grid-cols-3 gap-2">
                    {UI_KITS.map((item, i) => (
                        <button
                            key={i}
                            onClick={() => onAddShape(item.type)}
                            className="flex flex-col items-center justify-center p-2 bg-[#1e1e1e] hover:bg-[#2a2a2a] rounded border border-transparent hover:border-gray-600 transition-all group"
                            title={item.label}
                        >
                            <item.icon size={24} className="text-gray-400 group-hover:text-white mb-1" />
                            <span className="text-[10px] text-gray-500 group-hover:text-gray-300">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Icons */}
            <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Icons</h3>
                <div className="grid grid-cols-4 gap-2">
                    {ICONS.map((icon, i) => (
                        <button
                            key={i}
                            onClick={() => onAddShape('icon', icon.data)}
                            className="flex flex-col items-center justify-center p-2 bg-[#1e1e1e] hover:bg-[#2a2a2a] rounded border border-transparent hover:border-gray-600 transition-all group"
                            title={icon.label}
                        >
                            <icon.icon size={20} className="text-gray-400 group-hover:text-white" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
