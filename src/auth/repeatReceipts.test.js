import { readRepeatReceipts, rememberRepeatReceipt } from './repeatReceipts';
beforeEach(() => localStorage.clear());
test('keeps the three latest distinct receipts, separated by business and store', () => {
  ['one', 'two', 'three', 'four', 'three'].forEach(value => rememberRepeatReceipt('a', 'central', value));
  expect(readRepeatReceipts('a', 'central')).toEqual(['three', 'four', 'two']);
  expect(readRepeatReceipts('b', 'central')).toEqual([]);
  expect(readRepeatReceipts('a', 'second')).toEqual([]);
});
