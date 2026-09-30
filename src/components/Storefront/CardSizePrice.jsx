import { useEffect, useState } from 'react';
import { STOREFRONT_PRICE_REFRESH_MS } from '../../constants/storefrontTiming';

const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', 'ST'];
export function getCardPriceSizes(item) {
  const available = Array.isArray(item.selectSize) && item.selectSize.length ? item.selectSize : Object.keys(item.priceBySize || {});
  return [...new Set(available)].filter(size => Number.isFinite(Number(item.priceBySize?.[size])) && Number(item.priceBySize?.[size]) > 0)
    .sort((a, b) => {
      const rank = size => sizeOrder.includes(size) ? sizeOrder.indexOf(size) : sizeOrder.length;
      return rank(a) - rank(b);
    });
}

function RotatingPrices({ item, sizes, renderPrice }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep(value => value + 1), STOREFRONT_PRICE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  const active = step % sizes.length;
  const previous = step ? (step - 1) % sizes.length : -1;
  const label = sizes.map(size => `EUR ${Number(item.priceBySize[size]).toFixed(2)} (${size})`).join(' · ');
  return <span className="sf-sizePriceTicker" role="group" aria-label={label} title={label}>
    {sizes.map((size, index) => <span key={`${size}-${index === active ? step : 'idle'}`}
      className={`sf-sizePriceSlide ${index === active ? 'is-current' : index === previous ? 'is-previous' : ''} ${step ? 'has-started' : ''}`}
      aria-hidden="true">
      {renderPrice(size, true)}
    </span>)}
  </span>;
}

export default function CardSizePrice({ item, fallbackSize, renderPrice }) {
  const sizes = getCardPriceSizes(item);
  if (sizes.length < 2) return renderPrice(sizes[0] || fallbackSize, false);
  return <RotatingPrices key={sizes.join('|')} item={item} sizes={sizes} renderPrice={renderPrice}/>;
}
