import { Shape, InstanceShape, GroupShape } from '@/types/shapes';
import { getShapeDimensions } from '@/utils/treeUtils';

export const generateShapeCode = (shape: Shape, components: Record<string, Shape> = {}, parentLayout?: 'horizontal' | 'vertical'): string => {
    let classes = '';
    let styles: string[] = [];

    // Positioning
    if (parentLayout) {
        classes += 'relative ';
    } else {
        classes += 'absolute ';
        styles.push(`left: ${Math.round(shape.x)}px`);
        styles.push(`top: ${Math.round(shape.y)}px`);
    }
    
    const { width, height } = getShapeDimensions(shape);

    // Sizing
    if (parentLayout === 'horizontal') {
        if (shape.layoutSizingHorizontal === 'fill') classes += 'flex-1 ';
        else if (shape.layoutSizingHorizontal === 'fixed') styles.push(`width: ${Math.round(width)}px`);
    } else if (parentLayout === 'vertical') {
        if (shape.layoutSizingVertical === 'fill') classes += 'flex-1 ';
        else if (shape.layoutSizingVertical === 'fixed') styles.push(`height: ${Math.round(height)}px`);
    } else {
        if (!parentLayout) {
             styles.push(`width: ${Math.round(width)}px`);
             styles.push(`height: ${Math.round(height)}px`);
        }
    }
    
    // Appearance
    if (shape.opacity && shape.opacity < 1) styles.push(`opacity: ${shape.opacity}`);
    if (shape.shadowBlur && shape.shadowBlur > 0) classes += 'shadow-lg ';
    if (shape.type === 'image' && shape.blur) styles.push(`filter: blur(${shape.blur}px)`);

    // Interaction & ID
    let interactionAttr = '';
    if (shape.interaction?.type === 'navigate') {
        interactionAttr = ` onclick="document.getElementById('${shape.interaction.targetId}').scrollIntoView({behavior: 'smooth'})" style="cursor: pointer;"`;
    }
    const idAttr = `id="${shape.id}"`;

    const styleAttr = styles.length > 0 ? `style="${styles.join('; ')}"` : '';

    if (shape.type === 'artboard') {
        const childrenCode = shape.children.map(c => generateShapeCode(c, components)).join('\n');
        const artboardStyle = `width: ${shape.width}px; height: ${shape.height}px; ${styles.join('; ')}`;
        return `  <!-- Artboard: ${shape.name} -->\n  <div ${idAttr} class="bg-white overflow-hidden border border-gray-200 relative ${classes}" style="${artboardStyle}">\n${childrenCode}\n  </div>`;
    } else if (shape.type === 'group') {
        const layoutMode = shape.layoutMode;
        const isFlex = layoutMode && layoutMode !== 'none';
        
        if (isFlex) {
            classes += `flex ${layoutMode === 'horizontal' ? 'flex-row' : 'flex-col'} `;
            styles.push(`gap: ${shape.gap || 0}px`);
            styles.push(`padding: ${shape.padding || 0}px`);
            if (shape.alignItems === 'center') classes += 'items-center ';
            if (shape.alignItems === 'end') classes += 'items-end ';
        }
        if (shape.clip) classes += 'overflow-hidden ';

        const childrenCode = shape.children.map(c => generateShapeCode(c, components, isFlex ? layoutMode : undefined)).join('\n');
        return `  <div ${idAttr} ${interactionAttr} class="${classes.trim()}" ${styleAttr}>\n${childrenCode}\n  </div>`;
    } else if (shape.type === 'instance') {
        const s = shape as InstanceShape;
        const component = components[s.componentId];
        if (!component) return `<!-- Missing Component: ${s.componentId} -->`;
        
        let content = '';
        if (component.type === 'group' || component.type === 'artboard') {
             content = (component as GroupShape).children?.map(c => generateShapeCode(c, components)).join('\n') || '';
        } else {
             content = generateShapeCode({ ...component, x: 0, y: 0, rotation: 0 }, components);
        }
        
        return `  <div ${idAttr} class="${classes.trim()}" ${styleAttr}>\n    <!-- Instance of ${component.name} -->\n${content}\n  </div>`;

    } else if (shape.type === 'rect') {
        const fill = shape.fills?.[0]?.color || (shape as any).fill || 'transparent';
        // Use style for arbitrary colors
        const bgStyle = `background-color: ${fill}`;
        if (shape.cornerRadius) styles.push(`border-radius: ${shape.cornerRadius}px`);
        
        return `  <div ${idAttr} ${interactionAttr} class="${classes.trim()}" style="${styles.join('; ')}; ${bgStyle}"></div>`;
    } else if (shape.type === 'image') {
        return `  <img ${idAttr} ${interactionAttr} src="${shape.src}" class="${classes.trim()}" ${styleAttr} />`;
    } else if (shape.type === 'path') {
        const d = shape.data || `M ${shape.points?.join(' ')}`;
        const stroke = shape.strokes?.[0]?.color || shape.stroke || 'none';
        const strokeWidth = shape.strokes?.[0]?.width || shape.strokeWidth || 1;
        const fill = shape.fills?.[0]?.color || shape.fill || 'none';
        return `  <svg ${idAttr} ${interactionAttr} class="absolute left-0 top-0 pointer-events-none" width="100%" height="100%"><path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" /></svg>`;
    } else if (shape.type === 'text') {
        const fill = shape.fills?.[0]?.color || shape.fill || 'black';
        styles.push(`font-size: ${shape.fontSize}px`);
        styles.push(`font-family: ${shape.fontFamily}`);
        styles.push(`color: ${fill}`);
        if (shape.fontWeight === 'bold') classes += 'font-bold ';
        
        return `  <div ${idAttr} ${interactionAttr} class="${classes.trim()}" ${styleAttr}>${shape.text}</div>`;
    }
    return '';
};
