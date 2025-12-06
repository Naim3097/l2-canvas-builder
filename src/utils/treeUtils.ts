import { Shape, GroupShape } from '../types/shapes';

export const getShapeDimensions = (shape: Shape): { width: number, height: number } => {
    if (shape.type === 'circle') {
        return { width: shape.radius * 2, height: shape.radius * 2 };
    }
    // Check if width/height exist and are numbers (handles Rect, Image, Artboard, Instance)
    // Text, Path, Group have optional width/height
    const w = (shape as any).width;
    const h = (shape as any).height;
    
    if (typeof w === 'number' && typeof h === 'number') {
        return { width: w, height: h };
    }
    
    return { width: w || 0, height: h || 0 };
};

export const applyAutoLayout = (group: GroupShape): GroupShape => {
    if (!group.layoutMode || group.layoutMode === 'none') return group;

    const { layoutMode, gap = 0, padding = 0, alignItems = 'start' } = group;
    
    // 1. Measure content & Handle 'Fill'
    let totalFixedSize = 0;
    let fillCount = 0;
    let maxCrossSize = 0;

    group.children.forEach(child => {
        const { width: w, height: h } = getShapeDimensions(child);
        
        if (layoutMode === 'horizontal') {
            if (child.layoutSizingHorizontal === 'fill') fillCount++;
            else totalFixedSize += w;
            maxCrossSize = Math.max(maxCrossSize, h);
        } else {
            if (child.layoutSizingVertical === 'fill') fillCount++;
            else totalFixedSize += h;
            maxCrossSize = Math.max(maxCrossSize, w);
        }
    });

    // Calculate available space for 'fill' items if group has fixed size
    // For now, we assume 'Hug' behavior for the group itself unless specified otherwise, 
    // but if children are 'fill', the group must have a defined size or we default to a min size.
    // Let's assume if children are 'fill', they share the remaining space of the group's CURRENT width/height.
    
    const availableSpace = layoutMode === 'horizontal' 
        ? ((group.width || 0) - padding * 2 - gap * (group.children.length - 1) - totalFixedSize)
        : ((group.height || 0) - padding * 2 - gap * (group.children.length - 1) - totalFixedSize);
        
    const fillSize = fillCount > 0 ? Math.max(0, availableSpace / fillCount) : 0;

    // 2. Position children
    let currentPos = padding;
    const newChildren = group.children.map(child => {
        let { width: w, height: h } = getShapeDimensions(child);

        // Apply Fill Sizing
        if (layoutMode === 'horizontal' && child.layoutSizingHorizontal === 'fill') {
            w = fillSize;
        } else if (layoutMode === 'vertical' && child.layoutSizingVertical === 'fill') {
            h = fillSize;
        }

        // Apply Cross Axis Fill
        if (layoutMode === 'horizontal' && child.layoutSizingVertical === 'fill') {
            h = (group.height || 0) - padding * 2;
        } else if (layoutMode === 'vertical' && child.layoutSizingHorizontal === 'fill') {
            w = (group.width || 0) - padding * 2;
        }

        let x = 0;
        let y = 0;

        if (layoutMode === 'horizontal') {
            x = currentPos;
            currentPos += w + gap;
            
            // Align items vertically
            if (alignItems === 'start') y = padding;
            else if (alignItems === 'center') y = padding + (maxCrossSize - h) / 2;
            else if (alignItems === 'end') y = padding + (maxCrossSize - h);
        } else { // vertical
            y = currentPos;
            currentPos += h + gap;

            // Align items horizontally
            if (alignItems === 'start') x = padding;
            else if (alignItems === 'center') x = padding + (maxCrossSize - w) / 2;
            else if (alignItems === 'end') x = padding + (maxCrossSize - w);
        }

        return { ...child, x, y, width: w, height: h };
    });

    // 3. Update Group Size (Hug contents)
    // Only update if the group itself is set to Hug, or if we are just calculating initial layout.
    // For simplicity in this v1.5, we assume Hug unless manually resized.
    
    const newWidth = layoutMode === 'horizontal' 
        ? currentPos - gap + padding 
        : maxCrossSize + padding * 2;
        
    const newHeight = layoutMode === 'vertical' 
        ? currentPos - gap + padding 
        : maxCrossSize + padding * 2;

    return {
        ...group,
        children: newChildren,
        width: group.layoutSizingHorizontal === 'fixed' ? group.width : newWidth,
        height: group.layoutSizingVertical === 'fixed' ? group.height : newHeight
    } as GroupShape;
};

export const findShape = (shapes: Shape[], id: string): Shape | null => {
    for (const shape of shapes) {
        if (shape.id === id) return shape;
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            const found = findShape(shape.children, id);
            if (found) return found;
        }
    }
    return null;
};

export const updateShapeInTree = (shapes: Shape[], id: string, updates: Partial<Shape>): Shape[] => {
    return shapes.map(shape => {
        // Handle Instance Overrides
        if (shape.type === 'instance' && shape.id === id) {
             // If we are updating the instance itself (x, y, width, height), do it normally.
             // But if we are trying to update a child (which shouldn't happen via this ID check usually, 
             // unless we passed a child ID that we know belongs to this instance).
             // Actually, the UI selects the instance. If we want to edit a child, we need a way to select "inside" the instance.
             // For now, let's assume updates to the instance are just top-level.
             return { ...shape, ...updates } as Shape;
        }
        
        // Check if we are updating a child of an instance (Deep Selection)
        // This requires the ID to be something like "internal-componentId-childId" which we generated in DesignCanvas.
        // But wait, we can't select those easily yet because they are generated at render time.
        // To support 10/10 components, we need to allow selecting children of instances.
        // The renderer gives them IDs like `internal-${master.id}`. 
        // We need a better ID strategy: `instanceId:childId`.
        
        if (shape.id === id) {
            const updatedShape = { ...shape, ...updates } as Shape;
            if (updatedShape.type === 'group' && (updatedShape as any).layoutMode && (updatedShape as any).layoutMode !== 'none') {
                 return applyAutoLayout(updatedShape as GroupShape);
            }
            return updatedShape;
        }
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            const newChildren = updateShapeInTree(shape.children, id, updates);
            let newShape = { ...shape, children: newChildren } as Shape;
             if (newShape.type === 'group' && (newShape as any).layoutMode && (newShape as any).layoutMode !== 'none') {
                 newShape = applyAutoLayout(newShape as GroupShape);
            }
            return newShape;
        }
        return shape;
    });
};

