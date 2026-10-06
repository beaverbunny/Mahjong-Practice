import React from 'react';
import { Tile, TileType } from '../types/mahjong';

interface MahjongTileProps {
  tile: Tile | { type: TileType; displayName?: string };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isFaceDown?: boolean;
  isSelected?: boolean;
  isRecommended?: boolean;
  safetyLevel?: 'safe' | 'medium' | 'danger';
  isDrawn?: boolean; // Last drawn card spaced slightly to right
  onClick?: () => void;
  disabled?: boolean;
  dimmed?: boolean;
  className?: string;
  badgeText?: string;
  showHints?: boolean; // If false, hide safety and recommendation badges
  isPengTarget?: boolean; // Highlight pair when Peng is available
  isChiTarget?: boolean;  // Highlight sequence when Chi is available
  isHorizontal?: boolean; // Authentic Asian Mahjong horizontal tile orientation for melds
  isCalled?: boolean;     // Highlight the called tile in Chi melds
}

/* ================= SVG SUB-COMPONENTS FOR AUTHENTIC MAHJONG TILES ================= */

// Concentric Dot for Tong (筒子)
const Dot: React.FC<{
  cx: number;
  cy: number;
  r: number;
  color?: 'red' | 'blue' | 'green';
  isLarge?: boolean;
}> = ({ cx, cy, r, color = 'blue', isLarge = false }) => {
  const colorMap = {
    red: { outer: '#DC2626', inner: '#EF4444', center: '#FFFFFF' },
    blue: { outer: '#1D4ED8', inner: '#3B82F6', center: '#FFFFFF' },
    green: { outer: '#15803D', inner: '#22C55E', center: '#FFFFFF' },
  }[color];

  if (isLarge) {
    // 1-Tong (大饼/大筒) - Traditional intricate rosette wheel
    return (
      <g>
        {/* Outer gear / petals */}
        <circle cx={cx} cy={cy} r={r} fill={colorMap.outer} />
        <circle cx={cx} cy={cy} r={r * 0.88} fill="#FEF08A" />
        <circle cx={cx} cy={cy} r={r * 0.78} fill={colorMap.outer} />
        {/* Radiating wheel rays */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <line
            key={angle}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos((angle * Math.PI) / 180) * r * 0.72}
            y2={cy + Math.sin((angle * Math.PI) / 180) * r * 0.72}
            stroke="#FEF08A"
            strokeWidth={r * 0.12}
          />
        ))}
        {/* Inner red flower core */}
        <circle cx={cx} cy={cy} r={r * 0.42} fill="#DC2626" />
        <circle cx={cx} cy={cy} r={r * 0.22} fill="#FFFFFF" />
        <circle cx={cx} cy={cy} r={r * 0.09} fill="#DC2626" />
      </g>
    );
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={colorMap.outer} />
      <circle cx={cx} cy={cy} r={r * 0.65} fill="#FEF9C3" />
      <circle cx={cx} cy={cy} r={r * 0.42} fill={colorMap.inner} />
      <circle cx={cx} cy={cy} r={r * 0.18} fill="#FFFFFF" />
    </g>
  );
};

