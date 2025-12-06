'use client';
import React, { useState, useEffect } from 'react';
import LeftSidebar from '@/components/LeftSidebar';
import CanvasArea from '@/components/CanvasArea';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { Toolbar } from '@/components/Toolbar';
import { useEditorState } from '@/hooks/useEditorState';

import { NewDocumentModal } from '@/components/NewDocumentModal';
import { Shape } from '@/types/shapes';
import { findShape } from '@/utils/treeUtils';

export default function Workspace() {
  const [activeTool, setActiveTool] = useState<'select' | 'direct-select' | 'rect' | 'pen' | 'text' | 'type-on-path' | 'artboard' | 'shape-builder'>('select');
  const [exportRequest, setExportRequest] = useState<{ format: 'png' | 'jpg' | 'svg' | 'pdf', scale: number } | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [resetViewTrigger, setResetViewTrigger] = useState<number | null>(null);
  const [resetStateTrigger, setResetStateTrigger] = useState<number | null>(null);
  
  // UI State
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  const {
    shapes, setShapes,
    selectedIds, setSelectedIds,
    components, setComponents,
    clipboard,
    history,
    undo, redo,
    bringToFront, sendToBack,
    updateShape, deleteShape, moveShape,
    groupShapes, ungroupShapes,
    copy, paste, duplicate,
    addToHistory,
    assets, addAsset, addOrUpdateImage,
    makeMask, releaseMask, booleanOperation, makeCompoundPath,
    createComponent, detachInstance, selectSimilar,
    traceImageSelection,
    mergeShapes,
    cropImage,
    viewMode, setViewMode,
    globalEditMode, setGlobalEditMode,
    documentId, setDocumentId, clearHistory,
    addShape
  } = useEditorState();

  const handleNewDocument = (width: number, height: number, name: string) => {
      // Clear canvas and set up new artboard
      const newArtboard: Shape = {
          id: `artboard-${Date.now()}`,
          type: 'artboard',
          x: 100,
          y: 100,
          width: width,
          height: height,
          fill: '#ffffff',
          name: name,
          children: []
      };
      setShapes([newArtboard]);
      setSelectedIds([]);
      setDocumentId(`doc-${Date.now()}`);
      clearHistory();
      setIsNewDocModalOpen(false);
  };



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore shortcuts if user is typing in an input
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            if (e.shiftKey) redo(); else undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            redo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
            e.preventDefault();
            if (e.shiftKey) {
                ungroupShapes();
            } else {
                groupShapes();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            copy();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            paste();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            duplicate();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '8') {
            e.preventDefault();
            makeCompoundPath();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '7') {
            e.preventDefault();
            makeMask();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedIds.length > 0) {
                deleteShape(selectedIds);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, shapes, selectedIds, clipboard, undo, redo, groupShapes, ungroupShapes, copy, paste, duplicate, deleteShape]);

  const canUngroup = selectedIds.some(id => {
      const shape = findShape(shapes, id);
      return shape && shape.type === 'group';
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121212] text-white overflow-hidden">
      {/* Top Toolbar */}
      {!previewMode && (
      <Toolbar 
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        undo={undo}
        redo={redo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        groupShapes={groupShapes}
        ungroupShapes={ungroupShapes}
        makeMask={makeMask}
        booleanOperation={booleanOperation}
        makeCompoundPath={makeCompoundPath}
        selectedCount={selectedIds.length}
        canUngroup={canUngroup}
        onNewDocument={() => setIsNewDocModalOpen(true)}
        leftPanelOpen={leftPanelOpen}
        setLeftPanelOpen={setLeftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        setRightPanelOpen={setRightPanelOpen}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        onResetView={() => setResetViewTrigger(Date.now())}
      />
      )}
      
      {previewMode && (
          <div className="absolute top-4 right-4 z-50">
              <button onClick={() => setPreviewMode(false)} className="bg-black/50 hover:bg-black/80 text-white px-4 py-2 rounded-full backdrop-blur-sm transition">Exit Preview</button>
          </div>
      )}

      <NewDocumentModal 
        isOpen={isNewDocModalOpen} 
        onClose={() => setIsNewDocModalOpen(false)} 
        onCreate={handleNewDocument} 
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar - Layers */}
        <div 
            className={`border-r border-gray-800 bg-[#1a1a1a] transition-all duration-300 ease-in-out overflow-hidden ${leftPanelOpen && !previewMode ? 'w-64 opacity-100' : 'w-0 opacity-0 border-none'}`}
        >
            <div className="w-64 h-full">
                <LeftSidebar 
                    shapes={shapes}
                    onShapesChange={setShapes}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    assets={assets}
                    onAddAsset={addAsset}
                    onAddImageToCanvas={addOrUpdateImage}
                    onAddShape={addShape}
                />
            </div>
        </div>

        {/* Canvas Center */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] p-4 transition-all duration-300">
            <div className="flex-1 relative rounded-lg overflow-hidden shadow-2xl border border-gray-800/50">
                <CanvasArea 
                    key={documentId}
                    shapes={shapes}
                    components={components}
                    onShapesChange={setShapes}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    activeTool={activeTool}
                    exportRequest={exportRequest}
                    onExportComplete={() => setExportRequest(null)}
                    onMergeShapes={mergeShapes}
                    viewMode={viewMode}
                    resetViewTrigger={resetViewTrigger}
                    resetStateTrigger={resetStateTrigger}
                    canUngroup={canUngroup}
                    canGroup={selectedIds.length > 0}
                    onContextMenuAction={(action) => {
                        switch(action) {
                            case 'cut': copy(); deleteShape(selectedIds); break;
                            case 'copy': copy(); break;
                            case 'paste': paste(); break;
                            case 'delete': deleteShape(selectedIds); break;
                            case 'group': groupShapes(); break;
                            case 'ungroup': ungroupShapes(); break;
                            case 'bringToFront': bringToFront(); break;
                            case 'sendToBack': sendToBack(); break;
                        }
                    }}
                />
            </div>
        </div>

        {/* Right Sidebar - Properties */}
        <div 
            className={`border-l border-gray-800 bg-[#0f0f0f] transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${rightPanelOpen && !previewMode ? 'w-80 opacity-100' : 'w-0 opacity-0 border-none'}`}
        >
          <div className="w-80 h-full flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Properties</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
                <PropertiesPanel 
                    selectedIds={selectedIds} 
                    shapes={shapes} 
                    onUpdate={(updates) => {
                        selectedIds.forEach(id => updateShape(id, updates));
                    }}
                    onMove={(direction) => {
                        selectedIds.forEach(id => moveShape(id, direction));
                    }}
                    onCreateComponent={createComponent}
                    onDetachInstance={detachInstance}
                    onExport={(format, scale) => setExportRequest({ format, scale })}
                    onSelectSimilar={selectSimilar}
                    onTraceImage={traceImageSelection}
                    onReleaseMask={releaseMask}
                    onCropImage={cropImage}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    globalEditMode={globalEditMode}
                    setGlobalEditMode={setGlobalEditMode}
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}





