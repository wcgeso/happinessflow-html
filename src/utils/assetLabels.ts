import { BUSINESS_PRESETS, REAL_ESTATE_TYPES, STOCK_NAMES } from '../constants';
import { Asset } from '../types';

export const extractAssetSymbol = (value?: string | null) => value?.match(/[A-Z]\d+/)?.[0] || '';

const stripTrailingCode = (value: string) => value.replace(/\s*\([A-Z]\d+\)\s*$/, '').trim();

export const getStockAssetLabel = (symbol?: string | null) => {
  const code = extractAssetSymbol(symbol);
  if (!code) return symbol || '股票';
  return STOCK_NAMES[code] ? `${code} ${STOCK_NAMES[code]}` : code;
};

const HOUSE_TYPE_LABELS: Record<string, string> = {
  '1room': '單間小套房',
  '2room': '兩房一廳住宅',
  '3room': '三房兩廳住宅',
  '5room': '五房三廳豪華住宅',
  'store_small': '小型店面',
  'store_medium': '中型店面',
  'store_large': '大型店面',
  'store': '店面',
};

export const getRealEstateAssetLabel = (symbol?: string | null, houseType?: string | null) => {
  const code = extractAssetSymbol(symbol);
  const houseTypeLabel = houseType ? (HOUSE_TYPE_LABELS[houseType] ?? houseType) : null;
  if (!code) return houseTypeLabel || symbol || '不動產';
  const typeLabel = REAL_ESTATE_TYPES[code]?.label || houseTypeLabel || '不動產';
  return `${code} ${typeLabel}`;
};

export const getBusinessAssetLabel = (symbol?: string | null, fallbackName?: string | null) => {
  const code = extractAssetSymbol(symbol);
  if (code) {
    const presetName = BUSINESS_PRESETS[code]?.name;
    const cleanName = presetName ? stripTrailingCode(presetName) : (fallbackName || '').replace(/^企業\s*/, '').trim();
    return cleanName ? `${code} ${cleanName}` : code;
  }

  const rawName = (fallbackName || symbol || '').replace(/^企業\s*/, '').trim();
  return rawName || '企業';
};

export const getAssetDisplayLabel = (asset: Asset) => {
  if (asset.type === '股票') return getStockAssetLabel(asset.name);
  if (asset.type === '不動產') return getRealEstateAssetLabel(asset.name, asset.houseType);
  if (asset.type === '企業') return getBusinessAssetLabel(asset.name, asset.name);
  return asset.name;
};
