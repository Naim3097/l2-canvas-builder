import { useState, useCallback, useEffect } from 'react';
import { produce, applyPatches, Patch, enablePatches } from 'immer';
import { Shape, GroupShape } from '../types/shapes';
import { 
    updateShapeInTree, 
    deleteShapeInTree, 
    replaceShapeInTree, 
    ungroupShapeInTree, 
    moveShapeInTree,
    findShape,
    updateSimilarShapesInTree,
    getShapeDimensions,
    updateShapeInTreeMutable,
    deleteShapeInTreeMutable,
    moveShapeInTreeMutable
} from '../utils/treeUtils';
import { performBooleanOperation, createCompoundPath, getShapePathData } from '../utils/booleanOperations';
import { traceImage, extractPathFromSVG } from '@/utils/imageTracer';
import { generateUUID } from '../utils/idGenerator';

enablePatches();

interface EditorState {
    shapes: Shape[];
    components: Record<string, Shape>;
}

export const useEditorState = () => {
    const [state, setState] = useState<EditorState>({
        shapes: [
            { id: 'demo-rect-1', type: 'rect', x: 50, y: 50, width: 150, height: 100, fill: '#3b82f6', name: 'Blue Box', rotation: 0, opacity: 1 },
            { id: 'demo-rect-2', type: 'rect', x: 250, y: 80, width: 200, height: 80, fill: '#ef4444', name: 'Red Box', rotation: 0, opacity: 1 },
            { id: 'demo-text-1', type: 'text', x: 50, y: 200, text: 'Click me!', fontSize: 24, fill: '#000000', name: 'Text', fontFamily: 'Arial', fontWeight: 'normal', align: 'left', rotation: 0, opacity: 1 },
        ],
        components: {}
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [assets, setAssets] = useState<string[]>([]);
    const [clipboard, setClipboard] = useState<Shape[]>([]);
    
    const [history, setHistory] = useState<{
        past: { patches: Patch[], inversePatches: Patch[], beforeState?: EditorState, afterState?: EditorState }[], 
        future: { patches: Patch[], inversePatches: Patch[], beforeState?: EditorState, afterState?: EditorState }[]
    }>({ past: [], future: [] });
    
    const [viewMode, setViewMode] = useState<'rgb' | 'cmyk' | 'outline'>('rgb');
    const [globalEditMode, setGlobalEditMode] = useState(false);
    const [documentId, setDocumentId] = useState<string>('doc-1');

    // Persistence
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('x-ide-state');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.shapes) {
                        setState(prev => ({ ...prev, shapes: parsed.shapes, components: parsed.components || {} }));
                    }
                } catch (e) {
                    console.error('Failed to load state', e);
                }
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const timer = setTimeout(() => {
                localStorage.setItem('x-ide-state', JSON.stringify(state));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [state]);

    const clearHistory = useCallback(() => {
        setHistory({ past: [], future: [] });
    }, []);

    const performUpdate = useCallback((recipe: (draft: EditorState) => void, recordHistory = true) => {
        setState(currentState => {
            let patches: Patch[] = [];
            let inversePatches: Patch[] = [];

            const nextState = produce(currentState, recipe, (p, ip) => {
                patches = p;
                inversePatches = ip;
            });

            if (recordHistory && patches.length > 0) {
                // Store the complete before/after states instead of just patches
                // This is more reliable than trying to apply patches
                setHistory(prev => ({
                    past: [...prev.past, { 
                        patches, 
                        inversePatches,
                        beforeState: currentState,
                        afterState: nextState
                    }],
                    future: []
                }));
            }
            
            return nextState;
        });
    }, []);

    const addToHistory = useCallback(() => {
        // No-op in new system, handled by performUpdate(..., true)
    }, []);

    const undo = useCallback(() => {
        setHistory(prev => {
            if (prev.past.length === 0) {
                console.log('Nothing to undo');
                return prev;
            }
            
            const lastChange = prev.past[prev.past.length - 1];
            console.log('Undoing change, history:', prev.past.length - 1, 'remaining');
            
            // Use the stored beforeState which is guaranteed to be correct
            if (lastChange.beforeState) {
                console.log('Restoring beforeState');
                setState(lastChange.beforeState);
            } else {
                // Fallback: try to apply inverse patches if beforeState not available
                console.log('Applying inverse patches (fallback)');
                setState(currentState => applyPatches(currentState, lastChange.inversePatches));
            }
            
            return {
                past: prev.past.slice(0, -1),
                future: [lastChange, ...prev.future]
            };
        });
    }, []);

    const redo = useCallback(() => {
        setHistory(prev => {
            if (prev.future.length === 0) {
                console.log('Nothing to redo');
                return prev;
            }
            
            const nextChange = prev.future[0];
            console.log('Redoing change, history:', prev.past.length + 1, 'total');
            
            // Use the stored afterState which is guaranteed to be correct
            if (nextChange.afterState) {
                console.log('Restoring afterState');
                setState(nextChange.afterState);
            } else {
                // Fallback: try to apply patches if afterState not available
                console.log('Applying patches (fallback)');
                setState(currentState => applyPatches(currentState, nextChange.patches));
            }
            
            return {
                past: [...prev.past, nextChange],
                future: prev.future.slice(1)
            };
        });
    }, []);

    // Keyboard shortcuts for undo/redo (after undo/redo are defined)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
            
            if (ctrlOrCmd && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((ctrlOrCmd && e.key === 'z' && e.shiftKey) || (ctrlOrCmd && e.key === 'y')) {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const bringToFront = useCallback(() => {
        if (selectedIds.length === 0) return;
        performUpdate(draft => {
            selectedIds.forEach(id => {
                moveShapeInTreeMutable(draft.shapes, id, 'top');
            });
        }, true);
    }, [selectedIds, performUpdate]);

    const sendToBack = useCallback(() => {
        if (selectedIds.length === 0) return;
        performUpdate(draft => {
            selectedIds.forEach(id => {
                moveShapeInTreeMutable(draft.shapes, id, 'bottom');
            });
        }, true);
    }, [selectedIds, performUpdate]);

    const bringForward = useCallback(() => {
        if (selectedIds.length === 0) return;
        performUpdate(draft => {
            // Reverse to keep relative order when moving multiple
            [...selectedIds].reverse().forEach(id => {
                moveShapeInTreeMutable(draft.shapes, id, 'up');
            });
        }, true);
    }, [selectedIds, performUpdate]);

    const sendBackward = useCallback(() => {
        if (selectedIds.length === 0) return;
        performUpdate(draft => {
            selectedIds.forEach(id => {
                moveShapeInTreeMutable(draft.shapes, id, 'down');
            });
        }, true);
    }, [selectedIds, performUpdate]);

    // Compatibility wrappers
    const setShapes = useCallback((valueOrUpdater: Shape[] | ((prev: Shape[]) => Shape[]), recordHistory = false) => {
        performUpdate(draft => {
            if (typeof valueOrUpdater === 'function') {
                draft.shapes = valueOrUpdater(draft.shapes as Shape[]);
            } else {
                draft.shapes = valueOrUpdater;
            }
        }, recordHistory);
    }, [performUpdate]);

    const setComponents = useCallback((valueOrUpdater: Record<string, Shape> | ((prev: Record<string, Shape>) => Record<string, Shape>)) => {
        performUpdate(draft => {
             if (typeof valueOrUpdater === 'function') {
                draft.components = valueOrUpdater(draft.components as Record<string, Shape>);
            } else {
                draft.components = valueOrUpdater;
            }
        }, false);
    }, [performUpdate]);

    const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
        performUpdate(draft => {
            if (globalEditMode) {
                draft.shapes = updateSimilarShapesInTree(draft.shapes as Shape[], id, updates);
            } else {
                updateShapeInTreeMutable(draft.shapes, id, updates);
            }
        }, true);
    }, [performUpdate, globalEditMode]);

    const updateShapes = useCallback((updatesMap: Record<string, Partial<Shape>>) => {
        performUpdate(draft => {
            Object.entries(updatesMap).forEach(([id, updates]) => {
                if (globalEditMode) {
                    draft.shapes = updateSimilarShapesInTree(draft.shapes as Shape[], id, updates);
                } else {
                    updateShapeInTreeMutable(draft.shapes, id, updates);
                }
            });
        }, true);
    }, [performUpdate, globalEditMode]);

    const deleteShape = useCallback((idOrIds: string | string[]) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        performUpdate(draft => {
            ids.forEach(id => {
                deleteShapeInTreeMutable(draft.shapes, id);
            });
        }, true);
        setSelectedIds(prev => prev.filter(pid => !ids.includes(pid)));
    }, [performUpdate]);

    const moveShape = useCallback((id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
        performUpdate(draft => {
            moveShapeInTreeMutable(draft.shapes, id, direction);
        }, true);
    }, [performUpdate]);

    const groupShapes = useCallback(() => {
        if (selectedIds.length === 0) return;
        
        let newGroupId = '';

        performUpdate(draft => {
            // Helper to find shape and its parent list
            const findShapeAndParent = (currentList: Shape[], id: string): { shape: Shape, parentList: Shape[] } | null => {
                for (const shape of currentList) {
                    if (shape.id === id) {
                        return { shape, parentList: currentList };
                    }
                    if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
                        const found = findShapeAndParent(shape.children, id);
                        if (found) return found;
                    }
                }
                return null;
            };

            const shapesToGroup: { shape: Shape, parentList: Shape[] }[] = [];
            selectedIds.forEach(id => {
                const result = findShapeAndParent(draft.shapes as Shape[], id);
                if (result) shapesToGroup.push(result);
            });

            if (shapesToGroup.length === 0) return;

            // Use the parent of the last selected item as the target parent
            const targetParentList = shapesToGroup[shapesToGroup.length - 1].parentList;
            const selectedShapes = shapesToGroup.map(s => s.shape);

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            selectedShapes.forEach(s => {
                const { width: w, height: h } = getShapeDimensions(s);
                minX = Math.min(minX, s.x);
                minY = Math.min(minY, s.y);
                maxX = Math.max(maxX, s.x + w);
                maxY = Math.max(maxY, s.y + h);
            });

            const groupX = minX;
            const groupY = minY;
            const groupW = maxX - minX;
            const groupH = maxY - minY;

            newGroupId = `group-${Date.now()}`;
            const newGroup: GroupShape = {
                id: newGroupId,
                type: 'group',
                x: groupX,
                y: groupY,
                width: groupW,
                height: groupH,
                children: selectedShapes.map(s => ({ ...s, x: s.x - groupX, y: s.y - groupY })),
                visible: true,
                locked: false,
                name: 'Group'
            };

            // Remove shapes from their respective parents
            shapesToGroup.forEach(({ shape, parentList }) => {
                const idx = parentList.findIndex(s => s.id === shape.id);
                if (idx !== -1) parentList.splice(idx, 1);
            });

            // Add new group to the target parent
            targetParentList.push(newGroup);

        }, true);

        if (newGroupId) setSelectedIds([newGroupId]);
    }, [state.shapes, selectedIds, performUpdate]);

    const ungroupShapes = useCallback(() => {
        if (selectedIds.length === 0) return;
        
        let newSelectedIds: string[] = [];

        performUpdate(draft => {
            selectedIds.forEach(id => {
                const shape = findShape(draft.shapes as Shape[], id);
                if (shape && shape.type === 'group') {
                     newSelectedIds.push(...shape.children.map(c => c.id));
                     // ungroupShapeInTree is immutable, so we replace shapes
                     // Ideally we implement mutable ungroup
                     draft.shapes = ungroupShapeInTree(draft.shapes as Shape[], id);
                }
            });
        }, true);

        if (newSelectedIds.length > 0) {
            setSelectedIds(newSelectedIds);
        }
    }, [state.shapes, selectedIds, performUpdate]);

    const copy = useCallback(() => {
        if (selectedIds.length === 0) return;
        const selectedShapes = selectedIds.map(id => findShape(state.shapes, id)).filter(s => s) as Shape[];
        if (selectedShapes.length > 0) {
            setClipboard(selectedShapes);
        }
    }, [state.shapes, selectedIds]);

    const paste = useCallback(() => {
        if (clipboard.length === 0) return;
        
        const newIds: string[] = [];

        performUpdate(draft => {
            clipboard.forEach((clipShape, index) => {
                const newId = `${clipShape.type}-${generateUUID()}`;
                const newShape = {
                    ...clipShape,
                    id: newId,
                    x: clipShape.x + 20,
                    y: clipShape.y + 20,
                    name: clipShape.name ? `${clipShape.name} (Copy)` : undefined
                } as Shape;

                if (clipShape.type === 'group' || clipShape.type === 'artboard') {
                     const updateChildrenIds = (items: Shape[]): Shape[] => {
                         return items.map(item => ({
                             ...item,
                             id: `${item.type}-${generateUUID()}`,
                             children: (item.type === 'group' || item.type === 'artboard') && item.children ? updateChildrenIds(item.children) : undefined
                         } as Shape));
                     };
                     if (clipShape.children) {
                         (newShape as any).children = updateChildrenIds(clipShape.children);
                     }
                }
                draft.shapes.push(newShape);
                newIds.push(newId);
            });
        }, true);

        setSelectedIds(newIds);
    }, [clipboard, performUpdate]);

    const duplicate = useCallback(() => {
        if (selectedIds.length === 0) return;
        
        const newIds: string[] = [];
        
        performUpdate(draft => {
            const selectedShapes = selectedIds.map(id => findShape(draft.shapes as Shape[], id)).filter(s => s) as Shape[];
            
            const regenerateIds = (s: Shape): Shape => {
                const newS = { ...s, id: `${s.type}-${generateUUID()}` };
                if ((newS.type === 'group' || newS.type === 'artboard') && newS.children) {
                    newS.children = newS.children.map(regenerateIds);
                }
                return newS;
            };

            selectedShapes.forEach((shape) => {
                const clone = JSON.parse(JSON.stringify(shape));
                const finalClone = regenerateIds(clone);
                finalClone.x += 20;
                finalClone.y += 20;
                finalClone.name = `${finalClone.name} (Copy)`;
                
                draft.shapes.push(finalClone);
                newIds.push(finalClone.id);
            });
        }, true);
        
        setSelectedIds(newIds);
    }, [state.shapes, selectedIds, performUpdate]);

    const addAsset = useCallback((src: string) => {
        setAssets(prev => [...prev, src]);
    }, []);

    const removeAsset = useCallback((src: string) => {
        setAssets(prev => prev.filter(a => a !== src));
    }, []);

    const addShape = useCallback((type: string, data?: any, x?: number, y?: number) => {
        let newId = '';
        performUpdate(draft => {
            const id = `${type}-${generateUUID()}`;
            let newShape: Shape;
            
            const defaultX = x ?? 100;
            const defaultY = y ?? 100;

            if (type === 'rect') {
                newShape = {
                    id, type: 'rect', x: defaultX, y: defaultY, width: 100, height: 100, fill: '#cccccc', name: 'Rectangle'
                };
            } else if (type === 'circle') {
                newShape = {
                    id, type: 'circle', x: defaultX + 50, y: defaultY + 50, radius: 50, fill: '#cccccc', name: 'Circle'
                } as any;
            } else if (type === 'path') {
                newShape = {
                    id, type: 'path', x: defaultX, y: defaultY, width: 100, height: 100, data: data, fill: '#cccccc', name: 'Shape',
                    stroke: '#000000', strokeWidth: 1
                };
            } else if (type === 'icon') {
                newShape = {
                    id, type: 'path', x: defaultX, y: defaultY, width: 40, height: 40, data: data, fill: '#333333', name: 'Icon',
                    scaleX: 1, scaleY: 1, stroke: '#000000', strokeWidth: 0
                };
            } else if (type === 'button') {
                newShape = {
                    id, type: 'group', x: defaultX, y: defaultY, width: 120, height: 40, name: 'Button',
                    children: [
                        { id: `${id}-bg`, type: 'rect', x: 0, y: 0, width: 120, height: 40, fill: '#3b82f6', cornerRadius: 6, name: 'Background' } as any,
                        { id: `${id}-text`, type: 'text', x: 0, y: 0, width: 120, height: 40, text: 'Button', fontSize: 14, fill: '#ffffff', align: 'center', verticalAlign: 'middle', name: 'Label' } as any
                    ]
                };
            } else if (type === 'card') {
                newShape = {
                    id, type: 'group', x: defaultX, y: defaultY, width: 200, height: 250, name: 'Card',
                    children: [
                        { id: `${id}-bg`, type: 'rect', x: 0, y: 0, width: 200, height: 250, fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 1, cornerRadius: 8, name: 'Background' } as any,
                        { id: `${id}-img`, type: 'rect', x: 0, y: 0, width: 200, height: 120, fill: '#f3f4f6', cornerRadius: 8, name: 'Image Placeholder' } as any, // Top rounded only ideally
                        { id: `${id}-title`, type: 'text', x: 16, y: 136, text: 'Card Title', fontSize: 18, fontWeight: 'bold', fill: '#111827', name: 'Title' } as any,
                        { id: `${id}-desc`, type: 'text', x: 16, y: 164, text: 'Description goes here...', fontSize: 12, fill: '#6b7280', width: 168, name: 'Description' } as any
                    ]
                };
            } else if (type === 'input') {
                newShape = {
                    id, type: 'group', x: defaultX, y: defaultY, width: 200, height: 40, name: 'Input',
                    children: [
                        { id: `${id}-bg`, type: 'rect', x: 0, y: 0, width: 200, height: 40, fill: '#ffffff', stroke: '#d1d5db', strokeWidth: 1, cornerRadius: 4, name: 'Border' } as any,
                        { id: `${id}-text`, type: 'text', x: 12, y: 10, text: 'Placeholder...', fontSize: 14, fill: '#9ca3af', name: 'Placeholder' } as any
                    ]
                };
            } else {
                return;
            }
            
            draft.shapes.push(newShape);
            newId = newShape.id;
        }, true);
        
        if (newId) setSelectedIds([newId]);
    }, [performUpdate]);

    const addOrUpdateImage = useCallback((src: string, width: number, height: number, x?: number, y?: number) => {
        console.log('[ADD-IMAGE-STATE] Called with src:', src, 'w:', width, 'h:', height, 'x:', x, 'y:', y);
        
        // Validate dimensions and coordinates
        const safeWidth = (width && width > 0 && Number.isFinite(width)) ? width : 100;
        const safeHeight = (height && height > 0 && Number.isFinite(height)) ? height : 100;
        const safeX = (x !== undefined && Number.isFinite(x)) ? x : 100;
        const safeY = (y !== undefined && Number.isFinite(y)) ? y : 100;
        
        console.log('[ADD-IMAGE-STATE] Safe values - w:', safeWidth, 'h:', safeHeight, 'x:', safeX, 'y:', safeY);

        let newId = '';
        performUpdate(draft => {
            if (selectedIds.length === 1) {
                 const selectedShape = findShape(draft.shapes as Shape[], selectedIds[0]);
                 if (selectedShape && selectedShape.type === 'rect') {
                     Object.assign(selectedShape, {
                         fillType: 'image',
                         fillImage: src
                     });
                     return;
                 }
            }

            const newShape: Shape = {
                id: `image-${generateUUID()}`,
                type: 'image',
                x: safeX,
                y: safeY,
                width: safeWidth > 500 ? 500 : safeWidth,
                height: safeWidth > 500 ? (safeHeight / safeWidth) * 500 : safeHeight,
                src: src,
                name: 'Image'
            };
            draft.shapes.push(newShape);
            newId = newShape.id;
        }, true);

        if (newId) setSelectedIds([newId]);
    }, [state.shapes, selectedIds, performUpdate]);

    const cropImage = useCallback(() => {
        if (selectedIds.length !== 1) return;
        
        let newGroupId = '';
        performUpdate(draft => {
            const shape = findShape(draft.shapes as Shape[], selectedIds[0]);
            if (!shape || shape.type !== 'image') return;
            
            // Create a group that acts as a viewport/crop
            newGroupId = `group-crop-${Date.now()}`;
            const group: GroupShape = {
                id: newGroupId,
                type: 'group',
                x: shape.x,
                y: shape.y,
                width: shape.width,
                height: shape.height,
                clip: true,
                children: [{
                    ...shape,
                    x: 0,
                    y: 0,
                    id: shape.id // Keep original ID or generate new? Better keep original for references
                }],
                name: 'Cropped Image',
                visible: true,
                locked: false
            };
            
            // Replace image with group
            deleteShapeInTreeMutable(draft.shapes, shape.id);
            draft.shapes.push(group);
            
        }, true);
        
        if (newGroupId) setSelectedIds([newGroupId]);
    }, [state.shapes, selectedIds, performUpdate]);

    const makeMask = useCallback(() => {
        if (selectedIds.length < 2) {
            alert("Please select at least 2 shapes to make a mask.");
            return;
        }

        let newGroupId = '';

        performUpdate(draft => {
            const orderedSelection: Shape[] = [];
            const traverse = (items: Shape[]) => {
                items.forEach(item => {
                    if (selectedIds.includes(item.id)) {
                        orderedSelection.push(item);
                    }
                    if ((item.type === 'group' || item.type === 'artboard') && item.children) {
                        traverse(item.children);
                    }
                });
            };
            traverse(draft.shapes as Shape[]);
            
            if (orderedSelection.length < 2) return;
            
            const maskShape = orderedSelection[orderedSelection.length - 1];
            const contentShapes = orderedSelection.slice(0, orderedSelection.length - 1);
            
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            [...contentShapes, maskShape].forEach(s => {
                const { width: w, height: h } = getShapeDimensions(s);
                minX = Math.min(minX, s.x);
                minY = Math.min(minY, s.y);
                maxX = Math.max(maxX, s.x + w);
                maxY = Math.max(maxY, s.y + h);
            });
            
            const groupX = minX;
            const groupY = minY;
            const groupW = maxX - minX;
            const groupH = maxY - minY;
            
            const clipPathData = getShapePathData(maskShape, { x: groupX, y: groupY });
            
            if (!clipPathData) {
                // alert("Could not create mask from the top shape."); // Can't alert inside produce easily
                return;
            }
            
            newGroupId = `group-mask-${Date.now()}`;
            const newGroup: GroupShape = {
                id: newGroupId,
                type: 'group',
                x: groupX,
                y: groupY,
                width: groupW,
                height: groupH,
                children: contentShapes.map(s => ({ ...s, x: s.x - groupX, y: s.y - groupY })),
                visible: true,
                locked: false,
                name: 'Mask Group',
                clip: true,
                clipData: clipPathData
            };
            
            selectedIds.forEach(id => {
                deleteShapeInTreeMutable(draft.shapes, id);
            });
            draft.shapes.push(newGroup);
        }, true);
        
        if (newGroupId) setSelectedIds([newGroupId]);
    }, [state.shapes, selectedIds, performUpdate]);

    const booleanOperation = useCallback((op: 'unite' | 'subtract' | 'intersect' | 'exclude') => {
        if (selectedIds.length < 2) {
            alert("Please select at least 2 shapes for boolean operations.");
            return;
        }
        
        let newId = '';
        performUpdate(draft => {
            // Collect shapes in Z-order (tree order)
            const selectedShapes: Shape[] = [];
            const collectSelected = (list: Shape[]) => {
                for (const s of list) {
                    if (selectedIds.includes(s.id)) {
                        selectedShapes.push(s);
                    }
                    if ((s.type === 'group' || s.type === 'artboard') && s.children) {
                        collectSelected(s.children);
                    }
                }
            };
            collectSelected(draft.shapes as Shape[]);

            if (selectedShapes.length < 2) return;
            
            const result = performBooleanOperation(selectedShapes, op);
            
            if (result) {
                // Use properties from the bottom-most shape (first in list)
                const baseShape = selectedShapes[0];
                const newShape: Shape = {
                    id: `path-${Date.now()}`,
                    type: 'path',
                    x: result.x,
                    y: result.y,
                    width: result.width,
                    height: result.height,
                    data: result.data,
                    fill: (baseShape as any).fill || '#cccccc',
                    stroke: (baseShape as any).stroke || '#000000',
                    strokeWidth: (baseShape as any).strokeWidth || 1,
                    name: 'Combined Shape'
                };
                
                selectedShapes.forEach(s => {
                    deleteShapeInTreeMutable(draft.shapes, s.id);
                });
                draft.shapes.push(newShape);
                newId = newShape.id;
            }
        }, true);

        if (newId) setSelectedIds([newId]);
    }, [state.shapes, selectedIds, performUpdate]);

    const makeCompoundPath = useCallback(() => {
        if (selectedIds.length < 2) {
            alert("Please select at least 2 shapes.");
            return;
        }
        
        let newId = '';
        performUpdate(draft => {
            const selectedShapes = selectedIds.map(id => findShape(draft.shapes as Shape[], id)).filter(s => s) as Shape[];
            
            const result = createCompoundPath(selectedShapes);
            
            if (result) {
                const firstShape = selectedShapes[0];
                const newShape: Shape = {
                    id: `path-${Date.now()}`,
                    type: 'path',
                    x: result.x,
                    y: result.y,
                    width: result.width,
                    height: result.height,
                    data: result.data,
                    fill: (firstShape as any).fill || '#cccccc',
                    stroke: (firstShape as any).stroke || '#000000',
                    strokeWidth: (firstShape as any).strokeWidth || 1,
                    name: 'Compound Path'
                };
                
                selectedIds.forEach(id => {
                    deleteShapeInTreeMutable(draft.shapes, id);
                });
                draft.shapes.push(newShape);
                newId = newShape.id;
            }
        }, true);

        if (newId) setSelectedIds([newId]);
    }, [state.shapes, selectedIds, performUpdate]);

    const createComponent = useCallback(() => {
        if (selectedIds.length !== 1) return;
        const selectedId = selectedIds[0];
        
        performUpdate(draft => {
            const shape = findShape(draft.shapes as Shape[], selectedId);
            if (!shape) return;
            
            const componentId = `component-${Date.now()}`;
            const component = { ...shape, id: componentId, x: 0, y: 0 };
            
            const { width: w, height: h } = getShapeDimensions(shape);
            const instance: Shape = {
                id: shape.id, 
                type: 'instance',
                componentId: componentId,
                x: shape.x,
                y: shape.y,
                width: w,
                height: h,
                rotation: shape.rotation,
                opacity: shape.opacity,
                visible: shape.visible,
                locked: shape.locked,
                name: shape.name || 'Instance'
            };
            
            draft.components[componentId] = component;
            // replaceShapeInTree is immutable, need mutable version or just use updateShapeInTreeMutable logic?
            // replaceShapeInTree logic is simple: find parent and replace in array.
            // I'll implement inline replacement
            const replaceRecursive = (list: Shape[]) => {
                const idx = list.findIndex(s => s.id === selectedId);
                if (idx !== -1) {
                    list[idx] = instance;
                    return true;
                }
                for (const s of list) {
                    if ((s.type === 'group' || s.type === 'artboard') && s.children) {
                        if (replaceRecursive(s.children)) return true;
                    }
                }
                return false;
            };
            replaceRecursive(draft.shapes as Shape[]);
        }, true);
    }, [state.shapes, selectedIds, performUpdate]);

    const detachInstance = useCallback(() => {
        if (selectedIds.length !== 1) return;
        const selectedId = selectedIds[0];
        
        let newGroupId = '';
        performUpdate(draft => {
            const shape = findShape(draft.shapes as Shape[], selectedId);
            if (!shape || shape.type !== 'instance') return;
            
            const component = draft.components[shape.componentId];
            if (!component) return;

            const cloneChildren = (items: Shape[]): Shape[] => {
                return items.map(item => ({
                    ...item,
                    id: `${item.type}-${Math.random().toString(36).substr(2, 9)}`,
                    children: (item.type === 'group' || item.type === 'artboard') && item.children ? cloneChildren(item.children) : undefined
                } as Shape));
            };

            let newChildren: Shape[] = [];
            if ((component.type === 'group' || component.type === 'artboard') && component.children) {
                newChildren = cloneChildren(component.children);
            } else {
                newChildren = cloneChildren([component]);
            }

            newGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const newGroup: GroupShape = {
                ...shape, 
                id: newGroupId,
                type: 'group',
                children: newChildren,
                componentId: undefined, 
                overrides: undefined 
            } as any;

            const replaceRecursive = (list: Shape[]) => {
                const idx = list.findIndex(s => s.id === selectedId);
                if (idx !== -1) {
                    list[idx] = newGroup;
                    return true;
                }
                for (const s of list) {
                    if ((s.type === 'group' || s.type === 'artboard') && s.children) {
                        if (replaceRecursive(s.children)) return true;
                    }
                }
                return false;
            };
            replaceRecursive(draft.shapes as Shape[]);
        }, true);

        if (newGroupId) setSelectedIds([newGroupId]);
    }, [state.shapes, selectedIds, performUpdate]);

    const selectSimilar = useCallback(() => {
        if (selectedIds.length === 0) return;
        const target = findShape(state.shapes, selectedIds[0]);
        if (!target) return;

        const similarIds: string[] = [];
        const traverse = (items: Shape[]) => {
            items.forEach(item => {
                const targetFill = (target as any).fill;
                const targetStroke = (target as any).stroke;
                const itemFill = (item as any).fill;
                const itemStroke = (item as any).stroke;

                let match = false;
                if (targetFill && itemFill === targetFill) match = true;
                if (targetStroke && itemStroke === targetStroke) match = true;
                
                if (match) {
                    similarIds.push(item.id);
                }
                
                if ((item.type === 'group' || item.type === 'artboard') && item.children) {
                    traverse(item.children);
                }
            });
        };
        
        traverse(state.shapes);
        setSelectedIds(similarIds);
    }, [state.shapes, selectedIds]);

    const mergeShapes = useCallback((idsToMerge: string[]) => {
        if (idsToMerge.length < 2) return;
        
        let newId = '';
        performUpdate(draft => {
            const shapesToMerge = idsToMerge.map(id => findShape(draft.shapes as Shape[], id)).filter(s => s) as Shape[];
            if (shapesToMerge.length < 2) return;

            const result = performBooleanOperation(shapesToMerge, 'unite');
            
            if (result) {
                const baseShape = shapesToMerge[0];
                const mergedShape: Shape = {
                    id: `path-${generateUUID()}`,
                    type: 'path',
                    x: result.x,
                    y: result.y,
                    width: result.width,
                    height: result.height,
                    data: result.data,
                    fill: (baseShape as any).fill || '#cccccc',
                    stroke: (baseShape as any).stroke || '#000000',
                    strokeWidth: (baseShape as any).strokeWidth || 1,
                    name: 'Merged Shape'
                };
                
                shapesToMerge.forEach(s => {
                    deleteShapeInTreeMutable(draft.shapes, s.id);
                });
                
                draft.shapes.push(mergedShape);
                newId = mergedShape.id;
            }
        }, true);
        
        if (newId) setSelectedIds([newId]);

    }, [state.shapes, performUpdate]);

    const traceImageSelection = useCallback(async () => {
        if (selectedIds.length !== 1) return;
        const shape = findShape(state.shapes, selectedIds[0]);
        if (!shape || shape.type !== 'image') return;
        
        try {
            const svgStr = await traceImage((shape as any).src);
            const pathData = extractPathFromSVG(svgStr);
            
            if (pathData) {
                const { width: w, height: h } = getShapeDimensions(shape);
                const newShape: Shape = {
                    id: `path-${generateUUID()}`,
                    type: 'path',
                    x: shape.x,
                    y: shape.y,
                    width: w,
                    height: h,
                    data: pathData,
                    fill: '#000000',
                    stroke: '#000000',
                    strokeWidth: 0,
                    name: 'Traced Image'
                };
                
                performUpdate(draft => {
                    deleteShapeInTreeMutable(draft.shapes, shape.id);
                    draft.shapes.push(newShape);
                }, true);
                setSelectedIds([newShape.id]);
            }
        } catch (e) {
            console.error("Image trace failed", e);
            alert("Failed to trace image.");
        }
    }, [state.shapes, selectedIds, performUpdate]);

    const releaseMask = useCallback(() => {
        if (selectedIds.length !== 1) return;
        
        performUpdate(draft => {
            const shape = findShape(draft.shapes as Shape[], selectedIds[0]);
            if (!shape || shape.type !== 'group' || !(shape as any).clip) return;
            
            Object.assign(shape, { clip: false, clipData: undefined });
        }, true);
    }, [state.shapes, selectedIds, performUpdate]);

    return {
        shapes: state.shapes,
        setShapes,
        selectedIds,
        setSelectedIds,
        components: state.components,
        setComponents,
        assets,
        addAsset,
        removeAsset,
        addOrUpdateImage,
        clipboard,
        history,
        undo,
        redo,
        bringToFront,
        sendToBack,
        updateShape,
        updateShapes,
        deleteShape,
        moveShape,
        groupShapes,
        ungroupShapes,
        copy,
        paste,
        duplicate,
        addToHistory,
        makeMask,
        releaseMask,
        booleanOperation,
        makeCompoundPath,
        createComponent,
        viewMode,
        setViewMode,
        globalEditMode,
        setGlobalEditMode,
        detachInstance,
        selectSimilar,
        traceImageSelection,
        mergeShapes,
        cropImage,
        documentId,
        setDocumentId,
        clearHistory,
        addShape
    };
};
