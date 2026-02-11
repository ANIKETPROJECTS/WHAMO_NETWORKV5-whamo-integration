import { memo, type ReactNode } from 'react';
import {
  EdgeProps,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';
import { TooltipWrapper, DataList } from './TooltipWrapper';

export const ConnectionEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  type,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isDummy = type === 'dummy' || data?.type === 'dummy';
  const strokeColor = isDummy ? "#94a3b8" : "#3b82f6";
  const strokeDasharray = isDummy ? "8 8" : undefined;

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: isDummy ? 2 : 2.5,
          stroke: strokeColor,
          strokeDasharray,
        }} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <TooltipWrapper 
            content={<DataList data={data} title={isDummy ? "Dummy Pipe Properties" : "Conduit Properties"} />}
          >
            <div className="bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-slate-200 shadow-sm text-[9px] font-bold cursor-help hover:bg-white transition-colors">
              {(data?.label as ReactNode) || id}
            </div>
          </TooltipWrapper>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
