import { useEffect } from 'react';
import Konva from 'konva';

interface UseSelectionSystemProps {
    stageRef: React.RefObject<Konva.Stage>;
    layerRef: React.RefObject<Konva.Layer>;
    uiLayerRef: React.RefObject<Konva.Layer>;
    transformerRef: React.MutableRefObject<Konva.Transformer | null>;
    selectedIds: string[];
    activeTool: string;
    onSelectionChange?: (ids: string[]) => void;
    nodeMapRef?: React.MutableRefObject<Map<string, Konva.Node>>;
    shapes?: any[];
    isReady?: boolean;
}

export const useSelectionSystem = ({
    stageRef,
    layerRef,
    uiLayerRef,
    transformerRef,
    selectedIds,
    activeTool,
    onSelectionChange,
    nodeMapRef,
    shapes,
    isReady
}: UseSelectionSystemProps) => {
    
    // Transformer creation moved to KonvaCanvas.tsx to ensure lifecycle sync
    /*
    useEffect(() => {
        if (!uiLayerRef.current || transformerRef.current) return;
        
        const transformer = new Konva.Transformer({
            enabledAnchors: ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right'],
            ignoreStroke: true,
            borderStroke: '#0099ff',
            anchorStroke: '#0099ff',
            anchorFill: '#ffffff',
            anchorSize: 8,
            rotateEnabled: true,
            rotateAnchorOffset: 30,
            rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
        });
        uiLayerRef.current.add(transformer);
        transformerRef.current = transformer;
        
        return () => {
            transformer.destroy();
            transformerRef.current = null;
        };
    }, [uiLayerRef, isReady]);
    */

    // Update Selection - MOVED TO KonvaCanvas.tsx to prevent race conditions
    /*
    useEffect(() => {
        if (!layerRef.current || !transformerRef.current) return;
        
        try {
            const transformer = transformerRef.current;
            
            // Validate transformer is still attached
            if (!transformer.getLayer()) {
                if (uiLayerRef.current) {
                    uiLayerRef.current.add(transformer);
                }
            }

            if (selectedIds && selectedIds.length > 0) {
                const nodes: Konva.Node[] = [];
                
                selectedIds.forEach(id => {
                    let node: Konva.Node | undefined;
                    
                    // Try node map first
                    if (nodeMapRef && nodeMapRef.current) {
                        node = nodeMapRef.current.get(id);
                    }
                    
                    // Fallback to findOne
                    if (!node || !node.getLayer()) {
                        node = layerRef.current?.findOne(`#${id}`);
                        if (node && nodeMapRef && nodeMapRef.current) {
                            nodeMapRef.current.set(id, node);
                        }
                    }
                    
                    if (node && node.getLayer() && node.isVisible()) {
                        nodes.push(node);
                    }
                });
                
                if (nodes.length > 0) {
                    transformer.nodes(nodes);
                    transformer.moveToTop();
                } else {
                    transformer.nodes([]);
                }
            } else {
                transformer.nodes([]);
            }
            
            transformer.getLayer()?.batchDraw();
            
        } catch (err) {
            console.error('Error in selection effect:', err);
        }
    }, [selectedIds, layerRef, transformerRef, uiLayerRef, nodeMapRef]); 
    */

    // Background Click (Deselect)
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return;
        
        const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
            if (e.target === stage) {
                if (activeTool === 'select') {
                     onSelectionChange?.([]);
                }
            }
        };
        
        stage.on('click tap', handleClick);
        return () => {
            stage.off('click tap', handleClick);
        };
    }, [stageRef, activeTool, onSelectionChange]);
};
