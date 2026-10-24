// Draws every image on the profile, once per theme (-dark / -light), and the
// board for the playable snake. Black and white only: hairlines, greyscale
// contribution cells, and Geist embedded so every viewer sees the same type.
//
//   hero      the name, written into a contribution graph
//   link-*    link chips
//   h-*       section titles
//   about     two sentences
//   stack     the tools (assets/src/icons.json)
//   rally     project cards (Ral: assets/src/ral-court.webp,
//   nighter     All Nighter: assets/src/allnighter.jpg)
//   numbers   the last twelve months, live
//   months    the same, month by month, live
//   footer
//   docs/grid.json   the calendar, for the snake page (docs/index.html)
//
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
        contributionsCollection {
          contributionCalendar { totalContributions weeks { contributionDays { date contributionCount weekday } } }
        }
        repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
          nodes { languages(first: 8, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } }
        }
      }
    }`,
    variables: { login: LOGIN },
  }),
})
const body = await res.json()
if (body.errors) throw new Error(JSON.stringify(body.errors))
const { contributionsCollection, repositories } = body.data.user
const calendar = contributionsCollection.contributionCalendar
const weeks = calendar.weeks
const days = weeks.flatMap((w) => w.contributionDays)

// ── system ──────────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    page: '#0A0A0B', card: '#0E0E10', edge: '#1F1F23', ink: '#EDEDEC', mute: '#8B8B88', dim: '#5A5A56',
    levels: ['#161618', '#2C2C30', '#4A4A50', '#8E8E94', '#EDEDEC'],
  },
  light: {
    page: '#FAFAFA', card: '#FFFFFF', edge: '#E4E4E7', ink: '#18181B', mute: '#71717A', dim: '#A1A1AA',
    levels: ['#EEEEF0', '#D4D4D8', '#A1A1AA', '#6B6B73', '#18181B'],
  },
}
let C = THEMES.dark

const W = 1200
const SANS = "'G', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'GM', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

const fontFiles = {
  'G-400': 'Geist-Regular.woff',
  'G-500': 'Geist-Medium.woff',
  'G-600': 'Geist-SemiBold.woff',
  'GM-400': 'GeistMono-Regular.woff',
}
const fontData = {}
for (const [k, f] of Object.entries(fontFiles)) fontData[k] = (await readFile(`assets/src/${f}`)).toString('base64')
// Only the faces an image uses are embedded in it.
const fonts = (...keys) =>
  keys
    .map((k) => {
      const [family, weight] = k.split('-')
      return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(data:font/woff;base64,${fontData[k]}) format('woff'); }`
    })
    .join('\n    ')

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const svg = (w, h, label, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">\n${inner}\n</svg>\n`
const card = (x, y, w, h, fill = C.card) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="14" fill="${fill}" stroke="${C.edge}"/>`
const fmt = (n) => n.toLocaleString('en-US')

// Same pseudo-random sequence every build, so static images stay static.
function rng(seed) {
  return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
}

// ── hero: the name, in a contribution graph ─────────────────────────────────

const FONT5 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
}
const COLS = 53

function nameGrid(text) {
  const cols = []
  for (const ch of text) {
    const g = FONT5[ch]
    for (let x = 0; x < g[0].length; x++) cols.push(g.map((row) => row[x] === '#'))
    cols.push(Array(7).fill(false))
  }
  cols.pop()
  const left = Math.floor((COLS - cols.length) / 2)
  return Array.from({ length: COLS }, (_, x) => cols[x - left] || Array(7).fill(false))
}

function hero() {
  const H = 360
  const CELL = 16
  const GAP = 4
  const X0 = (W - (COLS * (CELL + GAP) - GAP)) / 2
  const Y0 = 72
  const r = rng(7)
  const cells = []
  nameGrid('ARYAN RAO').forEach((col, x) =>
    col.forEach((on, y) => {
      const v = r()
      const fill = on ? C.levels[4] : v < 0.035 ? C.levels[1] : C.levels[0]
      const anim = on ? ` class="on" style="animation-delay:${x * 22 + y * 8}ms"` : ''
      cells.push(`<rect x="${X0 + x * (CELL + GAP)}" y="${Y0 + y * (CELL + GAP)}" width="${CELL}" height="${CELL}" rx="3.5" fill="${fill}"${anim}/>`)
    }),
  )
  const bottom = Y0 + 7 * (CELL + GAP) - GAP
  return svg(
    W,
    H,
    'Aryan Rao, written into a contribution graph. Product engineer. I ship the whole thing: app, site, backend, launch film.',
    `  <style>
    ${fonts('G-400', 'G-500')}
    .line { font: 500 20px ${SANS}; letter-spacing: -0.3px; fill: ${C.ink}; }
    .line tspan { font-weight: 400; fill: ${C.mute}; }
    .on { animation: light .5s cubic-bezier(.2, .7, .2, 1) backwards; } @keyframes light { from { opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .on { animation: none } }
  </style>
  ${card(0, 0, W, H, C.page)}
  ${cells.join('\n  ')}
  <line x1="${X0}" y1="${bottom + 48.5}" x2="${W - X0}" y2="${bottom + 48.5}" stroke="${C.edge}"/>
  <text x="${X0}" y="${bottom + 96}" class="line">Product engineer. <tspan>I ship the whole thing: app, site, backend, launch film.</tspan></text>`,
  )
}

// ── link chips ──────────────────────────────────────────────────────────────

function chip(label) {
  const w = Math.round(28 + label.length * 7.8 + 44)
  return svg(
    w,
    42,
    label,
    `  <style>${fonts('GM-400')} .t { font: 400 13px ${MONO}; fill: ${C.ink}; } .a { font: 400 13px ${MONO}; fill: ${C.mute}; }</style>
  <rect x=".5" y=".5" width="${w - 1}" height="41" rx="10" fill="${C.card}" stroke="${C.edge}"/>
  <text x="20" y="25.5" class="t">${esc(label)}</text>
  <text x="${w - 18}" y="25.5" text-anchor="end" class="a">↗</text>`,
  )
}

// ── section titles ──────────────────────────────────────────────────────────

function header(title) {
  return svg(
    W,
    88,
    title,
    `  <style>${fonts('G-500')} .t { font: 500 24px ${SANS}; letter-spacing: -0.6px; fill: ${C.ink}; }</style>
  <text x="2" y="58" class="t">${esc(title)}</text>
  <line x1="${28 + title.length * 13}" y1="50.5" x2="${W}" y2="50.5" stroke="${C.edge}"/>`,
  )
}

// ── about ───────────────────────────────────────────────────────────────────

function about() {
  const H = 236
  return svg(
    W,
    H,
    "I build products end to end: the app, the site, the backend, the store listing, and the film that launches it. Right now that's Rally.",
    `  <style>
    ${fonts('G-400', 'G-500')}
    .lead { font: 500 30px ${SANS}; letter-spacing: -0.9px; fill: ${C.ink}; }
    .lead tspan.m { font-weight: 400; fill: ${C.mute}; }
    .body { font: 400 17px ${SANS}; fill: ${C.mute}; }
  </style>
  ${card(0, 0, W, H)}
  <text x="40" y="78" class="lead">I build products end to end. <tspan class="m">The app, the site, the backend,</tspan></text>
  <text x="40" y="118" class="lead"><tspan class="m">the store listing, and the film that launches it.</tspan></text>
  <text x="40" y="180" class="body">Right now that's Rally. You score a match, your opponent confirms it, and one rating per sport moves.</text>`,
  )
}

