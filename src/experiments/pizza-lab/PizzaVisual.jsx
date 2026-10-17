import { useId } from 'react';
import { toppingPoints } from './model';
import { getPizzaSaucePresentation } from '../../utils/ingredientPizzaPresentation';

export function IngredientMark({ ingredient }) {
  const color = ingredient.color;
  switch (ingredient.art) {
    case 'shreds': return <g fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"><path d="m-10-7 5 14m5-17 1 17m5-14 5 10M-11 1l20-3" /><path d="m-5-9 1 3m11 6 3 3" stroke="#d8c99c" strokeWidth="1" /></g>;
    case 'mozzarella': return <><ellipse rx="12" ry="10" fill={color} stroke={ingredient.accent || '#d8ceb7'} strokeWidth="1.5" /><path d="M-6-3Q0-7 6-2" fill="none" stroke="#fff" strokeWidth="2" /></>;
    case 'cheddar': return <><path d="M-12-8 9-10 12 8-9 10Z" fill={color} stroke="#c67d22" /><path d="M-8-5 7-6" stroke="#ffcf6b" strokeWidth="2" /></>;
    case 'flakes': return <g fill={color} stroke="#b9a15e"><path d="m-12-5 12-5-5 15Z" /><path d="m4-3 10 7-13 6Z" /></g>;
    case 'crumbles': return <g fill={color} stroke="#cfc5ac">{[[-7,-5,5],[5,-6,6],[0,5,7],[9,6,4]].map(([cx,cy,r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}</g>;
    case 'pepperoni': return <><circle r="12" fill={color} stroke="#802b22" strokeWidth="2" /><g fill={ingredient.accent}>{[[-5,-4],[5,-5],[-3,5],[6,4]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.7" />)}</g></>;
    case 'chorizo': return <><ellipse rx="12" ry="11" fill={color} stroke="#884020" strokeWidth="2" /><path d="m-7-4 4-2 2 4-4 2Zm9-3 5 2-2 4-4-2Zm-5 9 5 1-1 4-5-1Z" fill={ingredient.accent} /></>;
    case 'salami': return <><circle r="12" fill={color} stroke="#71424a" /><g fill={ingredient.accent}>{[[-7,-4,2],[0,-7,1.5],[6,-3,2.5],[-4,3,2],[3,6,2.5],[8,4,1]].map(([cx,cy,r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}</g></>;
    case 'tomato': return <><circle r="12" fill={color} stroke="#a13a28" /><path d="M0-9V9M-8-5 8 5M-8 5 8-5" stroke={ingredient.accent} strokeWidth="2" /><circle r="3" fill="#efb97d" /></>;
    case 'tentacle': return <><path d="M-12 6Q-3-13 8-7Q17-1 7 10" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" /><g fill={ingredient.accent || '#f4d8ca'}>{[-7, 0, 7].map((x, i) => <circle key={x} cx={x} cy={i === 1 ? -4 : 2} r="2.4" />)}</g></>;
    case 'shrimp': return <><path d="M10-7C-9-17-19 7-3 12Q6 15 10 5" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" /><path d="M-7-6-3-2M-10 2-5 3M-6 9-3 6" stroke={ingredient.accent || '#fff0d6'} strokeWidth="2" /></>;
    case 'ring': return <><ellipse rx="11" ry="8" fill="none" stroke={color} strokeWidth="5" /><ellipse rx="11" ry="8" fill="none" stroke={ingredient.accent || '#d8d7b3'} strokeWidth="1" /></>;
    case 'slice': return <><circle r="12" fill={color} stroke="#813d2f" /><path d="m-6-4 3 2m6-5 2 3m-9 9 3-2m6 3 2-3" stroke={ingredient.accent || '#e9c288'} strokeWidth="2.5" /></>;
    case 'strip': return <path d="M-13-5Q-2-10 13-4L11 3Q0 0-11 6Z" fill={color} stroke="#5e6243" />;
    case 'kernel': return <path d="M-7-7Q0-12 7-5L6 7Q0 11-6 6Z" fill={color} stroke="#c99527" />;
    case 'blue-cheese': return <><path d="M-11-5 2-11 12 1 5 10-10 5Z" fill={color} stroke="#c2baa2" /><path d="m-7-3 5 2-2 5m7-11-1 5 5 3" fill="none" stroke={ingredient.accent || '#527d76'} strokeWidth="2" /></>;
    case 'sauce': return <><ellipse rx="13" ry="10" fill={color} /><path d="M-8 0Q0-10 8-2" stroke="#fff" opacity=".3" strokeWidth="3" fill="none" /></>;
    case 'cheese': return <path d="M-11-5Q-3-14 5-8L12 0 6 9-4 7-12 2Z" fill={color} stroke="#e9cb7f" />;
    case 'goat': return <><circle r="10" fill={color} stroke="#d6c6a4" strokeWidth="2" /><circle cx="-3" cy="-3" r="2" fill="#e9dec7" /></>;
    case 'mushroom': return <><path d="M-3 0L-5 12Q0 15 5 12L3 0" fill="#e2cdb2" /><path d="M-13 1C-14-16 14-16 13 1Q0 7-13 1" fill={color} stroke="#6b503c" /><path d="M-8 1Q0 5 8 1" stroke="#e1c4a0" fill="none" /></>;
    case 'olive': return <ellipse rx="8" ry="10" fill="none" stroke={color} strokeWidth="5" />;
    case 'basil': return <><path d="M0 12Q-19-5 0-15Q17 0 0 12" fill={color} /><path d="M0 10V-10" stroke="#8caf6b" /></>;
    case 'bacon': return <><path d="M-13-5L-4-8 4-4 13-7 12 4 3 7-4 3-12 6Z" fill={color} /><path d="M-11 0L-4-2 4 1 11-1" fill="none" stroke="#efac8b" strokeWidth="3" /></>;
    case 'ham': return <path d="M-11-9L12-6 8 10-12 6Z" fill={color} stroke="#c9766b" />;
    default: return <path d="M-9-8L10-4 6 9-9 5Z" fill={color} stroke="#88785f" />;
  }
}

function CheeseCoverage({ ingredient }) {
  const clipId = `cheese-${useId().replace(/:/g, '')}`;
  const double = ingredient.quantity === 'DOUBLE';
  const count = double ? 25 : 21;
  const paths = Array.from({ length: count }, (_, i) => {
    const offset = 50 + i * 300 / (count - 1);
    const bend = Math.sin(i * 2.4 + (Number(ingredient.id) || 0)) * 5;
    return `M40 ${offset} C120 ${offset + 6 + bend} 260 ${offset - 8} 360 ${offset + bend}`;
  });
  return <g data-cheese-coverage="true">
    <defs><clipPath id={clipId}><circle cx="200" cy="200" r="140" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`} fill="none" strokeLinecap="round">
      {[-32, 53].map(angle => <g key={angle} transform={`rotate(${angle} 200 200)`}>
        {paths.map((d, i) => <g key={i}>
          <path d={d} stroke="#d4ad65" strokeWidth={double ? 10 : 8} opacity=".45" />
          <path d={d} stroke={ingredient.color} strokeWidth={double ? 8 : 6} />
          <path d={d} stroke="#fffbed" strokeWidth="1.5" opacity=".45" />
        </g>)}
      </g>)}
    </g>
  </g>;
}

export default function PizzaVisual({ ingredients, catalog, animate = true }) {
  const uid = useId().replace(/:/g, '');
  const selected = ingredients.map(row => {
    const ingredient = { ...catalog.find(item => item.id === row.id), ...row };
    return ingredient.art === 'sauce' ? { ...ingredient, sauceRole: getPizzaSaucePresentation(ingredient).sauceRole } : ingredient;
  });
  const layer = { cheese: 1, 'blue-cheese': 1, goat: 1, shreds: 1, mozzarella: 1, cheddar: 1, flakes: 1, crumbles: 1 };
  const layerFor = row => row.art === 'sauce' ? (row.sauceRole === 'BASE' ? 0 : 3) : (layer[row.art] ?? 2);
  const sorted = [...selected].sort((a, b) => layerFor(a) - layerFor(b));
  return <svg className={`pl-pizza ${animate ? '' : 'pl-still'}`} viewBox="0 0 400 400" role="img" aria-label={`Tu pizza con ${selected.length} ingredientes. Consulta el resumen para las cantidades y zonas.`}>
    <defs>
      <radialGradient id={`${uid}-crust`}><stop offset="0" stopColor="#f4d29a" /><stop offset=".85" stopColor="#e4aa5c" /><stop offset=".94" stopColor="#d28c3f" /><stop offset="1" stopColor="#ba7332" /></radialGradient>
      <radialGradient id={`${uid}-base`}><stop stopColor="#f3d8a5" /><stop offset="1" stopColor="#edc487" /></radialGradient>
      <clipPath id={`${uid}-FULL`}><circle cx="200" cy="200" r="151" /></clipPath>
      <clipPath id={`${uid}-LEFT`}><path d="M200 49A151 151 0 0 0 200 351Z" /></clipPath>
      <clipPath id={`${uid}-RIGHT`}><path d="M200 49A151 151 0 0 1 200 351Z" /></clipPath>
    </defs>
    <circle cx="200" cy="206" r="181" fill="#65513a" opacity=".09" />
    <circle cx="200" cy="200" r="177" fill={`url(#${uid}-crust)`} />
    <circle cx="200" cy="200" r="153" fill={`url(#${uid}-base)`} />
    {Array.from({ length: 32 }, (_, i) => { const a = i * 2.399; return <ellipse key={i} cx={200 + Math.cos(a) * 164} cy={200 + Math.sin(a) * 164} rx={3 + i % 4} ry="2" fill="#a96630" opacity=".35" transform={`rotate(${i * 47} ${200 + Math.cos(a) * 164} ${200 + Math.sin(a) * 164})`} />; })}
    {sorted.map(row => <g key={`${row.id}-${row.placement}-${row.quantity}`} clipPath={`url(#${uid}-${row.placement})`} className="pl-topping" data-ingredient={row.id} data-placement={row.placement} data-sauce-role={row.art === 'sauce' ? row.sauceRole : undefined}>
      {row.art === 'sauce' ? row.sauceRole === 'BASE' ? <><circle cx="200" cy="200" r="149" fill={row.color} opacity={row.quantity === 'DOUBLE' ? '.95' : '.8'} /><path d="M105 170C130 90 300 95 301 198S120 299 109 222 246 130 265 201 170 249 163 202" fill="none" stroke="#f4a260" strokeWidth="5" opacity=".2" /></>
        : <g fill="none" stroke={row.color} strokeWidth={row.quantity === 'DOUBLE' ? 8 : 5} strokeLinecap="round" opacity=".95" transform={`rotate(${(Number(row.id) || 0) % 3 * 25 - 25} 200 200)`}>
          {Array.from({ length: row.quantity === 'DOUBLE' ? 9 : 5 }, (_, i) => {
            const y = 90 + i * (row.quantity === 'DOUBLE' ? 27.5 : 55);
            return <path key={i} d={`M55 ${y} C140 ${y - 15} 260 ${y + 15} 345 ${y}`} />;
          })}
        </g>
        : ['cheese', 'shreds', 'mozzarella'].includes(row.art) ? <CheeseCoverage ingredient={row} />
        : toppingPoints(row.id, row.placement, row.quantity).map((point, i) => <g key={i} transform={`translate(${point.x} ${point.y}) rotate(${point.rotation})`}><IngredientMark ingredient={row} /></g>)}
    </g>)}
    <path d="M200 45V355" stroke="#fff9ec" strokeDasharray="4 7" strokeWidth="2" opacity=".65" />
  </svg>;
}
