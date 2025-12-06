import { useState, useCallback } from 'react';
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
        past: { patches: Patch[], inversePatches: Patch[] }[], 
        future: { patches: Patch[], inversePatches: Patch[] }[]
    }>({ past: [], future: [] });
    
    const [viewMode, setViewMode] = useState<'rgb' | 'cmyk' | 'outline'>('rgb');
    const [globalEditMode, setGlobalEditMode] = useState(false);
    const [documentId, setDocumentId] = useState<string>('doc-1');

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
                setHistory(prev => ({
                    past: [...prev.past, { patches, inversePatches }],
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
        if (history.past.length === 0) return;
        const lastChange = history.past[history.past.length - 1];
        
        setState(prev => applyPatches(prev, lastChange.inversePatches));
        
        setHistory(prev => ({
            past: prev.past.slice(0, -1),
            future: [lastChange, ...prev.future]
        }));
    }, [history]);

    const redo = useCallback(() => {
        if (history.future.length === 0) return;
        const nextChange = history.future[0];
        
        setState(prev => applyPatches(prev, nextChange.patches));
        
        setHistory(prev => ({
            past: [...prev.past, nextChange],
            future: prev.future.slice(1)
        }));
    }, [history]);

    const bringToFront = useCallback(() => {
        if (selectedIds.length === 0) return;
        performUpdate(draft => {
            // Simple implementation: Top-level only for now
            const moving: Shape[] = [];
            draft.shapes = draft.shapes.filter(s => {
                if (selectedIds.includes(s.id)) {
                    moving.push(s);
                    return false;
                }
                return true;
            });
            draft.shapes.push(...moving);
        }, true);
    }, [selectedIds, performUpdate]);

    const sendToBack = useCallback(() => {
        if (selectedIds.length === 0) return;
        performUpdate(draft => {
            // Simple implementation: Top-level only for now
            const moving: Shape[] = [];
            draft.shapes = draft.shapes.filter(s => {
                if (selectedIds.includes(s.id)) {
                    moving.push(s);
                    return false;
                }
                return true;
            });
            draft.shapes.unshift(...moving);
        }, true);
    }, [selectedIds, performUpdate]);

    // Compatibility wrappers
    const setShapes = useCallback((valueOrUpdater: Shape[] | ((prev: Shape[]) => Shape[])) => {
        performUpdate(draft => {
            if (typeof valueOrUpdater === 'function') {
                draft.shapes = valueOrUpdater(draft.shapes as Shape[]);
            } else {
                draft.shapes = valueOrUpdater;
            }
        }, false);
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
        console.log('updateShape called:', id, updates);
        performUpdate(draft => {
            if (globalEditMode) {
                draft.shapes = updateSimilarShapesInTree(draft.shapes as Shape[], id, updates);
            } else {
                updateShapeInTreeMutable(draft.shapes, id, updates);
            }
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
            const selectedShapes = selectedIds.map(id => findShape(draft.shapes as Shape[], id)).filter(s => s) as Shape[];
            if (selectedShapes.length === 0) return;

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

            selectedIds.forEach(id => {
                deleteShapeInTreeMutable(draft.shapes, id);
            });
            draft.shapes.push(newGroup);
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
                const newId = `${clipShape.type}-${Date.now()}-${index}`;
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
                             id: `${item.type}-${Math.random().toString(36).substr(2, 9)}`,
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
                const newS = { ...s, id: `${s.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` };
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

    const addShape = useCallback((type: string, data?: any) => {
        let newId = '';
        performUpdate(draft => {
            const id = `${type}-${Date.now()}`;
            let newShape: Shape;

            if (type === 'rect') {
                newShape = {
                    id, type: 'rect', x: 100, y: 100, width: 100, height: 100, fill: '#cccccc', name: 'Rectangle'
                };
            } else if (type === 'circle') {
                newShape = {
                    id, type: 'circle', x: 150, y: 150, radius: 50, fill: '#cccccc', name: 'Circle'
                } as any;
            } else if (type === 'path') {
                newShape = {
                    id, type: 'path', x: 100, y: 100, width: 100, height: 100, data: data, fill: '#cccccc', name: 'Shape',
                    stroke: '#000000', strokeWidth: 1
                };
            } else if (type === 'icon') {
                newShape = {
                    id, type: 'path', x: 100, y: 100, width: 40, height: 40, data: data, fill: '#333333', name: 'Icon',
                    scaleX: 1, scaleY: 1, stroke: '#000000', strokeWidth: 0
                };
            } else if (type === 'button') {
                newShape = {
                    id, type: 'group', x: 100, y: 100, width: 120, height: 40, name: 'Button',
                    children: [
                        { id: `${id}-bg`, type: 'rect', x: 0, y: 0, width: 120, height: 40, fill: '#3b82f6', cornerRadius: 6, name: 'Background' } as any,
                        { id: `${id}-text`, type: 'text', x: 0, y: 0, width: 120, height: 40, text: 'Button', fontSize: 14, fill: '#ffffff', align: 'center', verticalAlign: 'middle', name: 'Label' } as any
                    ]
                };
            } else if (type === 'card') {
                newShape = {
                    id, type: 'group', x: 100, y: 100, width: 200, height: 250, name: 'Card',
                    children: [
                        { id: `${id}-bg`, type: 'rect', x: 0, y: 0, width: 200, height: 250, fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 1, cornerRadius: 8, name: 'Background' } as any,
                        { id: `${id}-img`, type: 'rect', x: 0, y: 0, width: 200, height: 120, fill: '#f3f4f6', cornerRadius: 8, name: 'Image Placeholder' } as any, // Top rounded only ideally
                        { id: `${id}-title`, type: 'text', x: 16, y: 136, text: 'Card Title', fontSize: 18, fontWeight: 'bold', fill: '#111827', name: 'Title' } as any,
                        { id: `${id}-desc`, type: 'text', x: 16, y: 164, text: 'Description goes here...', fontSize: 12, fill: '#6b7280', width: 168, name: 'Description' } as any
                    ]
                };
            } else if (type === 'input') {
                newShape = {
                    id, type: 'group', x: 100, y: 100, width: 200, height: 40, name: 'Input',
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

    const addOrUpdateImage = useCallback((src: string, width: number, height: number) => {
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
                id: `image-${Date.now()}`,
                type: 'image',
                x: 100,
                y: 100,
                width: width > 500 ? 500 : width,
                height: width > 500 ? (height / width) * 500 : height,
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
                    id: `path-${Date.now()}`,
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
        addOrUpdateImage,
        clipboard,
        history,
        undo,
        redo,
        bringToFront,
        sendToBack,
        updateShape,
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
