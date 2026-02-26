const DEFAULT_PET_PHOTO_SVG = `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#2b7cee'/>
      <stop offset='100%' stop-color='#5ea8ff'/>
    </linearGradient>
    <radialGradient id='l' cx='0.2' cy='0.2' r='0.9'>
      <stop offset='0%' stop-color='rgba(255,255,255,0.32)'/>
      <stop offset='100%' stop-color='rgba(255,255,255,0)'/>
    </radialGradient>
  </defs>
  <rect width='240' height='240' fill='url(#g)'/>
  <rect width='240' height='240' fill='url(#l)'/>
  <rect x='58' y='58' width='124' height='124' rx='30' fill='rgba(255,255,255,0.18)' stroke='rgba(255,255,255,0.38)' stroke-width='2'/>
  <text x='120' y='142' font-size='88' text-anchor='middle' fill='white' font-family='Arial, sans-serif' font-weight='700'>P</text>
</svg>
`.trim();

export const DEFAULT_PET_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(DEFAULT_PET_PHOTO_SVG)}`;