// ── stack ───────────────────────────────────────────────────────────────────

async function stack() {
  const icons = Object.values(JSON.parse(await readFile('assets/src/icons.json', 'utf8')))
  const PER = 5
  const GAP = 12
  const CW = (W - GAP * (PER - 1)) / PER
  const CH = 64
  const rows = Math.ceil(icons.length / PER)
  const H = rows * CH + (rows - 1) * GAP
  const chips = icons
    .map((ic, i) => {
      const x = (i % PER) * (CW + GAP)
      const y = Math.floor(i / PER) * (CH + GAP)
      return `<g>${card(x, y, CW, CH)}<path transform="translate(${x + 22} ${y + 21}) scale(.9167)" fill="${C.ink}" d="${ic.d}"/><text x="${x + 58}" y="${y + 37.5}" class="t">${esc(ic.title)}</text></g>`
    })
    .join('\n  ')
  return svg(W, H, icons.map((i) => i.title).join(', '), `  <style>${fonts('G-500')} .t { font: 500 16px ${SANS}; letter-spacing: -0.2px; fill: ${C.ink}; }</style>\n  ${chips}`)
}

// ── project cards ───────────────────────────────────────────────────────────

// The art is the product's own look, shown in greyscale so the page stays
// black and white.
function projectCard(art, title, kind, line) {
  const CW = 594
  const H = 440
  return svg(
    CW,
    H,
    `${title}. ${line}`,
    `  <style>
    ${fonts('G-400', 'G-600', 'GM-400')}
    .word { font: 600 72px ${SANS}; letter-spacing: -3px; fill: #F5F2EC; }
    .tag { font: 400 17px ${SANS}; fill: #A8A49C; }
    .t { font: 600 22px ${SANS}; letter-spacing: -0.6px; fill: ${C.ink}; }
    .kind { font: 400 12px ${MONO}; fill: ${C.mute}; }
    .l { font: 400 15px ${SANS}; fill: ${C.mute}; }
    .bob { transform-box: fill-box; transform-origin: bottom; animation: bob 3.2s ease-in-out infinite; } @keyframes bob { 50% { transform: translateY(-5px) } }
    @media (prefers-reduced-motion: reduce) { .bob { animation: none } }
  </style>
  ${card(0, 0, CW, H)}
  <clipPath id="c"><rect x="10" y="10" width="${CW - 20}" height="310" rx="9"/></clipPath>
  <filter id="mono"><feColorMatrix type="saturate" values="0"/></filter>
  <g clip-path="url(#c)" filter="url(#mono)">${art}</g>
  <rect x="10.5" y="10.5" width="${CW - 21}" height="309" rx="8.5" fill="none" stroke="${C.edge}"/>
  <text x="26" y="370" class="t">${esc(title)}</text>
  <text x="${CW - 26}" y="368" text-anchor="end" class="kind">${esc(kind)} ↗</text>
  <text x="26" y="402" class="l">${esc(line)}</text>`,
  )
}

