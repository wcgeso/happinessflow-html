import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, GraduationCap, Heart, Landmark, Newspaper, Sparkles, Wrench } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import SafeImage from '../../components/common/SafeImage';
import { BOARD_SQUARES } from '../../constants/board';
import { Room } from '../../context/RoomContext';
import { BoardCardResult, BoardSquare } from '../../types';

const TILE_SIZE = 126;
const TILE_GAP = 16;
const BOARD_PADDING = 84;
const BOARD_GRID_SIZE = TILE_SIZE * 14 + TILE_GAP * 13;
const BOARD_WIDTH = BOARD_GRID_SIZE + BOARD_PADDING * 2;
const BOARD_HEIGHT = BOARD_GRID_SIZE + BOARD_PADDING * 2;
const FIT_ZOOM = 0.62;
const VIEWPORT_PADDING_X = 64;
const VIEWPORT_PADDING_TOP = 80;
const VIEWPORT_PADDING_BOTTOM = 32;

const SQUARE_THEME: Record<BoardSquare['type'], {
  bg: string;
  border: string;
  surface: string;
  bevel: string;
  glow: string;
  icon: string;
  text: string;
  cardBack: string;
  label: string;
}> = {
  school: {
    bg: 'bg-[#d8c4a8]',
    border: 'border-[#9d7a54]',
    surface: 'from-[#ead9c3] via-[#d9c1a0] to-[#c8a57a]',
    bevel: 'from-white/70 via-white/15 to-[#8f6a42]/18',
    glow: 'shadow-[inset_0_1px_0_rgba(255,250,240,0.85),0_18px_30px_-18px_rgba(126,92,55,0.8)]',
    icon: 'text-[#7a5b36]',
    text: 'text-[#563c24]',
    cardBack: 'from-[#d8c4a8] via-[#c9ad86] to-[#b99367]',
    label: '學校'
  },
  hospital: {
    bg: 'bg-[#e7c8bc]',
    border: 'border-[#b7775d]',
    surface: 'from-[#f0ddd4] via-[#e5bfb0] to-[#d59b84]',
    bevel: 'from-white/70 via-white/18 to-[#9f5f49]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,248,244,0.88),0_18px_30px_-18px_rgba(154,95,72,0.72)]',
    icon: 'text-[#92563f]',
    text: 'text-[#6b4131]',
    cardBack: 'from-[#e7c8bc] via-[#d8a693] to-[#c78369]',
    label: '醫院'
  },
  bank: {
    bg: 'bg-[#d7ddc5]',
    border: 'border-[#8c9a67]',
    surface: 'from-[#e8eddc] via-[#d2d9b5] to-[#b5c087]',
    bevel: 'from-white/70 via-white/18 to-[#71804c]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(250,255,244,0.88),0_18px_30px_-18px_rgba(99,113,66,0.68)]',
    icon: 'text-[#627144]',
    text: 'text-[#48543a]',
    cardBack: 'from-[#d7ddc5] via-[#bfc99d] to-[#96a66e]',
    label: '銀行'
  },
  repair: {
    bg: 'bg-[#dec49e]',
    border: 'border-[#b48545]',
    surface: 'from-[#efdec2] via-[#dec098] to-[#c99c60]',
    bevel: 'from-white/70 via-white/16 to-[#99662c]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,249,240,0.86),0_18px_30px_-18px_rgba(150,103,47,0.68)]',
    icon: 'text-[#8b6431]',
    text: 'text-[#614522]',
    cardBack: 'from-[#dec49e] via-[#d1a96d] to-[#b88442]',
    label: '維修廠'
  },
  happiness: {
    bg: 'bg-[#ead9b7]',
    border: 'border-[#bc9455]',
    surface: 'from-[#faedd1] via-[#edd5a5] to-[#ddb36a]',
    bevel: 'from-white/70 via-white/18 to-[#a57331]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,252,244,0.9),0_18px_30px_-18px_rgba(168,118,48,0.72)]',
    icon: 'text-[#8c6832]',
    text: 'text-[#614825]',
    cardBack: 'from-[#f0dcac] via-[#e2bd6b] to-[#c99440]',
    label: '幸福卡'
  },
  news: {
    bg: 'bg-[#d7d8ce]',
    border: 'border-[#9a9985]',
    surface: 'from-[#eef0e7] via-[#d3d5c8] to-[#b4b5a1]',
    bevel: 'from-white/70 via-white/18 to-[#7e7d67]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(252,252,248,0.88),0_18px_30px_-18px_rgba(110,109,90,0.62)]',
    icon: 'text-[#696750]',
    text: 'text-[#4c4a40]',
    cardBack: 'from-[#dbddd2] via-[#bfc2b1] to-[#9c9d87]',
    label: '新聞卡'
  },
  opportunity: {
    bg: 'bg-[#d7ccbb]',
    border: 'border-[#a38764]',
    surface: 'from-[#eee2d3] via-[#dac6ab] to-[#c2a17a]',
    bevel: 'from-white/70 via-white/18 to-[#8b6a45]/20',
    glow: 'shadow-[inset_0_1px_0_rgba(255,250,245,0.88),0_18px_30px_-18px_rgba(122,92,56,0.68)]',
    icon: 'text-[#765d3b]',
    text: 'text-[#544434]',
    cardBack: 'from-[#dfd1bd] via-[#c8ae86] to-[#a98255]',
    label: '機運卡'
  }
};

