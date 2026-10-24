export const usesPizzaBuilder = item => item?.categoryCustomizable === true && (item.categoryBuilderType ?? 'PIZZA') === 'PIZZA';

export function foodButtonVisible(buttonId, configuration, customCategories, halfItems, sizesFor) {
  if (configuration[buttonId] === false) return false;
  if (buttonId === 'customPizza') return customCategories.length > 0;
  if (buttonId === 'halfAndHalf') return halfItems.some((left, index) => halfItems.some((right, other) =>
    index !== other && sizesFor(left).some(size => sizesFor(right).includes(size))));
  return true;
}
