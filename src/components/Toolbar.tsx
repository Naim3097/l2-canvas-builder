import React from 'react';
import { MousePointer2, MousePointer, Undo, Redo, Group as GroupIcon, Ungroup as UngroupIcon, Layout, Combine, Scissors, Divide, Type, FilePlus, Merge, PanelLeftClose, PanelRightClose, Eye, Maximize } from 'lucide-react';

interface ToolbarProps {
    activeTool: 'select' | 'direct-select' | 'rect' | 'pen' | 'text' | 'type-on-path' | 'artboard' | 'shape-builder';
    setActiveTool: (tool: 'select' | 'direct-select' | 'rect' | 'pen' | 'text' | 'type-on-path' | 'artboard' | 'shape-builder') => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    groupShapes: () => void;
    ungroupShapes: () => void;
    makeMask: () => void;
    booleanOperation: (op: 'unite' | 'subtract' | 'intersect' | 'exclude') => void;
    makeCompoundPath: () => void;
    selectedCount: number;
    canUngroup: boolean;
    onNewDocument: () => void;
    leftPanelOpen: boolean;
    setLeftPanelOpen: (open: boolean) => void;
    rightPanelOpen: boolean;
    setRightPanelOpen: (open: boolean) => void;
    previewMode: boolean;
    setPreviewMode: (mode: boolean) => void;
    onResetView?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    activeTool,
    setActiveTool,
    undo,
    redo,
    canUndo,
    canRedo,
    groupShapes,
    ungroupShapes,
    makeMask,
    booleanOperation,
    makeCompoundPath,
    selectedCount,
    canUngroup,
    onNewDocument,
    leftPanelOpen,
    setLeftPanelOpen,
    rightPanelOpen,
    setRightPanelOpen,
    previewMode,
    setPreviewMode,
    onResetView
}) => {
    return (
      <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             <button onClick={() => setLeftPanelOpen(!leftPanelOpen)} className={`p-1 rounded hover:bg-[#333] ${!leftPanelOpen ? 'text-blue-500' : 'text-gray-400'}`} title="Toggle Left Panel"><PanelLeftClose size={16} /></button>
             <div className="text-lg font-bold tracking-wider">X-IDE</div>
             <button onClick={onNewDocument} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white" title="New Document"><FilePlus size={16} /></button>
          </div>
          <div className="flex gap-1 bg-[#2a2a2a] rounded p-1">
            <button onClick={() => setActiveTool('select')} title="Select (V)" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'select' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}><MousePointer2 size={16} /></button>
            <button onClick={() => setActiveTool('direct-select')} title="Direct Select (A)" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'direct-select' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}><MousePointer size={16} className="text-white" /></button>
            <button onClick={() => setActiveTool('rect')} title="Rectangle (R)" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'rect' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}>Rectangle</button>
            <button onClick={() => setActiveTool('artboard')} title="Artboard (Shift+O)" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'artboard' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}>Artboard</button>
            <button onClick={() => setActiveTool('text')} title="Text (T)" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'text' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}>Text</button>
            <button onClick={() => setActiveTool('type-on-path')} title="Type on Path" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'type-on-path' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}><Type size={16} className="rotate-90" /></button>
            <button onClick={() => setActiveTool('pen')} title="Pen (P)" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'pen' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}>Pen</button>
            <button onClick={() => setActiveTool('shape-builder')} title="Shape Builder (Shift+M)" className={`px-3 py-1 rounded text-sm transition ${activeTool === 'shape-builder' ? 'bg-blue-600' : 'hover:bg-[#3a3a3a]'}`}><Merge size={16} /></button>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
             <button onClick={onResetView} className="hover:text-white flex items-center gap-1" title="Reset View (Ctrl+0)"><Maximize size={14} /> Reset View</button>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={undo} disabled={!canUndo} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Undo (Ctrl+Z)"><Undo size={18} /></button>
          <button onClick={redo} disabled={!canRedo} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Redo (Ctrl+Y)"><Redo size={18} /></button>
          <div className="w-px bg-gray-700"></div>
          <button onClick={groupShapes} disabled={selectedCount === 0} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Group (Ctrl+G)"><GroupIcon size={18} /></button>
          <button onClick={ungroupShapes} disabled={!canUngroup} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Ungroup (Ctrl+Shift+G)"><UngroupIcon size={18} /></button>
          <button onClick={makeMask} disabled={selectedCount < 2} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Make Clipping Mask (Ctrl+7)"><Layout size={18} /></button>
          <div className="w-px bg-gray-700"></div>
          <button onClick={() => booleanOperation('unite')} disabled={selectedCount < 2} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Unite"><Combine size={18} /></button>
          <button onClick={() => booleanOperation('subtract')} disabled={selectedCount < 2} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Subtract"><Scissors size={18} /></button>
          <button onClick={() => booleanOperation('intersect')} disabled={selectedCount < 2} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Intersect"><Divide size={18} /></button>
          <button onClick={() => booleanOperation('exclude')} disabled={selectedCount < 2} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Exclude"><Combine size={18} className="rotate-45" /></button>
          <div className="w-px bg-gray-700"></div>
          <button onClick={makeCompoundPath} disabled={selectedCount < 2} className="p-2 rounded hover:bg-[#2a2a2a] disabled:opacity-50" title="Make Compound Path (Ctrl+8)"><Combine size={18} /></button>
          <div className="w-px bg-gray-700"></div>
          <button onClick={() => setPreviewMode(!previewMode)} className={`p-2 rounded hover:bg-[#2a2a2a] ${previewMode ? 'bg-blue-600 text-white' : 'text-gray-400'}`} title="Preview Mode"><Eye size={18} /></button>
          <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className={`p-2 rounded hover:bg-[#2a2a2a] ${!rightPanelOpen ? 'text-blue-500' : 'text-gray-400'}`} title="Toggle Right Panel"><PanelRightClose size={18} /></button>
        </div>
      </div>
    );
};
