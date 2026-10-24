// Draws every image on the profile, in a dark and a light version, and the
// board for the playable snake:
//   assets/hero-*.svg     name, a slow aurora, and a line that types itself
//   assets/stack-*.svg    the tools, as a row of logo tiles (assets/src/icons.json)
//   assets/rally-*.svg    project tiles, from each product's own share image
//   assets/nighter-*.svg  (assets/src/*.jpg)
//   docs/grid.json        the contribution calendar, for docs/index.html
// Runs daily in .github/workflows/profile.yml. Node 20+, no dependencies.

import { mkdir, readFile, writeFile } from 'node:fs/promises'

const LOGIN = process.env.PROFILE_LOGIN || 'arykv'
const TOKEN = process.env.GITHUB_TOKEN
if (!TOKEN) throw new Error('GITHUB_TOKEN is required')

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'User-Agent': LOGIN },
  body: JSON.stringify({
    query: `query($login: String!) {
      user(login: $login) {
        contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount weekday } } } }
      }
    }`,
    variables: { login: LOGIN },
  }),
})
const body = await res.json()
if (body.errors) throw new Error(JSON.stringify(body.errors))
const weeks = body.data.user.contributionsCollection.contributionCalendar.weeks

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"

const THEMES = {
  dark: { bg: '#08080A', ink: '#F5F5F4', mute: '#8A8A86', edge: '#1E1E21', tile: '#111113', aurora: 0.5, live: '#3FB950' },
  light: { bg: '#FAFAF9', ink: '#0A0A0A', mute: '#6B6B67', edge: '#E7E5E1', tile: '#FFFFFF', aurora: 0.3, live: '#1A7F37' },
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Each phrase types in, holds, and fades; the three share one 12s loop.
const PHRASES = ['i ship the whole thing.', 'app, site, backend, launch film.', 'currently: rally.']
const CHAR = 12.04 // advance of a 20px monospace glyph

function hero(name, t) {
  const W = 1200
  const H = 520
  const typed = PHRASES.map((p, i) => {
    const w = p.length * CHAR
    const x = (W - w) / 2
    return `<clipPath id="tc${i}-${name}"><rect x="${x.toFixed(1)}" y="300" width="${(w + 2).toFixed(1)}" height="40" class="type t${i}"/></clipPath>
  <g clip-path="url(#tc${i}-${name})" class="phrase p${i}"><text x="${x.toFixed(1)}" y="326" class="typed">${esc(p)}</text></g>`
  }).join('\n  ')
  const steps = PHRASES.map((p, i) => `.t${i} { animation-name: type${i} } @keyframes type${i} { 0% { transform: scaleX(0); animation-timing-function: steps(${p.length}) } 12%, 100% { transform: scaleX(1) } }`).join('\n    ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Aryan Rao — i ship the whole thing.">
  <defs>
    <filter id="blur-${name}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="70"/></filter>
    <filter id="grain-${name}"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .08 0"/></filter>
    <clipPath id="card-${name}"><rect width="${W}" height="${H}" rx="24"/></clipPath>
  </defs>
  <style>
    .name { font: 650 104px ${SANS}; letter-spacing: -4px; fill: ${t.ink}; }
    .typed { font: 400 20px ${MONO}; fill: ${t.mute}; }
    .pill { font: 500 13px ${MONO}; letter-spacing: .4px; fill: ${t.ink}; }
    .foot { font: 500 11px ${MONO}; letter-spacing: 2.4px; fill: ${t.mute}; }
    .a { transform-box: fill-box; transform-origin: center; }
    .a1 { animation: d1 19s ease-in-out infinite alternate; }
    .a2 { animation: d2 23s ease-in-out infinite alternate; }
    .a3 { animation: d3 29s ease-in-out infinite alternate; }
    @keyframes d1 { to { transform: translate(220px, 60px) scale(1.2) } }
    @keyframes d2 { to { transform: translate(-240px, -40px) scale(.85) } }
    @keyframes d3 { to { transform: translate(120px, -80px) scale(1.15) } }
    .phrase { opacity: 0; animation: show 12s infinite; }
    .p0 { opacity: 1; }
    .type { transform-box: fill-box; transform-origin: left; animation-duration: 12s; animation-iteration-count: infinite; }
    ${steps}
    .p1, .t1 { animation-delay: 4s } .p2, .t2 { animation-delay: 8s }
    @keyframes show { 0%, 30% { opacity: 1 } 33%, 100% { opacity: 0 } }
    .ping { transform-box: fill-box; transform-origin: center; animation: ping 2.4s cubic-bezier(0, 0, .2, 1) infinite; }
    @keyframes ping { 0% { transform: scale(1); opacity: .8 } 80%, 100% { transform: scale(3); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) {
      .a1, .a2, .a3, .ping, .phrase, .type { animation: none }
      .p1, .p2, .ping { opacity: 0 }
    }
  </style>
  <g clip-path="url(#card-${name})">
    <rect width="${W}" height="${H}" fill="${t.bg}"/>
    <g filter="url(#blur-${name})" opacity="${t.aurora}">
      <circle cx="380" cy="420" r="210" fill="#FF5B22" class="a a1"/>
      <circle cx="820" cy="430" r="230" fill="#FF2E7E" class="a a2"/>
      <circle cx="610" cy="520" r="200" fill="#6A5BFF" class="a a3"/>
    </g>
    <rect width="${W}" height="${H}" filter="url(#grain-${name})"/>
  </g>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="23.5" fill="none" stroke="${t.edge}"/>
  <rect x="499" y="96" width="202" height="34" rx="17" fill="${t.bg}" fill-opacity=".6" stroke="${t.edge}"/>
  <circle cx="523" cy="113" r="4" fill="none" stroke="${t.live}" class="ping"/>
  <circle cx="523" cy="113" r="4" fill="${t.live}"/>
  <text x="537" y="117.5" class="pill">shipping rally</text>
  <text x="${W / 2}" y="252" text-anchor="middle" class="name">Aryan Rao</text>
  ${typed}
  <text x="${W / 2}" y="462" text-anchor="middle" class="foot">PRODUCT ENGINEER  ·  IOS  ·  ANDROID  ·  WEB</text>
</svg>
`
}

async function stack(t) {
  const icons = JSON.parse(await readFile('assets/src/icons.json', 'utf8'))
  const list = Object.values(icons)
  const S = 64
  const GAP = 14
  const W = list.length * S + (list.length - 1) * GAP
  const tiles = list
    .map((ic, i) => {
      const x = i * (S + GAP)
      const fill = ic.hex === 'MONO' ? t.ink : `#${ic.hex}`
      return `<g><title>${esc(ic.title)}</title><rect x="${x + 0.5}" y=".5" width="${S - 1}" height="${S - 1}" rx="16" fill="${t.tile}" stroke="${t.edge}"/><path transform="translate(${x + 18} 18) scale(1.1667)" fill="${fill}" d="${ic.d}"/></g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${S}" viewBox="0 0 ${W} ${S}" role="img" aria-label="${esc(list.map((i) => i.title).join(', '))}">${tiles}</svg>\n`
}

async function tile(file, title, kind, line, t) {
  const img = (await readFile(`assets/src/${file}`)).toString('base64')
  const W = 600
  const H = 410
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)} — ${esc(line)}">
  <defs><clipPath id="c"><rect x="0" y="0" width="${W}" height="315" rx="18"/></clipPath></defs>
  <style>
    .t { font: 600 22px ${SANS}; letter-spacing: -0.6px; fill: ${t.ink}; }
    .kind { font: 500 11px ${MONO}; letter-spacing: 1.6px; fill: ${t.mute}; }
    .l { font: 400 15px ${SANS}; fill: ${t.mute}; }
  </style>
  <image clip-path="url(#c)" width="${W}" height="315" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${img}" xlink:href="data:image/jpeg;base64,${img}"/>
  <rect x=".5" y=".5" width="${W - 1}" height="314" rx="17.5" fill="none" stroke="${t.edge}"/>
  <text x="2" y="358" class="t">${esc(title)}</text>
  <text x="${W - 2}" y="356" class="kind" text-anchor="end">${esc(kind.toUpperCase())}  ↗</text>
  <text x="2" y="388" class="l">${esc(line)}</text>
</svg>
`
}

await mkdir('assets', { recursive: true })
await mkdir('docs', { recursive: true })
for (const [name, t] of Object.entries(THEMES)) {
  await writeFile(`assets/hero-${name}.svg`, hero(name, t))
  await writeFile(`assets/stack-${name}.svg`, await stack(t))
  await writeFile(`assets/rally-${name}.svg`, await tile('rally.jpg', 'Rally', 'ios · android', 'Ratings for the people you actually play with.', t))
  await writeFile(`assets/nighter-${name}.svg`, await tile('allnighter.jpg', 'All Nighter', 'web', 'The night before the paper, planned honestly.', t))
}

// The game board: one column per week, one row per weekday, each cell 0–4
// like GitHub's own graph (quartiles of the non-zero days).
const counts = weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)).filter((c) => c > 0).sort((a, b) => a - b)
const q = (p) => counts[Math.floor(p * (counts.length - 1))] || 1
const cuts = [q(0.25), q(0.5), q(0.75)]
const level = (c) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4)
const grid = weeks.map((w) => {
  const col = Array(7).fill(0)
  for (const d of w.contributionDays) col[d.weekday] = level(d.contributionCount)
  return col
})
await writeFile('docs/grid.json', JSON.stringify({ login: LOGIN, grid }))

console.log(`built hero, stack, tiles and a ${grid.length}-week board`)
