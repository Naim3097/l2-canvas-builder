import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAction: (action: string) => void;
    selectedCount: number;
    canUngroup: boolean;
    canGroup: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onAction, selectedCount, canUngroup, canGroup }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div 
            ref={menuRef}
            className="fixed z-50 bg-[#1e1e1e] border border-gray-700 rounded shadow-xl py-1 min-w-[160px]"
            style={{ top: y, left: x }}
        >
            <button onClick={() => onAction('cut')} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white flex justify-between">
                <span>Cut</span> <span className="text-gray-500 text-xs">Ctrl+X</span>
            </button>
            <button onClick={() => onAction('copy')} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white flex justify-between">
                <span>Copy</span> <span className="text-gray-500 text-xs">Ctrl+C</span>
            </button>
            <button onClick={() => onAction('paste')} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white flex justify-between">
                <span>Paste</span> <span className="text-gray-500 text-xs">Ctrl+V</span>
            </button>
            <div className="h-px bg-gray-700 my-1"></div>
            <button onClick={() => onAction('group')} disabled={!canGroup} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white flex justify-between disabled:opacity-50 disabled:hover:bg-transparent">
                <span>Group</span> <span className="text-gray-500 text-xs">Ctrl+G</span>
            </button>
            <button onClick={() => onAction('ungroup')} disabled={!canUngroup} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white flex justify-between disabled:opacity-50 disabled:hover:bg-transparent">
                <span>Ungroup</span> <span className="text-gray-500 text-xs">Ctrl+Shift+G</span>
            </button>
            <div className="h-px bg-gray-700 my-1"></div>
            <button onClick={() => onAction('delete')} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white flex justify-between">
                <span>Delete</span> <span className="text-gray-500 text-xs">Del</span>
            </button>
            <div className="h-px bg-gray-700 my-1"></div>
            <button onClick={() => onAction('bringToFront')} disabled={selectedCount === 0} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent">
                Bring to Front
            </button>
            <button onClick={() => onAction('sendToBack')} disabled={selectedCount === 0} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent">
                Send to Back
            </button>
            <div className="h-px bg-gray-700 my-1"></div>
            <button onClick={() => onAction('group')} disabled={!canGroup} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent flex justify-between">
                <span>Group</span> <span className="text-gray-500 text-xs">Ctrl+G</span>
            </button>
            <button onClick={() => onAction('ungroup')} disabled={!canUngroup} className="w-full text-left px-4 py-1.5 text-sm text-gray-200 hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:hover:bg-transparent flex justify-between">
                <span>Ungroup</span> <span className="text-gray-500 text-xs">Ctrl+Shift+G</span>
            </button>
        </div>
    );
};