const DECK_TO_SQUARE_TYPE: Record<BoardCardResult['deck'], BoardSquare['type']> = {
  happiness: 'happiness',
  news: 'news',
  opportunity: 'opportunity'
};

const getSquareIcon = (square: BoardSquare, size = 18) => {
  switch (square.type) {
    case 'school':
      return <GraduationCap size={size} />;
    case 'hospital':
      return <Activity size={size} />;
    case 'bank':
      return <Landmark size={size} />;
    case 'repair':
      return <Wrench size={size} />;
    case 'news':
      return <Newspaper size={size} />;
    case 'opportunity':
      return <Sparkles size={size} />;
    default:
      return <Heart size={size} />;
  }
};

const getCardIcon = (deck: BoardCardResult['deck'], size = 30) => {
  switch (deck) {
    case 'news':
      return <Newspaper size={size} />;
    case 'opportunity':
      return <Sparkles size={size} />;
    default:
      return <Heart size={size} />;
  }
};

const getGridCoordinates = (index: number) => {
  if (index <= 13) return { column: index + 1, row: 1 };
  if (index <= 25) return { column: 14, row: index - 12 };
  if (index <= 39) return { column: 40 - index, row: 14 };
  return { column: 1, row: 53 - index };
};

const getGridPosition = (index: number) => {
  const { column, row } = getGridCoordinates(index);
  return { gridColumn: `${column}`, gridRow: `${row}` };
};

const getAvatarStyle = (player: { photoPosition?: string; photoScale?: string }) => {
  let position = { x: 50, y: 50 };
  let scale = 1;

  if (player.photoPosition) {
    try {
      const parsed = typeof player.photoPosition === 'string' ? JSON.parse(player.photoPosition) : player.photoPosition;
      position = {
        x: parsed?.x ?? 50,
        y: parsed?.y ?? 50
      };
    } catch {
      position = { x: 50, y: parseInt(player.photoPosition, 10) || 50 };
    }
  }

  if (player.photoScale) {
    scale = parseFloat(player.photoScale) || 1;
  }

  return {
    objectPosition: `${position.x}% ${position.y}%`,
    transform: `scale(${scale})`
  };
};

const renderPlayerToken = (player: {
  name: string;
  photoURL?: string;
  photoPosition?: string;
  photoScale?: string;
}) => {
  const isCustomAvatar = !!player.photoURL && (player.photoURL.startsWith('http') || player.photoURL.startsWith('data:image'));

  if (!isCustomAvatar) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f8dfb5] to-[#c78f47] text-base shadow-inner">
        🐝
      </div>
    );
  }

  return (
    <SafeImage
      src={player.photoURL}
      alt={player.name}
      className="h-full w-full object-cover"
      style={getAvatarStyle(player)}
    />
  );
};

