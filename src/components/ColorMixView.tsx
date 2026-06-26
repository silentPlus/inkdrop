/**
 * ColorMixView — 配色参考面板，展示 5×5 颜色混合矩阵
 */
import { PALETTE, mixColorNames, COLOR_HEX } from '../engine/ColorMixer';

const baseNames = Object.keys(PALETTE); // ['red', 'yellow', 'blue', 'green', 'magenta']

const nameLabels: Record<string, string> = {
  red: '红', yellow: '黄', blue: '蓝', green: '绿', magenta: '洋红',
};

export function ColorMixView({ onClose }: { onClose: () => void }) {
  // build matrix: row=colorA, col=colorB, value=mix result
  const pairs: Array<{ a: string; b: string; result: { hex: string } }> = [];
  for (const a of baseNames) {
    for (const b of baseNames) {
      pairs.push({ a, b, result: mixColorNames(a, b) });
    }
  }

  const cellSize = 36;
  const labelW = 30;
  const gap = 2;
  const headerH = 24;
  const cols = baseNames.length;
  const rows = baseNames.length;
  const totalW = labelW + cols * (cellSize + gap) + 20;
  const totalH = headerH + rows * (cellSize + gap) + 24;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '20px 16px 16px',
          maxWidth: totalW + 32,
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', color: '#333' }}>
          配色参考
        </h2>

        {/* matrix */}
        <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`}>
          {/* column headers */}
          {baseNames.map((name, ci) => {
            const x = labelW + ci * (cellSize + gap) + cellSize / 2;
            return (
              <text
                key={`ch-${ci}`}
                x={x}
                y={12}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="11"
                fill="#666"
              >
                {nameLabels[name]}
              </text>
            );
          })}

          {/* row headers */}
          {baseNames.map((name, ri) => {
            const y = headerH + ri * (cellSize + gap) + cellSize / 2;
            return (
              <text
                key={`rh-${ri}`}
                x={labelW - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="11"
                fill="#666"
              >
                {nameLabels[name]}
              </text>
            );
          })}

          {/* cells */}
          {pairs.map(({ a, b, result }, idx) => {
            const ri = Math.floor(idx / cols);
            const ci = idx % cols;
            const x = labelW + ci * (cellSize + gap);
            const y = headerH + ri * (cellSize + gap);

            if (a === b) {
              // diagonal: show pure color
              return <rect key={idx} x={x} y={y} width={cellSize} height={cellSize} rx={4} fill={COLOR_HEX[a]} />;
            }

            // only show upper triangle to avoid duplication
            if (ri > ci) {
              return <rect key={idx} x={x} y={y} width={cellSize} height={cellSize} rx={4} fill="transparent" />;
            }

            const midX = x + cellSize / 2;
            const midY = y + cellSize / 2;

            return (
              <g key={idx}>
                {/* top-left: color A */}
                <path d={`M${x},${y} L${x + cellSize},${y} L${x},${y + cellSize} Z`} fill={COLOR_HEX[a]} />
                {/* bottom-right: color B */}
                <path d={`M${x + cellSize},${y + cellSize} L${x + cellSize},${y} L${x},${y + cellSize} Z`} fill={COLOR_HEX[b]} />
                {/* center dot: mix result */}
                <circle cx={midX} cy={midY} r={7} fill={result.hex} stroke="#fff" strokeWidth="1" />
                {/* plus sign */}
                <text x={x + cellSize - 4} y={y + 12} textAnchor="end" dominantBaseline="central" fontSize="9" fill="rgba(0,0,0,0.4)">+</text>
              </g>
            );
          })}
        </svg>

        <p style={{ fontSize: 11, color: '#999', margin: '10px 0 0', lineHeight: 1.6 }}>
          左上角 = 列颜色 · 右下角 = 行颜色 · 中心圆 = 混合结果
        </p>

        <button
          onClick={onClose}
          style={{
            marginTop: 12,
            padding: '8px 24px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
