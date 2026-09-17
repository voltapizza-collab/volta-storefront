import {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductNoticeSelector from './ProductNoticeSelector';
import ProductNoticeBadge from '../Storefront/ProductNoticeBadge';

function Form({initial=[]}) { const [value,setValue]=useState(initial);return <ProductNoticeSelector value={value} onChange={setValue} />; }
test('notices can be combined, selected all at once, cleared and individually removed', () => {
  render(<Form initial={['vegan','kosher']} />);
  expect(screen.getByLabelText('Vegano')).toBeChecked();expect(screen.getByLabelText('Kosher')).toBeChecked();
  expect(screen.getAllByRole('checkbox')).toHaveLength(6);
  expect(screen.getByLabelText('Halal')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Halal'));
  expect(screen.getByLabelText('Halal')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Kosher'));
  expect(screen.getByLabelText('Kosher')).not.toBeChecked();
  expect(screen.getByLabelText('Halal')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Kosher'));
  fireEvent.click(screen.getByLabelText('Vegetariano'));
  expect(screen.getByLabelText('Vegetariano')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Sin gluten'));
  expect(screen.getByLabelText('Kosher')).toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'Marcar todos'}));
  screen.getAllByRole('checkbox').forEach(checkbox=>expect(checkbox).toBeChecked());
  fireEvent.click(screen.getByLabelText('Picante'));
  expect(screen.getByLabelText('Picante')).not.toBeChecked();expect(screen.getByLabelText('Sin gluten')).toBeChecked();
  fireEvent.click(screen.getByRole('button',{name:'Quitar todos'}));
  screen.getAllByRole('checkbox').forEach(checkbox=>expect(checkbox).not.toBeChecked());
});
test('one accessible badge includes all six notices with matching colours and no truncation', () => {
  const view=render(<ProductNoticeBadge tags={['halal','kosher','vegan','spicy','vegetarian','gluten_free','kosher','unknown']} />);
  expect(screen.getAllByRole('note')).toHaveLength(1);
  expect(screen.getByRole('note')).toHaveAccessibleName('Picante, Vegano, Vegetariano, Sin gluten, Kosher, Halal');
  expect(document.querySelector('.lsf-noticeTrack--6')).toBeInTheDocument();
  expect(screen.getByText('Halal')).toHaveClass('lsf-productTag--halal');
  expect(screen.getByText('Vegetariano')).toHaveClass('lsf-productTag--vegetarian');
  expect(screen.getByText('Sin gluten')).toHaveClass('lsf-productTag--gluten_free');
  view.rerender(<ProductNoticeBadge tags={['halal']} />);
  expect(screen.getByRole('note')).toHaveAccessibleName('Halal');
  expect(document.querySelector('.lsf-noticeRepeat')).not.toBeInTheDocument();
  view.rerender(<ProductNoticeBadge tags={[]} />);
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});
test('selector supports every backoffice language',()=>{
  for(const [language,label] of [['es','Vegetariano'],['en','Vegetarian'],['it','Vegetariano'],['fr','Végétarien'],['pt','Vegetariano']]){
    const view=render(<ProductNoticeSelector language={language} onChange={()=>{}} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByLabelText('Halal')).toBeInTheDocument();view.unmount();
  }
});