const CardStage: React.FC<{
  card: BoardCardResult | null;
  isRevealed: boolean;
  roomName: string;
  roomId: string;
  currentTurnName: string;
}> = ({ card, isRevealed, roomName, roomId, currentTurnName }) => {
  if (!card) {
    return (
      <div className="w-[580px] rounded-[28px] border border-[#d9bd95] bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,232,209,0.95))] px-10 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_28px_60px_-38px_rgba(92,64,33,0.62)]">
        <div className="text-sm font-black tracking-[0.3em] text-[#9c7c58]">{roomName}</div>
        <div className="mt-3 text-6xl font-black leading-none text-[#4f3c29]">{roomId}</div>
        <div className="mt-6 text-xs font-black tracking-[0.3em] text-[#9c7c58]">目前回合</div>
        <div className="mt-2 truncate text-4xl font-black text-[#4f3c29]">{currentTurnName}</div>
      </div>
    );
  }

  const theme = SQUARE_THEME[DECK_TO_SQUARE_TYPE[card.deck]];
  const subtitle = `${card.subtitle || ''} ${card.cardId}`.trim();

  return (
    <div className="w-[560px]" style={{ perspective: '1400px' }}>
      <div
        className="relative aspect-[16/10] w-full transition-transform duration-700"
        style={{
          transformStyle: 'preserve-3d',
          transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        <div
          className={`absolute inset-0 overflow-hidden rounded-[28px] border-2 border-white/70 bg-gradient-to-br ${theme.cardBack} shadow-[0_26px_60px_-32px_rgba(91,62,31,0.8)]`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-[12px] rounded-[20px] border border-white/60" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #5b4127 1px, transparent 1px)', backgroundSize: '14px 14px' }} />
          <div className="relative z-10 flex h-full flex-col items-center justify-center text-[#4f3c29]">
            <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[24px] border border-white/60 bg-white/35 shadow-inner">
              {getCardIcon(card.deck, 38)}
            </div>
            <div className="text-3xl font-black tracking-[0.18em]">{theme.label}</div>
            <div className="mt-3 text-sm font-black tracking-[0.28em] opacity-70">等待玩家翻開</div>
          </div>
        </div>

        <div
          className="absolute inset-0 overflow-hidden rounded-[28px] border border-[#d4b68d] bg-[#fffaf2] text-[#4f3c29] shadow-[0_26px_60px_-32px_rgba(91,62,31,0.8)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className={`h-3 bg-gradient-to-r ${theme.cardBack}`} />
          <div className="flex h-[calc(100%-12px)] flex-col p-6">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.24em] text-[#9c7c58]">
              {getCardIcon(card.deck, 18)}
              <span>{theme.label}</span>
            </div>
            <div className="mt-3 text-4xl font-black leading-tight">{card.title}</div>
            {subtitle && (
              <div className="mt-3 w-fit rounded-full border border-[#d6bd9a] bg-[#f4e6d0] px-3 py-1 text-xs font-black tracking-[0.12em] text-[#76573a]">
                {subtitle}
              </div>
            )}
            <p className="mt-5 line-clamp-4 text-base font-semibold leading-relaxed text-[#715742]">
              {card.description}
            </p>
            {!!card.effectLines?.length && (
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                {card.effectLines.slice(0, 4).map((line, index) => (
                  <div key={`${card.cardId}_${index}`} className="rounded-[12px] border border-[#ead6b9] bg-[#fffdf8] px-3 py-2 text-sm font-black text-[#5f4933]">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BoardProjectionView: React.FC<{ roomCode: string }> = ({ roomCode }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [zoom, setZoom] = useState(FIT_ZOOM);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const boardFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'rooms', roomCode), snapshot => {
      setRoom(snapshot.exists() ? snapshot.data() as Room : null);
    });

    return () => unsubscribe();
  }, [roomCode]);

  const players = useMemo(() => {
    if (!room?.boardState) return [];
    return room.boardState.turnOrder.map(uid => {
      const member = room.members.find(item => item.uid === uid);
      return {
        uid,
        name: member?.name || '玩家',
        photoURL: member?.photoURL,
        photoPosition: member?.photoPosition,
        photoScale: member?.photoScale,
        position: room.boardState?.playerPositions?.[uid] || 0
      };
    });
  }, [room]);

  const playerGroups = useMemo(() => {
    return BOARD_SQUARES.reduce<Record<number, typeof players>>((acc, square) => {
      acc[square.index] = players.filter(player => player.position === square.index);
      return acc;
    }, {});
  }, [players]);

  const setZoomAroundPoint = (nextZoom: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom(nextZoom);
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX ?? rect.left + rect.width / 2;
    const anchorY = clientY ?? rect.top + rect.height / 2;
    const contentX = (viewport.scrollLeft + anchorX - rect.left) / zoom;
    const contentY = (viewport.scrollTop + anchorY - rect.top) / zoom;

    setZoom(nextZoom);

    requestAnimationFrame(() => {
      viewport.scrollLeft = contentX * nextZoom - (anchorX - rect.left);
      viewport.scrollTop = contentY * nextZoom - (anchorY - rect.top);
    });
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;

      event.preventDefault();
      const delta = -event.deltaY * 0.0025;
      const nextZoom = Math.min(1.4, Math.max(0.45, Number((zoom + delta).toFixed(3))));
      setZoomAroundPoint(nextZoom, event.clientX, event.clientY);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [zoom]);

  const currentTurnUid = room?.boardState?.currentTurnUid || null;
  const currentTurnPosition = currentTurnUid
    ? room?.boardState?.playerPositions?.[currentTurnUid] ?? null
    : null;

  useEffect(() => {
    const viewport = viewportRef.current;
    const boardFrame = boardFrameRef.current;
    if (!viewport || !boardFrame || currentTurnPosition === null) return;

    const { column, row } = getGridCoordinates(currentTurnPosition);
    const tileCenterX = BOARD_PADDING + (column - 1) * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
    const tileCenterY = BOARD_PADDING + (row - 1) * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;

    requestAnimationFrame(() => {
      const targetLeft = boardFrame.offsetLeft + tileCenterX * zoom - viewport.clientWidth / 2;
      const targetTop = boardFrame.offsetTop + tileCenterY * zoom - viewport.clientHeight / 2;
      const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

      viewport.scrollTo({
        left: Math.min(maxLeft, Math.max(0, targetLeft)),
        top: Math.min(maxTop, Math.max(0, targetTop)),
        behavior: 'smooth'
      });
    });
  }, [currentTurnUid, currentTurnPosition]);

  if (!room) {
    return <div className="flex h-screen items-center justify-center bg-[#efe2ce] text-[#5a4430]">找不到房間 {roomCode}</div>;
  }

  const boardState = room.boardState;
  const roomName = room.name || '蜂富人生';
  const currentTurnName = room.members.find(member => member.uid === boardState?.currentTurnUid)?.name || '尚未開始';
  const currentCard = boardState?.currentCard || null;
  const revealState = boardState?.currentCardReveal;
  const isCardRevealed = !!(
    currentCard &&
    revealState?.eventId === boardState?.currentEvent?.id &&
    revealState?.cardId === currentCard.cardId &&
    revealState?.isRevealed
  );
  const zoomPercent = Math.round(zoom * 100);
  const scaledBoardWidth = BOARD_WIDTH * zoom;
  const scaledBoardHeight = BOARD_HEIGHT * zoom;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || event.button !== 0) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    };
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;
    if (!viewport || !dragState || dragState.pointerId !== event.pointerId) return;

    viewport.scrollLeft = dragState.scrollLeft - (event.clientX - dragState.startX);
    viewport.scrollTop = dragState.scrollTop - (event.clientY - dragState.startY);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const dragState = dragStateRef.current;
    if (!viewport || !dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setZoomAroundPoint(zoom < 1 ? 1 : FIT_ZOOM, event.clientX, event.clientY);
  };

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={handleDoubleClick}
      className="h-screen cursor-grab overflow-auto bg-[radial-gradient(circle_at_top,#f8f1e5_0%,#efe2ce_45%,#e5d2b5_100%)] text-[#4f3c29] active:cursor-grabbing"
    >
      <div
        onPointerDown={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
        className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-full border border-[#d2b58c] bg-[linear-gradient(180deg,rgba(255,251,244,0.98),rgba(242,228,204,0.96))] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_36px_-28px_rgba(92,64,33,0.65)]"
      >
        <button
          type="button"
          onClick={() => setZoomAroundPoint(Math.max(0.45, Number((zoom - 0.1).toFixed(2))))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d9bd98] bg-[#f8ead7] text-xl font-black text-[#6a4d2d]"
          aria-label="縮小地圖"
        >
          -
        </button>
        <div className="min-w-[4.5rem] text-center text-sm font-black tracking-[0.08em] text-[#6a4d2d]">{zoomPercent}%</div>
        <button
          type="button"
          onClick={() => setZoomAroundPoint(Math.min(1.4, Number((zoom + 0.1).toFixed(2))))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d9bd98] bg-[#f8ead7] text-xl font-black text-[#6a4d2d]"
          aria-label="放大地圖"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoomAroundPoint(FIT_ZOOM)}
          className="h-9 rounded-full border border-[#d9bd98] bg-[#f8ead7] px-4 text-sm font-black text-[#6a4d2d]"
        >
          適合螢幕
        </button>
        <button
          type="button"
          onClick={() => setZoomAroundPoint(1)}
          className="h-9 rounded-full border border-[#d9bd98] bg-[#f8ead7] px-4 text-sm font-black text-[#6a4d2d]"
        >
          100%
        </button>
      </div>

      <div
        className="min-h-full min-w-full"
        style={{
          width: `max(100%, ${scaledBoardWidth + VIEWPORT_PADDING_X}px)`,
          height: `max(100%, ${scaledBoardHeight + VIEWPORT_PADDING_TOP + VIEWPORT_PADDING_BOTTOM}px)`,
          padding: `${VIEWPORT_PADDING_TOP}px ${VIEWPORT_PADDING_X / 2}px ${VIEWPORT_PADDING_BOTTOM}px`
        }}
      >
        <div
          ref={boardFrameRef}
          className="mx-auto shrink-0"
          style={{ width: `${scaledBoardWidth}px`, height: `${scaledBoardHeight}px` }}
        >
          <main
            className="relative shrink-0 overflow-hidden rounded-[34px] border border-[#d2b58c] bg-[linear-gradient(180deg,#fbf4ea_0%,#f2e2ca_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_30px_70px_-42px_rgba(105,75,42,0.58)]"
            style={{
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,248,235,0.96),rgba(241,222,195,0.95)_55%,rgba(227,203,166,0.94)_100%)]">
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(148,112,70,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,112,70,0.08) 1px, transparent 1px)', backgroundSize: '34px 34px' }} />
              <div className="absolute inset-[4.5%] rounded-[28px] border border-[#d6bc96]/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]" />
              <div className="absolute inset-[9%] rounded-[24px] border border-dashed border-[#cfb28a] bg-[#fffaf2]/78 shadow-[inset_0_0_50px_rgba(219,190,147,0.18)]" />
            </div>

            <div
              className="absolute grid grid-cols-[repeat(14,126px)] grid-rows-[repeat(14,126px)] gap-4"
              style={{ left: BOARD_PADDING, top: BOARD_PADDING }}
            >
              {BOARD_SQUARES.map(square => {
                const theme = SQUARE_THEME[square.type];
                const groupedPlayers = playerGroups[square.index] || [];
                const hasPlayers = groupedPlayers.length > 0;
                const isCorner = square.type === 'school' || square.type === 'hospital';
                const isCurrentEventSquare = boardState?.currentEvent?.squareIndex === square.index;

                return (
                  <div
                    key={square.id}
                    className={[
                      'relative flex h-[126px] w-[126px] flex-col items-center justify-center overflow-hidden border text-center transition-all duration-300',
                      isCorner ? 'rounded-[20px]' : 'rounded-[14px]',
                      isCurrentEventSquare ? 'z-20 -translate-y-1 ring-[3px] ring-[#8f6a3b]/45 shadow-[0_22px_40px_-20px_rgba(117,83,42,0.8)]' : 'hover:-translate-y-0.5',
                      theme.bg,
                      theme.border,
                      theme.glow
                    ].join(' ')}
                    style={getGridPosition(square.index)}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.surface}`} />
                    <div className={`absolute inset-[1px] rounded-[inherit] bg-gradient-to-br ${theme.bevel} opacity-90`} />
                    <div className="absolute inset-x-[10px] top-[8px] h-[22px] rounded-full bg-white/28 blur-md" />
                    <div className="absolute inset-x-0 bottom-0 h-[30px] bg-gradient-to-t from-[#8f6a3b]/10 to-transparent" />
                    <div className={`${theme.icon} mb-2`}>
                      {getSquareIcon(square, isCorner ? 30 : 24)}
                    </div>
                    <div className={`relative z-10 text-[22px] font-black leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.3)] ${theme.text}`}>
                      {square.label}
                    </div>

                    {hasPlayers && (
                      <div className="pointer-events-none absolute bottom-2 left-1/2 grid w-[132px] -translate-x-1/2 grid-cols-3 justify-items-center gap-1">
                        {groupedPlayers.slice(0, 6).map(player => (
                          <div
                            key={player.uid}
                            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#fff8ee] bg-[linear-gradient(180deg,#8f6b48,#6f5237)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_20px_-10px_rgba(86,58,32,0.9)]"
                            title={player.name}
                          >
                            {renderPlayerToken(player)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className="absolute z-10 flex items-center justify-center rounded-[28px] border border-[#dcc4a2] bg-[linear-gradient(180deg,rgba(255,252,246,0.94),rgba(246,233,212,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_0_50px_rgba(207,178,138,0.22),0_28px_40px_-28px_rgba(104,75,43,0.45)]"
              style={{
                left: BOARD_PADDING + TILE_SIZE * 2 + TILE_GAP * 2,
                right: BOARD_PADDING + TILE_SIZE * 2 + TILE_GAP * 2,
                top: BOARD_PADDING + TILE_SIZE * 2 + TILE_GAP * 2,
                bottom: BOARD_PADDING + TILE_SIZE * 2 + TILE_GAP * 2
              }}
            >
              <CardStage
                card={currentCard}
                isRevealed={isCardRevealed}
                roomName={roomName}
                roomId={room.id}
                currentTurnName={currentTurnName}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
