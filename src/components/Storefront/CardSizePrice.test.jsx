import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CardSizePrice, { getCardPriceSizes } from './CardSizePrice';
import { STOREFRONT_PRICE_REFRESH_MS } from '../../constants/storefrontTiming';
const item={selectSize:['M','S'],priceBySize:{S:3.5,M:7.5,L:10}};
const renderPrice=(size,showSize)=><strong>EUR {Number(item.priceBySize[size]).toFixed(2)}{showSize&&` (${size})`}</strong>;
beforeEach(()=>jest.useFakeTimers());
afterEach(()=>jest.useRealTimers());
test('cycles available sizes with the same cadence as Trending and wraps',()=>{
 const {container,unmount}=render(<CardSizePrice item={item} fallbackSize="M" renderPrice={renderPrice}/>);
 const current=()=>container.querySelector('.is-current').textContent;
 expect(current()).toBe('EUR 3.50 (S)');
 act(()=>jest.advanceTimersByTime(STOREFRONT_PRICE_REFRESH_MS-1));expect(current()).toBe('EUR 3.50 (S)');
 act(()=>jest.advanceTimersByTime(1));expect(current()).toBe('EUR 7.50 (M)');
 act(()=>jest.advanceTimersByTime(STOREFRONT_PRICE_REFRESH_MS));expect(current()).toBe('EUR 3.50 (S)');
 expect(screen.getByRole('group')).toHaveAccessibleName('EUR 3.50 (S) · EUR 7.50 (M)');
 unmount();expect(jest.getTimerCount()).toBe(0);
});
test('one available size has no ticker, suffix or timer, even if other prices exist',()=>{
 render(<CardSizePrice item={{...item,selectSize:['S']}} fallbackSize="M" renderPrice={renderPrice}/>);
 expect(screen.getByText('EUR 3.50')).toBeInTheDocument();
 expect(screen.queryByRole('group')).not.toBeInTheDocument();expect(jest.getTimerCount()).toBe(0);
});
test('ignores unavailable and invalid prices, keeps equal-priced presentations',()=>{
 expect(getCardPriceSizes({priceBySize:{XL:12,M:7,S:7,L:'',XXL:null,BAD:Infinity}})).toEqual(['S','M','XL']);
});