// Bamboo Stalk for Tiao (條子)
const BambooStalk: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  color?: 'green' | 'red' | 'blue';
  angle?: number;
}> = ({ x, y, width, height, color = 'green', angle = 0 }) => {
  const mainColor = color === 'red' ? '#DC2626' : color === 'blue' ? '#1D4ED8' : '#15803D';
  const nodeColor = color === 'red' ? '#991B1B' : '#166534';

  const transform = angle !== 0 ? `rotate(${angle} ${x + width / 2} ${y + height / 2})` : undefined;

  return (
    <g transform={transform}>
      {/* Bamboo stem background */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={width * 0.35}
        fill={mainColor}
      />
      {/* Bamboo inner spine highlight */}
      <rect
        x={x + width * 0.3}
        y={y + 1}
        width={width * 0.4}
        height={height - 2}
        fill="#86EFAC"
        opacity={0.45}
      />
      {/* Knobs / joints (节) */}
      <rect
        x={x - width * 0.15}
        y={y + height * 0.45}
        width={width * 1.3}
        height={height * 0.1}
        rx={1}
        fill={nodeColor}
      />
      <circle
        cx={x + width / 2}
        cy={y + height * 0.5}
        r={width * 0.25}
        fill="#FFFFFF"
        opacity={0.7}
      />
    </g>
  );
};

// 1-Tiao (一条 / 么鸡) - Iconic Mahjong Peacock / Bird perching on bamboo branch
const BirdOneTiao: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  return (
    <svg
      viewBox="0 0 100 130"
      width={width}
      height={height}
      className="overflow-visible"
    >
      {/* Perch bamboo branch */}
      <rect x="15" y="105" width="70" height="10" rx="4" fill="#15803D" />
      <rect x="35" y="103" width="5" height="14" rx="2" fill="#166534" />
      <rect x="65" y="103" width="5" height="14" rx="2" fill="#166534" />

      {/* Bird body tail feathers */}
      <path
        d="M50 85 C30 95, 20 70, 25 50 C28 40, 40 45, 45 60 Z"
        fill="#15803D"
      />
      <path
        d="M50 85 C25 90, 10 60, 18 35 C22 25, 35 35, 42 55 Z"
        fill="#16A34A"
      />
      <path
        d="M50 85 C20 75, 12 40, 22 20 C28 10, 38 22, 45 45 Z"
        fill="#DC2626"
      />

      {/* Bird Main Body (Breast & Belly) */}
      <ellipse cx="58" cy="72" rx="16" ry="22" fill="#DC2626" />
      <ellipse cx="62" cy="74" rx="11" ry="16" fill="#FBBF24" />

      {/* Wings */}
      <path
        d="M50 60 C42 70, 45 88, 55 90 C62 88, 55 70, 50 60 Z"
        fill="#2563EB"
      />

      {/* Bird Head */}
      <circle cx="68" cy="42" r="11" fill="#15803D" />
      <circle cx="71" cy="40" r="2.5" fill="#FFFFFF" />
      <circle cx="71.5" cy="40" r="1.3" fill="#000000" />

      {/* Beak */}
      <polygon points="78,41 87,43 78,46" fill="#EA580C" />

      {/* Crest / Plumage on head */}
      <path d="M66 32 C65 22, 60 18, 56 16" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="56" cy="16" r="3" fill="#DC2626" />
      <path d="M68 31 C70 20, 72 16, 75 14" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="75" cy="14" r="3" fill="#FBBF24" />

      {/* Claws */}
      <path d="M54 94 L54 105 M64 94 L64 105" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
};

export const MahjongTile: React.FC<MahjongTileProps> = ({
  tile,
  size = 'md',
  isFaceDown = false,
  isSelected = false,
  isRecommended = false,
  safetyLevel,
  isDrawn = false,
  onClick,
  disabled = false,
  dimmed = false,
  className = '',
  badgeText,
  showHints = true, // Default true, but when Strategy Assistant is closed, passed as false!
  isPengTarget = false,
  isChiTarget = false,
  isHorizontal = false,
  isCalled = false,
}) => {
  const type = tile.type;

  // Sizes in pixels (tuned so all 14 tiles fit comfortably on screen at once)
  const dim = {
    xs: { w: 26, h: 36, svgW: 22, svgH: 30 },
    sm: { w: 32, h: 44, svgW: 27, svgH: 38 },
    md: { w: 36, h: 50, svgW: 31, svgH: 43 },
    lg: { w: 41, h: 57, svgW: 35, svgH: 49 },
  }[size];

  const tileW = isHorizontal ? dim.h : dim.w;
  const tileH = isHorizontal ? dim.w : dim.h;

  if (isFaceDown) {
    return (
      <div
        className={`relative select-none rounded-[5px] bg-gradient-to-br from-emerald-800 to-emerald-950 border border-emerald-900/80 shadow-md flex items-center justify-center cursor-default ${className}`}
        style={{ width: `${tileW}px`, height: `${tileH}px` }}
      >
        <div className="w-4/5 h-4/5 rounded-[3px] border border-emerald-600/40 bg-emerald-900/30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />
        </div>
      </div>
    );
  }

  // Render authentic Mahjong graphic faces
  const renderTileFace = () => {
    // ----------------------------------------------------
    // 1. TIAO (條子 / 索子) - Real Bamboo Sticks & 1-Tiao Bird
    // ----------------------------------------------------
    if (type.endsWith('tiao')) {
      const val = parseInt(type[0], 10);

      if (val === 1) {
        return <BirdOneTiao width={dim.svgW} height={dim.svgH} />;
      }

      const viewBox = '0 0 100 130';
      const w = dim.svgW;
      const h = dim.svgH;

      if (val === 2) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <BambooStalk x={44} y={15} width={12} height={42} color="green" />
            <BambooStalk x={44} y={72} width={12} height={42} color="blue" />
          </svg>
        );
      }

      if (val === 3) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <BambooStalk x={44} y={15} width={12} height={42} color="blue" />
            <BambooStalk x={26} y={72} width={12} height={42} color="green" />
            <BambooStalk x={62} y={72} width={12} height={42} color="green" />
          </svg>
        );
      }

      if (val === 4) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <BambooStalk x={26} y={15} width={12} height={42} color="blue" />
            <BambooStalk x={62} y={15} width={12} height={42} color="green" />
            <BambooStalk x={26} y={72} width={12} height={42} color="green" />
            <BambooStalk x={62} y={72} width={12} height={42} color="blue" />
          </svg>
        );
      }

      if (val === 5) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <BambooStalk x={24} y={15} width={11} height={38} color="green" />
            <BambooStalk x={65} y={15} width={11} height={38} color="blue" />
            <BambooStalk x={44.5} y={46} width={11} height={38} color="red" />
            <BambooStalk x={24} y={77} width={11} height={38} color="blue" />
            <BambooStalk x={65} y={77} width={11} height={38} color="green" />
          </svg>
        );
      }

      if (val === 6) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <BambooStalk x={22} y={15} width={11} height={40} color="green" />
            <BambooStalk x={44.5} y={15} width={11} height={40} color="green" />
            <BambooStalk x={67} y={15} width={11} height={40} color="green" />
            <BambooStalk x={22} y={75} width={11} height={40} color="blue" />
            <BambooStalk x={44.5} y={75} width={11} height={40} color="blue" />
            <BambooStalk x={67} y={75} width={11} height={40} color="blue" />
          </svg>
        );
      }

      if (val === 7) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <BambooStalk x={44.5} y={12} width={11} height={36} color="red" />
            <BambooStalk x={22} y={20} width={11} height={34} color="green" angle={15} />
            <BambooStalk x={67} y={20} width={11} height={34} color="green" angle={-15} />
            <BambooStalk x={20} y={75} width={10} height={42} color="blue" />
            <BambooStalk x={38} y={75} width={10} height={42} color="green" />
            <BambooStalk x={56} y={75} width={10} height={42} color="blue" />
            <BambooStalk x={74} y={75} width={10} height={42} color="green" />
          </svg>
        );
      }

      if (val === 8) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <BambooStalk x={24} y={15} width={11} height={38} color="green" angle={18} />
            <BambooStalk x={42} y={15} width={11} height={38} color="green" angle={-18} />
            <BambooStalk x={48} y={15} width={11} height={38} color="blue" angle={18} />
            <BambooStalk x={66} y={15} width={11} height={38} color="blue" angle={-18} />
            <BambooStalk x={24} y={75} width={11} height={38} color="blue" angle={-18} />
            <BambooStalk x={42} y={75} width={11} height={38} color="blue" angle={18} />
            <BambooStalk x={48} y={75} width={11} height={38} color="green" angle={-18} />
            <BambooStalk x={66} y={75} width={11} height={38} color="green" angle={18} />
          </svg>
        );
      }

      if (val === 9) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            {/* Top row */}
            <BambooStalk x={22} y={10} width={11} height={32} color="red" />
            <BambooStalk x={44.5} y={10} width={11} height={32} color="blue" />
            <BambooStalk x={67} y={10} width={11} height={32} color="green" />
            {/* Mid row */}
            <BambooStalk x={22} y={49} width={11} height={32} color="red" />
            <BambooStalk x={44.5} y={49} width={11} height={32} color="blue" />
            <BambooStalk x={67} y={49} width={11} height={32} color="green" />
            {/* Bottom row */}
            <BambooStalk x={22} y={88} width={11} height={32} color="red" />
            <BambooStalk x={44.5} y={88} width={11} height={32} color="blue" />
            <BambooStalk x={67} y={88} width={11} height={32} color="green" />
          </svg>
        );
      }
    }

    // ----------------------------------------------------
    // 2. TONG (筒子 / 饼子) - Real Concentric Graphic Circles
    // ----------------------------------------------------
    if (type.endsWith('tong')) {
      const val = parseInt(type[0], 10);
      const viewBox = '0 0 100 130';
      const w = dim.svgW;
      const h = dim.svgH;

      if (val === 1) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <Dot cx={50} cy={65} r={36} color="blue" isLarge />
          </svg>
        );
      }

      if (val === 2) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <Dot cx={50} cy={35} r={19} color="green" />
            <Dot cx={50} cy={95} r={19} color="blue" />
          </svg>
        );
      }

      if (val === 3) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <Dot cx={28} cy={30} r={15} color="blue" />
            <Dot cx={50} cy={65} r={15} color="red" />
            <Dot cx={72} cy={100} r={15} color="green" />
          </svg>
        );
      }

      if (val === 4) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <Dot cx={30} cy={35} r={16} color="blue" />
            <Dot cx={70} cy={35} r={16} color="green" />
            <Dot cx={30} cy={95} r={16} color="green" />
            <Dot cx={70} cy={95} r={16} color="blue" />
          </svg>
        );
      }

      if (val === 5) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <Dot cx={28} cy={32} r={14} color="blue" />
            <Dot cx={72} cy={32} r={14} color="green" />
            <Dot cx={50} cy={65} r={15} color="red" />
            <Dot cx={28} cy={98} r={14} color="green" />
            <Dot cx={72} cy={98} r={14} color="blue" />
          </svg>
        );
      }

      if (val === 6) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <Dot cx={32} cy={30} r={14} color="green" />
            <Dot cx={68} cy={30} r={14} color="green" />
            <Dot cx={32} cy={68} r={14} color="red" />
            <Dot cx={68} cy={68} r={14} color="red" />
            <Dot cx={32} cy={102} r={14} color="red" />
            <Dot cx={68} cy={102} r={14} color="red" />
          </svg>
        );
      }

      if (val === 7) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            {/* Top diagonal trio */}
            <Dot cx={24} cy={22} r={12} color="green" />
            <Dot cx={50} cy={36} r={12} color="green" />
            <Dot cx={76} cy={50} r={12} color="green" />
            {/* Bottom 4 */}
            <Dot cx={30} cy={80} r={13} color="red" />
            <Dot cx={70} cy={80} r={13} color="red" />
            <Dot cx={30} cy={110} r={13} color="red" />
            <Dot cx={70} cy={110} r={13} color="red" />
          </svg>
        );
      }

      if (val === 8) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            <Dot cx={32} cy={22} r={12} color="blue" />
            <Dot cx={68} cy={22} r={12} color="blue" />
            <Dot cx={32} cy={51} r={12} color="blue" />
            <Dot cx={68} cy={51} r={12} color="blue" />
            <Dot cx={32} cy={80} r={12} color="blue" />
            <Dot cx={68} cy={80} r={12} color="blue" />
            <Dot cx={32} cy={109} r={12} color="blue" />
            <Dot cx={68} cy={109} r={12} color="blue" />
          </svg>
        );
      }

      if (val === 9) {
        return (
          <svg viewBox={viewBox} width={w} height={h}>
            {/* 3 rows of 3 */}
            <Dot cx={25} cy={25} r={12} color="green" />
            <Dot cx={50} cy={25} r={12} color="green" />
            <Dot cx={75} cy={25} r={12} color="green" />
            <Dot cx={25} cy={65} r={12} color="red" />
            <Dot cx={50} cy={65} r={12} color="red" />
            <Dot cx={75} cy={65} r={12} color="red" />
            <Dot cx={25} cy={105} r={12} color="blue" />
            <Dot cx={50} cy={105} r={12} color="blue" />
            <Dot cx={75} cy={105} r={12} color="blue" />
          </svg>
        );
      }
    }

    // ----------------------------------------------------
    // 3. WAN (萬子) - Traditional Chinese Numeral & 萬
    // ----------------------------------------------------
    if (type.endsWith('wan')) {
      const num = parseInt(type[0], 10);
      const chineseNums = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      const fontSizeNum = size === 'lg' ? '1.12rem' : size === 'md' ? '0.95rem' : size === 'sm' ? '0.8rem' : '0.65rem';
      const fontSizeWan = size === 'lg' ? '1.02rem' : size === 'md' ? '0.85rem' : size === 'sm' ? '0.7rem' : '0.55rem';

      return (
        <div className="flex flex-col items-center justify-center leading-none select-none font-serif">
          <span className="text-[#C02626] font-black tracking-tight" style={{ fontSize: fontSizeNum }}>
            {chineseNums[num]}
          </span>
          <span className="text-[#991B1B] font-black tracking-tight mt-0.5" style={{ fontSize: fontSizeWan }}>
            萬
          </span>
        </div>
      );
    }

    // ----------------------------------------------------
    // 4. WINDS (東, 南, 西, 北) - Traditional Calligraphy
    // ----------------------------------------------------
    if (type.startsWith('wind_')) {
      const windCharMap: Record<string, string> = {
        wind_E: '東',
        wind_S: '南',
        wind_W: '西',
        wind_N: '北',
      };
      const windChar = windCharMap[type] || '風';
      const isEast = type === 'wind_E';
      const fontSize = size === 'lg' ? '1.45rem' : size === 'md' ? '1.2rem' : size === 'sm' ? '0.98rem' : '0.78rem';

      return (
        <span
          className={`font-serif font-black ${isEast ? 'text-[#C02626]' : 'text-[#1E293B]'}`}
          style={{ fontSize }}
        >
          {windChar}
        </span>
      );
    }

    // ----------------------------------------------------
    // 5. DRAGONS (中, 發, 白)
    // ----------------------------------------------------
    if (type === 'dragon_C') {
      const fontSize = size === 'lg' ? '1.55rem' : size === 'md' ? '1.3rem' : size === 'sm' ? '1.05rem' : '0.82rem';
      return (
        <span className="font-serif font-black text-[#DC2626]" style={{ fontSize }}>
          中
        </span>
      );
    }

    if (type === 'dragon_F') {
      const fontSize = size === 'lg' ? '1.55rem' : size === 'md' ? '1.3rem' : size === 'sm' ? '1.05rem' : '0.82rem';
      return (
        <span className="font-serif font-black text-[#15803D]" style={{ fontSize }}>
          發
        </span>
      );
    }

    if (type === 'dragon_B') {
      // White Dragon: Classic double-line blue rectangular frame
      const frameW = dim.svgW * 0.72;
      const frameH = dim.svgH * 0.75;
      return (
        <div
          className="rounded-[3px] border-[2.5px] border-[#1D4ED8] bg-white flex items-center justify-center p-0.5"
          style={{ width: `${frameW}px`, height: `${frameH}px` }}
        >
          <div className="w-full h-full rounded-[1px] border border-[#60A5FA]/60 bg-transparent" />
        </div>
      );
    }

    return <span>{tile.displayName || type}</span>;
  };

  // Only show safety badges and recommendation badge when showHints is true!
  const shouldShowSafety = showHints && safetyLevel;
  const shouldShowRec = showHints && isRecommended;

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        relative select-none flex flex-col items-center justify-center transition-all duration-150
        rounded-[5px] bg-[#FAF8F5]
        border-t border-l border-white/95 border-r-2 border-b-[3px] border-stone-300
        shadow-[0_3px_5px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.15)]
        ${isSelected ? '-translate-y-2.5 shadow-xl ring-2 ring-amber-400 bg-amber-50' : ''}
        ${isCalled ? 'ring-2 ring-amber-400 bg-amber-50/80 shadow-md' : ''}
        ${isPengTarget ? '-translate-y-1.5 shadow-lg ring-2 ring-blue-500 bg-blue-50/40' : ''}
        ${isChiTarget && !isPengTarget ? '-translate-y-1 ring-2 ring-emerald-500 bg-emerald-50/30' : ''}
        ${shouldShowRec && !isPengTarget && !isChiTarget && !isCalled ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}
        ${onClick && !disabled ? 'cursor-pointer hover:-translate-y-1 hover:brightness-105 active:translate-y-0' : 'cursor-default'}
        ${dimmed ? 'opacity-40 grayscale' : ''}
        ${disabled ? 'cursor-not-allowed opacity-60' : ''}
        ${isDrawn ? 'ml-2 sm:ml-2.5' : ''}
        ${className}
      `}
      style={{
        width: `${tileW}px`,
        height: `${tileH}px`,
        boxShadow: isSelected
          ? '0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -2px rgba(0, 0, 0, 0.25)'
          : undefined,
      }}
    >
      {/* 3D Tile Layer depth (Mahjong bottom emerald/bone layer) */}
      <div className={`absolute inset-x-0 bottom-0 ${isHorizontal ? 'h-0.5' : 'h-1'} bg-stone-300/80 rounded-b-[4px]`} />

      {/* Is Called Badge (吃牌突出标示) */}
      {isCalled && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-stone-950 font-black text-[9px] px-1 rounded-sm shadow z-20 whitespace-nowrap">
          吃
        </div>
      )}

      {/* Peng Target Tag */}
      {isPengTarget && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] px-1 rounded-sm shadow font-sans font-bold whitespace-nowrap z-20 animate-bounce">
          碰
        </div>
      )}

      {/* Chi Target Tag */}
      {isChiTarget && !isPengTarget && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] px-1 rounded-sm shadow font-sans font-bold whitespace-nowrap z-20">
          吃
        </div>
      )}

      {/* Safety Badge: Only when showHints is true */}
      {shouldShowSafety && !isPengTarget && (
        <div
          className={`absolute -top-1.5 -right-1 text-[9px] px-1 py-0.2 rounded font-sans font-bold shadow-sm z-10 ${
            safetyLevel === 'safe'
              ? 'bg-emerald-600 text-white'
              : safetyLevel === 'medium'
              ? 'bg-amber-500 text-stone-900'
              : 'bg-rose-600 text-white animate-pulse'
          }`}
        >
          {safetyLevel === 'safe' ? '安' : safetyLevel === 'medium' ? '中' : '危'}
        </div>
      )}

      {/* Recommended Tag: Only when showHints is true */}
      {shouldShowRec && !badgeText && !isPengTarget && !isChiTarget && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] px-1 rounded-sm shadow font-sans font-bold whitespace-nowrap z-10">
          荐
        </div>
      )}

      {/* Custom badge text */}
      {badgeText && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-600 text-white text-[9px] px-1 rounded-sm shadow font-sans font-bold whitespace-nowrap z-10">
          {badgeText}
        </div>
      )}

      {/* Tile Graphics */}
      <div className={`relative z-0 flex items-center justify-center ${isHorizontal ? '-rotate-90 origin-center' : ''}`}>
        {renderTileFace()}
      </div>
    </div>
  );
};
