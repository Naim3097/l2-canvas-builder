import { Shape, InstanceShape, GroupShape } from '@/types/shapes';
import { getShapeDimensions } from '@/utils/treeUtils';

export const generateShapeCode = (shape: Shape, components: Record<string, Shape> = {}, parentLayout?: 'horizontal' | 'vertical'): string => {
    // If parent has layout, we don't use absolute positioning
    let commonClasses = parentLayout 
        ? `relative` 
        : `absolute left-[${Math.round(shape.x)}px] top-[${Math.round(shape.y)}px]`;
    
    const { width, height } = getShapeDimensions(shape);

    // Layout Sizing (10/10)
    if (parentLayout === 'horizontal') {
        if (shape.layoutSizingHorizontal === 'fill') commonClasses += ' flex-1';
        else if (shape.layoutSizingHorizontal === 'fixed') commonClasses += ` w-[${Math.round(width)}px]`;
    } else if (parentLayout === 'vertical') {
        if (shape.layoutSizingVertical === 'fill') commonClasses += ' flex-1';
        else if (shape.layoutSizingVertical === 'fixed') commonClasses += ` h-[${Math.round(height)}px]`;
    } else {
        // Absolute positioning fallback
        if (!parentLayout) {
             commonClasses += ` w-[${Math.round(width)}px] h-[${Math.round(height)}px]`;
        }
    }
    
    if (shape.opacity && shape.opacity < 1) commonClasses += ` opacity-[${Math.round(shape.opacity * 100)}]`;
    if (shape.shadowBlur && shape.shadowBlur > 0) commonClasses += ` shadow-lg`;
    if (shape.type === 'image' && shape.blur) commonClasses += ` blur-[${shape.blur}px]`;

    // Interaction & ID
    let interactionAttr = '';
    if (shape.interaction?.type === 'navigate') {
        // Simple scroll for now, but could be router push
        interactionAttr = ` onclick="document.getElementById('${shape.interaction.targetId}').scrollIntoView({behavior: 'smooth'})" style="cursor: pointer;"`;
    }
    const idAttr = `id="${shape.id}"`;

    if (shape.type === 'artboard') {
        const childrenCode = shape.children.map(c => generateShapeCode(c, components)).join('\n');
        const style = `${commonClasses} bg-white overflow-hidden border border-gray-200 relative`; // Artboards are relative containers
        return `  <!-- Artboard: ${shape.name} -->\n  <div ${idAttr} class="${style}" style="width: ${shape.width}px; height: ${shape.height}px;">\n${childrenCode}\n  </div>`;
    } else if (shape.type === 'group') {
        const layoutMode = shape.layoutMode;
        const isFlex = layoutMode && layoutMode !== 'none';
        
        let flexClasses = '';
        if (isFlex) {
            flexClasses = `flex ${layoutMode === 'horizontal' ? 'flex-row' : 'flex-col'} gap-[${shape.gap || 0}px] p-[${shape.padding || 0}px]`;
            if (shape.alignItems === 'center') flexClasses += ' items-center';
            if (shape.alignItems === 'end') flexClasses += ' items-end';
        }

        const childrenCode = shape.children.map(c => generateShapeCode(c, components, isFlex ? layoutMode : undefined)).join('\n');
        const style = `${commonClasses} ${shape.clip ? 'overflow-hidden' : ''} ${flexClasses}`;
        return `  <div ${idAttr} ${interactionAttr} class="${style}">\n${childrenCode}\n  </div>`;
    } else if (shape.type === 'instance') {
        const s = shape as InstanceShape;
        const component = components[s.componentId];
        if (!component) return `<!-- Missing Component: ${s.componentId} -->`;
        
        // For code generation, we can treat the instance as a container that renders the component's content.
        // Or we can "inline" the component content.
        // Let's inline it for now, but we need to be careful about IDs.
        
        let content = '';
        if (component.type === 'group' || component.type === 'artboard') {
             content = (component as GroupShape).children?.map(c => generateShapeCode(c, components)).join('\n') || '';
        } else {
             // Single shape component
             // We need to render it without its absolute positioning if it's inside the instance container?
             // Actually, the instance container (div) already handles the position (x,y).
             // So the content should be relative to 0,0.
             
             // This is tricky without a full recursive "flattening" or "context" pass.
             // For now, let's just render the component as if it was a child.
             content = generateShapeCode({ ...component, x: 0, y: 0, rotation: 0 }, components);
        }
        
        const style = `${commonClasses}`;
        return `  <div ${idAttr} class="${style}">\n    <!-- Instance of ${component.name} -->\n${content}\n  </div>`;

    } else if (shape.type === 'rect') {
        const fill = shape.fills?.[0]?.color || (shape as any).fill || 'transparent';
        const style = `${commonClasses} bg-[${fill}] ${shape.cornerRadius ? `rounded-[${shape.cornerRadius}px]` : ''}`;
        return `  <div ${idAttr} ${interactionAttr} class="${style}"></div>`;
    } else if (shape.type === 'image') {
        const style = `${commonClasses}`;
        return `  <img ${idAttr} ${interactionAttr} src="${shape.src}" class="${style}" />`;
    } else if (shape.type === 'path') {
        const d = shape.data || `M ${shape.points?.join(' ')}`;
        const stroke = shape.strokes?.[0]?.color || shape.stroke || 'none';
        const strokeWidth = shape.strokes?.[0]?.width || shape.strokeWidth || 1;
        const fill = shape.fills?.[0]?.color || shape.fill || 'none';
        return `  <svg ${idAttr} ${interactionAttr} class="absolute left-0 top-0 pointer-events-none" width="100%" height="100%"><path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" /></svg>`;
    } else if (shape.type === 'text') {
        const fill = shape.fills?.[0]?.color || shape.fill || 'black';
        const style = `${commonClasses} text-[${shape.fontSize}px] font-[${shape.fontFamily}] ${shape.fontWeight === 'bold' ? 'font-bold' : ''} text-[${fill}]`;
        return `  <div ${idAttr} ${interactionAttr} class="${style}">${shape.text}</div>`;
    }
    return '';
};