export const deleteShapeInTree = (shapes: Shape[], id: string): Shape[] => {
    return shapes.filter(shape => shape.id !== id).map(shape => {
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            return { ...shape, children: deleteShapeInTree(shape.children, id) };
        }
        return shape;
    });
};

export const replaceShapeInTree = (shapes: Shape[], id: string, newShape: Shape): Shape[] => {
    return shapes.map(shape => {
        if (shape.id === id) {
            return newShape;
        }
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            return { ...shape, children: replaceShapeInTree(shape.children, id, newShape) };
        }
        return shape;
    });
};

export const ungroupShapeInTree = (shapes: Shape[], id: string): Shape[] => {
    return shapes.flatMap(shape => {
        if (shape.id === id && shape.type === 'group') {
            // Promote children
            return shape.children.map(child => ({
                ...child,
                x: shape.x + child.x,
                y: shape.y + child.y
            }));
        }
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            return [{ ...shape, children: ungroupShapeInTree(shape.children, id) }];
        }
        return [shape];
    });
};

export const moveShapeInTree = (shapes: Shape[], id: string, direction: 'up' | 'down' | 'top' | 'bottom'): Shape[] => {
    const processList = (list: Shape[]): { list: Shape[], handled: boolean } => {
        const index = list.findIndex(s => s.id === id);
        if (index !== -1) {
            const newList = [...list];
            const item = newList.splice(index, 1)[0];
            
            if (direction === 'up') {
                newList.splice(Math.min(newList.length, index + 1), 0, item);
            } else if (direction === 'down') {
                newList.splice(Math.max(0, index - 1), 0, item);
            } else if (direction === 'top') {
                newList.push(item);
            } else if (direction === 'bottom') {
                newList.unshift(item);
            }
            return { list: newList, handled: true };
        }
        
        let handled = false;
        const recursiveList = list.map(item => {
            if ((item.type === 'group' || item.type === 'artboard') && item.children) {
                const result = processList(item.children);
                if (result.handled) {
                    handled = true;
                    return { ...item, children: result.list };
                }
            }
            return item;
        });
        
        return { list: recursiveList, handled };
    };

    return processList(shapes).list;
};

export const updateSimilarShapesInTree = (
    shapes: Shape[], 
    targetId: string, 
    updates: Partial<Shape>
): Shape[] => {
    const target = findShape(shapes, targetId);
    if (!target) return shapes;

    const isSimilar = (candidate: Shape) => {
        if (candidate.id === targetId) return true; 
        if (candidate.type !== target.type) return false;
        
        if ('fill' in target && 'fill' in candidate) {
            if ((target as any).fill !== (candidate as any).fill) return false;
        }
        
        if ('stroke' in target && 'stroke' in candidate) {
            if ((target as any).stroke !== (candidate as any).stroke) return false;
        }

        return true;
    };

    const updateRecursive = (nodes: Shape[]): Shape[] => {
        return nodes.map(node => {
            let newNode = node;
            if (isSimilar(node)) {
                newNode = { ...node, ...updates } as Shape;
            }

            if ((newNode.type === 'group' || newNode.type === 'artboard') && (newNode as any).children) {
                return {
                    ...newNode,
                    children: updateRecursive((newNode as any).children)
                } as Shape;
            }
            return newNode;
        });
    };

    return updateRecursive(shapes);
};

// Mutable versions for Immer
export const updateShapeInTreeMutable = (shapes: Shape[], id: string, updates: Partial<Shape>) => {
    for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        if (shape.id === id) {
            Object.assign(shape, updates);
            if (shape.type === 'group' && (shape as any).layoutMode && (shape as any).layoutMode !== 'none') {
                 const layouted = applyAutoLayout(shape as GroupShape);
                 Object.assign(shape, layouted);
            }
            return true;
        }
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            if (updateShapeInTreeMutable(shape.children, id, updates)) return true;
        }
    }
    return false;
};

export const deleteShapeInTreeMutable = (shapes: Shape[], id: string) => {
    const index = shapes.findIndex(s => s.id === id);
    if (index !== -1) {
        shapes.splice(index, 1);
        return true;
    }
    for (const shape of shapes) {
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            if (deleteShapeInTreeMutable(shape.children, id)) return true;
        }
    }
    return false;
};

export const moveShapeInTreeMutable = (shapes: Shape[], id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const index = shapes.findIndex(s => s.id === id);
    if (index !== -1) {
        const [item] = shapes.splice(index, 1);
        if (direction === 'up') {
            shapes.splice(Math.min(shapes.length, index + 1), 0, item);
        } else if (direction === 'down') {
            shapes.splice(Math.max(0, index - 1), 0, item);
        } else if (direction === 'top') {
            shapes.push(item);
        } else if (direction === 'bottom') {
            shapes.unshift(item);
        }
        return true;
    }
    for (const shape of shapes) {
        if ((shape.type === 'group' || shape.type === 'artboard') && shape.children) {
            if (moveShapeInTreeMutable(shape.children, id, direction)) return true;
        }
    }
    return false;
};