async function rallyCard() {
  const ral = (await readFile('assets/src/ral-court.webp')).toString('base64')
  const art = `<rect x="10" y="10" width="574" height="310" fill="#0B0B0C"/>
    <line x1="10" y1="272.5" x2="584" y2="272.5" stroke="#2A2A2D"/>
    <text x="50" y="168" class="word">Rally</text>
    <rect x="217" y="151" width="14" height="14" fill="#F5F2EC"/>
    <text x="54" y="204" class="tag">Take your sport seriously.</text>
    <ellipse cx="448" cy="274" rx="76" ry="7" fill="#000" opacity=".55"/>
    <image class="bob" x="328" y="44" width="240" height="232" href="data:image/webp;base64,${ral}" xlink:href="data:image/webp;base64,${ral}"/>`
  return projectCard(art, 'Rally', 'iOS, Android', 'Ratings for the people you actually play with.')
}

async function nighterCard() {
  const img = (await readFile('assets/src/allnighter.jpg')).toString('base64')
  const art = `<image x="10" y="10" width="574" height="310" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${img}" xlink:href="data:image/jpeg;base64,${img}"/>`
  return projectCard(art, 'All Nighter', 'Web', 'The night before the paper, planned honestly.')
}

// ── numbers ─────────────────────────────────────────────────────────────────

let longest = 0
let run = 0
for (const d of days) {
  run = d.contributionCount > 0 ? run + 1 : 0
  longest = Math.max(longest, run)
}
let current = 0
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount > 0) current++
  else if (i === days.length - 1) continue
  else break
}
const activeDays = days.filter((d) => d.contributionCount > 0).length

const langBytes = new Map()
for (const repo of repositories.nodes) for (const { size, node } of repo.languages.edges) langBytes.set(node.name, (langBytes.get(node.name) || 0) + size)
const langTotal = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1
const languages = [...langBytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 4)
  .map(([name, size]) => ({ name, pct: (size / langTotal) * 100 }))

function numbers() {
  const H = 200
  const stat = (x, v, k) => `<text x="${x}" y="104" class="big">${esc(v)}</text><text x="${x}" y="136" class="k">${esc(k)}</text>`
  const langs = languages.map((l, i) => `<text x="826" y="${76 + i * 30}" class="lang">${esc(l.name)}</text><text x="1170" y="${76 + i * 30}" text-anchor="end" class="k">${l.pct.toFixed(1)}%</text>`).join('')
  return svg(
    W,
    H,
    `${fmt(calendar.totalContributions)} contributions in the last year, ${activeDays} days with commits, ${current}-day current streak, ${longest}-day longest streak`,
    `  <style>
    ${fonts('G-400', 'G-500', 'G-600')}
    .big { font: 600 48px ${SANS}; letter-spacing: -1.8px; fill: ${C.ink}; }
    .k { font: 400 14px ${SANS}; fill: ${C.mute}; }
    .lang { font: 500 15px ${SANS}; fill: ${C.ink}; }
  </style>
  ${card(0, 0, 790, H)}
  ${stat(40, fmt(calendar.totalContributions), 'contributions this year')}
  ${stat(300, String(activeDays), 'days with commits')}
  ${stat(530, `${longest}d`, 'longest streak')}
  ${card(802, 0, 398, H)}
  ${langs}`,
  )
}

// ── months, drawn as columns of cells ───────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function months() {
  const H = 268
  const byMonth = new Map()
  for (const d of days) {
    const k = d.date.slice(0, 7)
    byMonth.set(k, (byMonth.get(k) || 0) + d.contributionCount)
  }
  const keys = [...byMonth.keys()].slice(-12)
  const peak = Math.max(1, ...keys.map((k) => byMonth.get(k)))
  const ROWS = 8
  const CELL = 14
  const GAP = 4
  const colW = 3 * CELL + 2 * GAP
  const span = (W - 80 - colW) / 11
  const cols = keys
    .map((k, i) => {
      const v = byMonth.get(k)
      const lit = v === 0 ? 0 : Math.max(1, Math.round((v / peak) * ROWS))
      const x0 = 40 + i * span
      let cells = ''
      for (let row = 0; row < ROWS; row++) {
        for (let c = 0; c < 3; c++) {
          const on = ROWS - row <= lit
          cells += `<rect x="${(x0 + c * (CELL + GAP)).toFixed(1)}" y="${36 + row * (CELL + GAP)}" width="${CELL}" height="${CELL}" rx="3" fill="${on ? C.levels[4] : C.levels[0]}"/>`
        }
      }
      const cx = (x0 + colW / 2).toFixed(1)
      const base = 36 + ROWS * (CELL + GAP)
      return `${cells}<text x="${cx}" y="${base + 24}" text-anchor="middle" class="mo">${MONTHS[Number(k.slice(5, 7)) - 1]}</text><text x="${cx}" y="${base + 44}" text-anchor="middle" class="v">${v ? fmt(v) : ''}</text>`
    })
    .join('\n  ')
  return svg(
    W,
    H,
    `Contributions by month over the last twelve months, peaking at ${fmt(peak)}`,
    `  <style>${fonts('G-400', 'GM-400')} .mo { font: 400 13px ${SANS}; fill: ${C.mute}; } .v { font: 400 12px ${MONO}; fill: ${C.dim}; }</style>
  ${card(0, 0, W, H)}
  ${cols}`,
  )
}

// ── footer ──────────────────────────────────────────────────────────────────

function footer() {
  const H = 110
  const r = rng(11)
  let cells = ''
  for (let x = 0; x < COLS; x++) {
    const v = r()
    const fade = 1 - Math.abs(x - COLS / 2) / (COLS / 2)
    const lvl = v < fade * 0.45 ? (v < fade * 0.18 ? 4 : 3) : v < 0.12 ? 1 : 0
    cells += `<rect x="${(W - COLS * 20 + 4) / 2 + x * 20}" y="24" width="16" height="16" rx="3.5" fill="${C.levels[lvl]}"/>`
  }
  return svg(
    W,
    H,
    'Rebuilt every morning from the GitHub API.',
    `  <style>${fonts('G-400')} .f { font: 400 13px ${SANS}; fill: ${C.dim}; }</style>
  ${cells}
  <text x="${W / 2}" y="84" text-anchor="middle" class="f">Rebuilt every morning from the GitHub API.</text>`,
  )
}

// ── write ───────────────────────────────────────────────────────────────────

await mkdir('assets', { recursive: true })
await mkdir('docs', { recursive: true })
let count = 0
for (const [theme, palette] of Object.entries(THEMES)) {
  C = palette
  const out = {
    hero: hero(),
    'link-rally': chip('playrally.app'),
    'link-nighter': chip('allnighter.in'),
    'h-about': header('About'),
    'h-stack': header('Stack'),
    'h-work': header('Work'),
    'h-numbers': header('This year'),
    'h-snake': header('Snake'),
    about: about(),
    stack: await stack(),
    rally: await rallyCard(),
    nighter: await nighterCard(),
    numbers: numbers(),
    months: months(),
    footer: footer(),
  }
  for (const [f, s] of Object.entries(out)) await writeFile(`assets/${f}-${theme}.svg`, s)
  count += Object.keys(out).length
}

// The game board: one column per week, one row per weekday, each cell 0-4
// like GitHub's own graph (quartiles of the non-zero days).
const counts = days.map((d) => d.contributionCount).filter((c) => c > 0).sort((a, b) => a - b)
const q = (p) => counts[Math.floor(p * (counts.length - 1))] || 1
const cuts = [q(0.25), q(0.5), q(0.75)]
const level = (c) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4)
const grid = weeks.map((w) => {
  const col = Array(7).fill(0)
  for (const d of w.contributionDays) col[d.weekday] = level(d.contributionCount)
  return col
})
await writeFile('docs/grid.json', JSON.stringify({ login: LOGIN, grid }))

console.log(`${count} images; ${fmt(calendar.totalContributions)} contributions; streak ${current}/${longest}`)
