// Draws every image on the profile and the board for the playable snake.
// One system: near-black cards, hairlines, Geist (embedded, so every viewer
// sees the same type), and Rally orange used only as contribution cells.
//
//   assets/hero.svg        the name, written into a contribution graph
//   assets/link-*.svg      link chips
//   assets/h-*.svg         section headers
//   assets/about.svg       a terminal, and Ral
//   assets/stack.svg       the tools (assets/src/icons.json)
//   assets/rally.svg       project cards
//   assets/nighter.svg
//   assets/numbers.svg     the year in numbers           — live
//   assets/months.svg      the year by month, as cells   — live
//   assets/footer.svg
//   docs/grid.json         the calendar, for the snake page (docs/index.html)
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

const C = {
  page: '#0A0A0B',
  card: '#0E0E10',
  edge: '#1F1F23',
  rule: '#18181B',
  ink: '#EDEDEC',
  mute: '#8B8B88',
  dim: '#55554F',
  empty: '#18181B',
  levels: ['#18181B', '#3B1A10', '#7A2E12', '#C2410C', '#FF5B22'],
  accent: '#FF5B22',
  live: '#3FB950',
}
const W = 1200
const SANS = "'G', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "'GM', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

const fontFiles = {
  'G-400': 'Geist-Regular.woff',
  'G-500': 'Geist-Medium.woff',
  'G-600': 'Geist-SemiBold.woff',
  'GM-400': 'GeistMono-Regular.woff',
  'GM-500': 'GeistMono-Medium.woff',
}
const fontData = {}
for (const [k, f] of Object.entries(fontFiles)) fontData[k] = (await readFile(`assets/src/${f}`)).toString('base64')
// Only the faces a card uses are embedded in it.
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
const PING = `.ping { transform-box: fill-box; transform-origin: center; animation: ping 2.4s cubic-bezier(0, 0, .2, 1) infinite; }
    @keyframes ping { 0% { transform: scale(1); opacity: .8 } 80%, 100% { transform: scale(3); opacity: 0 } }
    .blink { animation: blink 1.1s steps(1) infinite; } @keyframes blink { 50% { opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .ping, .blink, .on { animation: none } .ping { opacity: 0 } }`
const liveDot = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="3.5" fill="none" stroke="${C.live}" class="ping"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="${C.live}"/>`

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
  const H = 420
  const CELL = 16
  const GAP = 4
  const X0 = (W - (COLS * (CELL + GAP) - GAP)) / 2
  const Y0 = 120
  const r = rng(7)
  const cells = []
  nameGrid('ARYAN RAO').forEach((col, x) =>
    col.forEach((on, y) => {
      const v = r()
      const fill = on ? C.levels[v < 0.22 ? 3 : 4] : v < 0.035 ? C.levels[1] : C.empty
      const anim = on ? ` class="on" style="animation-delay:${x * 22 + y * 8}ms"` : ''
      cells.push(`<rect x="${X0 + x * (CELL + GAP)}" y="${Y0 + y * (CELL + GAP)}" width="${CELL}" height="${CELL}" rx="3.5" fill="${fill}"${anim}/>`)
    }),
  )
  const bottom = Y0 + 7 * (CELL + GAP) - GAP
  const months = ['NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT']
  const monthRow = months.map((m, i) => `<text x="${(X0 + i * ((COLS * (CELL + GAP)) / 12)).toFixed(1)}" y="${Y0 - 16}" class="m">${m}</text>`).join('')
  return svg(
    W,
    H,
    'Aryan Rao, written into a contribution graph. Product engineer — I ship the whole thing.',
    `  <style>
    ${fonts('G-400', 'G-500', 'GM-400', 'GM-500')}
    .label { font: 500 12px ${MONO}; letter-spacing: 1.4px; fill: ${C.mute}; }
    .m { font: 400 10.5px ${MONO}; letter-spacing: 1px; fill: ${C.dim}; }
    .pill { font: 500 12px ${MONO}; fill: ${C.ink}; }
    .line { font: 500 18px ${SANS}; letter-spacing: -0.2px; fill: ${C.ink}; }
    .line tspan { font-weight: 400; fill: ${C.mute}; }
    .on { animation: light .5s cubic-bezier(.2, .7, .2, 1) backwards; } @keyframes light { from { opacity: 0 } }
    ${PING}
  </style>
  ${card(0, 0, W, H, C.page)}
  <text x="${X0}" y="58" class="label">ARYAN RAO · ARYKV</text>
  ${liveDot(W - X0 - 112, 54)}
  <text x="${W - X0}" y="58" text-anchor="end" class="pill">shipping rally</text>
  ${monthRow}
  ${cells.join('\n  ')}
  <line x1="${X0}" y1="${bottom + 42.5}" x2="${W - X0}" y2="${bottom + 42.5}" stroke="${C.edge}"/>
  <text x="${X0}" y="${bottom + 84}" class="line">Product engineer. <tspan>I ship the whole thing — app, site, backend, launch film.</tspan></text>
  <text x="${W - X0}" y="${bottom + 84}" text-anchor="end" class="label">IOS · ANDROID · WEB</text>`,
  )
}

// ── link chips ──────────────────────────────────────────────────────────────

function chip(label, glyph) {
  const w = Math.round(46 + label.length * 7.8 + 40)
  const icons = {
    square: `<rect x="22" y="15" width="12" height="12" rx="2.5" fill="${C.accent}"/>`,
    moon: `<path d="M33 25.5a7.5 7.5 0 1 1-6.5-11.2 6 6 0 0 0 6.5 11.2z" fill="${C.ink}"/>`,
    grid: [0, 1, 2].flatMap((x) => [0, 1, 2].map((y) => `<rect x="${21 + x * 5}" y="${14 + y * 5}" width="4" height="4" rx="1" fill="${(x + y) % 2 ? C.accent : C.levels[2]}"/>`)).join(''),
  }
  return svg(
    w,
    42,
    label,
    `  <style>${fonts('GM-500')} .t { font: 500 13px ${MONO}; fill: ${C.ink}; } .a { font: 500 13px ${MONO}; fill: ${C.mute}; }</style>
  <rect x=".5" y=".5" width="${w - 1}" height="41" rx="10" fill="${C.card}" stroke="${C.edge}"/>
  ${icons[glyph]}
  <text x="46" y="25.5" class="t">${esc(label)}</text>
  <text x="${w - 16}" y="25.5" text-anchor="end" class="a">↗</text>`,
  )
}

// ── section headers ─────────────────────────────────────────────────────────

function header(n, title, hint) {
  return svg(
    W,
    84,
    title,
    `  <style>${fonts('G-500', 'GM-400')} .n { font: 400 12px ${MONO}; fill: ${C.dim}; } .t { font: 500 22px ${SANS}; letter-spacing: -0.5px; fill: ${C.ink}; } .h { font: 400 12px ${MONO}; fill: ${C.dim}; }</style>
  <rect x="2" y="42" width="10" height="10" rx="2" fill="${C.accent}"/>
  <text x="24" y="52" class="n">${esc(n)}</text>
  <text x="54" y="54" class="t">${esc(title)}</text>
  <line x1="${76 + title.length * 11.5}" y1="47.5" x2="${W - 18 - hint.length * 7.2 - 18}" y2="47.5" stroke="${C.edge}"/>
  <text x="${W - 2}" y="52" text-anchor="end" class="h">${esc(hint)}</text>`,
  )
}

// ── about: a terminal, and Ral ──────────────────────────────────────────────

async function about() {
  const H = 400
  const ral = (await readFile('assets/src/ral-wave.webp')).toString('base64')
  const lines = [
    ['p', 'cat about.txt'],
    ['i', "I'm Aryan. I build products end to end —"],
    ['i', 'the app, the site, the backend, the store'],
    ['i', 'listing, and the film that launches it.'],
    ['b', ''],
    ['m', 'Right now that is Rally: score a match, your'],
    ['m', 'opponent confirms it, one rating per sport moves.'],
    ['b', ''],
    ['c', '# usually shipping. occasionally sleeping.'],
  ]
  let y = 96
  const body = lines
    .map(([k, s]) => {
      const out =
        k === 'p'
          ? `<text x="32" y="${y}" class="mono"><tspan fill="${C.accent}">aryan@arykv</tspan><tspan fill="${C.dim}">:~$ </tspan>${esc(s)}</text>`
          : k === 'b'
            ? ''
            : `<text x="32" y="${y}" class="mono ${k}">${esc(s)}</text>`
      y += k === 'p' ? 36 : 26
      return out
    })
    .join('\n  ')
  const promptY = y + 10
  const court = [0, 1, 2, 3, 4].map((i) => `<line x1="792" y1="${70.5 + i * 56}" x2="${W}" y2="${70.5 + i * 56}" stroke="${C.rule}"/>`).join('')
  return svg(
    W,
    H,
    "About Aryan: builds products end to end; currently Rally. With Ral, Rally's mascot, waving.",
    `  <style>
    ${fonts('GM-400', 'GM-500')}
    .mono { font: 400 15px ${MONO}; fill: ${C.ink}; }
    .m { fill: ${C.mute}; } .c { fill: ${C.dim}; }
    .bar { font: 400 12px ${MONO}; fill: ${C.dim}; }
    .cap { font: 400 11px ${MONO}; letter-spacing: 1.2px; fill: ${C.dim}; }
    .bob { transform-box: fill-box; transform-origin: bottom; animation: bob 2.8s ease-in-out infinite; } @keyframes bob { 50% { transform: translateY(-6px) } }
    ${PING}
    @media (prefers-reduced-motion: reduce) { .bob { animation: none } }
  </style>
  ${card(0, 0, 772, H)}
  <line x1="1" y1="44.5" x2="771" y2="44.5" stroke="${C.edge}"/>
  <circle cx="26" cy="22" r="5" fill="#2A2A2E"/><circle cx="44" cy="22" r="5" fill="#2A2A2E"/><circle cx="62" cy="22" r="5" fill="#2A2A2E"/>
  <text x="386" y="26" text-anchor="middle" class="bar">aryan@arykv — zsh</text>
  ${body}
  <text x="32" y="${promptY}" class="mono"><tspan fill="${C.accent}">aryan@arykv</tspan><tspan fill="${C.dim}">:~$</tspan></text>
  <rect x="${32 + 15 * 0.6 * 15 + 4}" y="${promptY - 14}" width="9" height="18" fill="${C.ink}" class="blink"/>
  <clipPath id="art"><rect x="792" y="0" width="408" height="${H}" rx="14"/></clipPath>
  ${card(792, 0, 408, H)}
  <g clip-path="url(#art)">${court}<line x1="996.5" y1="0" x2="996.5" y2="326" stroke="${C.rule}"/></g>
  <line x1="793" y1="326.5" x2="${W - 1}" y2="326.5" stroke="${C.edge}"/>
  <ellipse cx="996" cy="328" rx="74" ry="7" fill="#000" opacity=".6"/>
  <image class="bob" x="866" y="74" width="260" height="256" href="data:image/webp;base64,${ral}" xlink:href="data:image/webp;base64,${ral}"/>
  <text x="816" y="368" class="cap">RAL · RALLY'S MASCOT</text>
  <text x="${W - 24}" y="368" text-anchor="end" class="cap">SAYS HI</text>`,
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

function projectCard(art, title, kind, line, label) {
  const CW = 594
  const H = 440
  return svg(
    CW,
    H,
    label,
    `  <style>
    ${fonts('G-400', 'G-600', 'GM-500')}
    .word { font: 600 72px ${SANS}; letter-spacing: -3px; fill: #F5F2EC; }
    .tag { font: 400 17px ${SANS}; fill: #A8A49C; }
    .url { font: 500 11px ${MONO}; letter-spacing: 1.6px; fill: #6E6A63; }
    .t { font: 600 22px ${SANS}; letter-spacing: -0.6px; fill: ${C.ink}; }
    .kind { font: 500 11px ${MONO}; letter-spacing: 1.4px; fill: ${C.mute}; }
    .l { font: 400 15px ${SANS}; fill: ${C.mute}; }
    .bob { transform-box: fill-box; transform-origin: bottom; animation: bob 2.8s ease-in-out infinite; } @keyframes bob { 50% { transform: translateY(-6px) } }
    @media (prefers-reduced-motion: reduce) { .bob { animation: none } }
  </style>
  ${card(0, 0, CW, H)}
  <clipPath id="c"><rect x="10" y="10" width="${CW - 20}" height="310" rx="9"/></clipPath>
  <g clip-path="url(#c)">${art}</g>
  <rect x="10.5" y="10.5" width="${CW - 21}" height="309" rx="8.5" fill="none" stroke="${C.edge}"/>
  <text x="26" y="370" class="t">${esc(title)}</text>
  <text x="${CW - 26}" y="368" text-anchor="end" class="kind">${esc(kind)}  ↗</text>
  <text x="26" y="402" class="l">${esc(line)}</text>`,
  )
}

async function rallyCard() {
  const ral = (await readFile('assets/src/ral-court.webp')).toString('base64')
  const lines = [70, 130, 190, 250].map((y) => `<line x1="10" y1="${y + 0.5}" x2="584" y2="${y + 0.5}" stroke="#16171A"/>`).join('')
  const art = `<rect x="10" y="10" width="574" height="310" fill="#0A0B0D"/>${lines}
    <line x1="54.5" y1="10" x2="54.5" y2="320" stroke="#16171A"/>
    <line x1="10" y1="272.5" x2="584" y2="272.5" stroke="#2A2B2F"/>
    <rect x="54" y="68" width="44" height="3" fill="${C.accent}"/>
    <text x="50" y="172" class="word">Rally</text>
    <rect x="217" y="155" width="14" height="14" fill="${C.accent}"/>
    <text x="54" y="208" class="tag">Take your sport seriously.</text>
    <text x="54" y="300" class="url">PLAYRALLY.APP</text>
    <ellipse cx="448" cy="274" rx="76" ry="7" fill="#000" opacity=".55"/>
    <image class="bob" x="328" y="44" width="240" height="232" href="data:image/webp;base64,${ral}" xlink:href="data:image/webp;base64,${ral}"/>`
  return projectCard(art, 'Rally', 'IOS · ANDROID', 'Ratings for the people you actually play with.', 'Rally — ratings for the people you actually play with')
}

async function nighterCard() {
  const img = (await readFile('assets/src/allnighter.jpg')).toString('base64')
  const art = `<image x="10" y="10" width="574" height="310" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${img}" xlink:href="data:image/jpeg;base64,${img}"/>`
  return projectCard(art, 'All Nighter', 'WEB', 'The night before the paper, planned honestly.', 'All Nighter — the night before the paper, planned honestly')
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
const fmt = (n) => n.toLocaleString('en-US')

const langBytes = new Map()
for (const repo of repositories.nodes) for (const { size, node } of repo.languages.edges) langBytes.set(node.name, (langBytes.get(node.name) || 0) + size)
const langTotal = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1
const languages = [...langBytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([name, size]) => ({ name, pct: (size / langTotal) * 100 }))

function numbers() {
  const H = 230
  const big = (x, v, k) => `<text x="${x}" y="112" class="big">${esc(v)}</text><text x="${x}" y="140" class="k">${esc(k)}</text>`
  const ring = (cx, cy, r, frac) => {
    const len = 2 * Math.PI * r
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.empty}" stroke-width="6"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.accent}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(len * Math.min(1, frac)).toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`
  }
  const bars = languages
    .map((l, i) => {
      const y = 74 + i * 32
      return `<text x="826" y="${y}" class="lang">${esc(l.name)}</text><text x="1174" y="${y}" text-anchor="end" class="k">${l.pct.toFixed(1)}%</text><rect x="826" y="${y + 11}" width="348" height="3" rx="1.5" fill="${C.empty}"/><rect x="826" y="${y + 11}" width="${Math.max(3, (348 * l.pct) / 100).toFixed(1)}" height="3" rx="1.5" fill="${i === 0 ? C.accent : C.mute}"/>`
    })
    .join('')
  return svg(
    W,
    H,
    `${fmt(calendar.totalContributions)} contributions in the last year, ${activeDays} active days, ${current}-day current streak, ${longest}-day longest streak`,
    `  <style>
    ${fonts('G-500', 'G-600', 'GM-400')}
    .big { font: 600 44px ${SANS}; letter-spacing: -1.6px; fill: ${C.ink}; }
    .k { font: 400 12px ${MONO}; fill: ${C.mute}; }
    .cap { font: 400 11px ${MONO}; letter-spacing: 1.2px; fill: ${C.dim}; }
    .lang { font: 500 14px ${SANS}; fill: ${C.ink}; }
    .ringv { font: 600 26px ${SANS}; letter-spacing: -0.8px; fill: ${C.ink}; }
  </style>
  ${card(0, 0, 790, H)}
  <text x="32" y="44" class="cap">THE LAST 12 MONTHS</text>
  ${big(32, fmt(calendar.totalContributions), 'contributions')}
  ${big(232, `${current}d`, 'current streak')}
  ${big(412, `${longest}d`, 'longest streak')}
  ${ring(690, 100, 50, activeDays / 365)}
  <text x="690" y="109" text-anchor="middle" class="ringv">${activeDays}</text>
  <text x="690" y="180" text-anchor="middle" class="k">days with commits</text>
  <line x1="32" y1="176.5" x2="580" y2="176.5" stroke="${C.edge}"/>
  <text x="32" y="204" class="cap">EVERY COMMIT GITHUB CAN SEE · UPDATED DAILY</text>
  ${card(802, 0, 398, H)}
  <text x="826" y="44" class="cap">LANGUAGES</text>
  ${bars}`,
  )
}

// ── months, drawn as columns of cells ───────────────────────────────────────

function months() {
  const H = 300
  const byMonth = new Map()
  for (const d of days) {
    const k = d.date.slice(0, 7)
    byMonth.set(k, (byMonth.get(k) || 0) + d.contributionCount)
  }
  const keys = [...byMonth.keys()].slice(-12)
  const peak = Math.max(1, ...keys.map((k) => byMonth.get(k)))
  const ROWS = 9
  const CELL = 14
  const GAP = 4
  const colW = 3 * CELL + 2 * GAP
  const span = (W - 64 - colW) / 11
  const cols = keys
    .map((k, i) => {
      const v = byMonth.get(k)
      const lit = v === 0 ? 0 : Math.max(1, Math.round((v / peak) * ROWS))
      const x0 = 32 + i * span
      let cells = ''
      for (let row = 0; row < ROWS; row++) {
        for (let c = 0; c < 3; c++) {
          const on = ROWS - row <= lit
          const shade = on ? C.levels[row === ROWS - lit ? 3 : 4] : C.empty
          cells += `<rect x="${(x0 + c * (CELL + GAP)).toFixed(1)}" y="${56 + row * (CELL + GAP)}" width="${CELL}" height="${CELL}" rx="3" fill="${shade}"/>`
        }
      }
      const label = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][Number(k.slice(5, 7)) - 1]
      return `${cells}<text x="${(x0 + colW / 2).toFixed(1)}" y="${56 + ROWS * (CELL + GAP) + 22}" text-anchor="middle" class="mo">${label}</text><text x="${(x0 + colW / 2).toFixed(1)}" y="${56 + ROWS * (CELL + GAP) + 40}" text-anchor="middle" class="v">${v ? fmt(v) : '·'}</text>`
    })
    .join('\n  ')
  return svg(
    W,
    H,
    `Contributions by month for the last 12 months, peaking at ${fmt(peak)}`,
    `  <style>${fonts('GM-400')} .cap { font: 400 11px ${MONO}; letter-spacing: 1.2px; fill: ${C.dim}; } .mo { font: 400 11px ${MONO}; letter-spacing: 1px; fill: ${C.mute}; } .v { font: 400 11px ${MONO}; fill: ${C.dim}; }</style>
  ${card(0, 0, W, H)}
  <text x="32" y="36" class="cap">BY MONTH</text>
  <text x="${W - 32}" y="36" text-anchor="end" class="cap">ONE COLUMN PER MONTH · TALLER IS MORE</text>
  ${cols}`,
  )
}

// ── footer ──────────────────────────────────────────────────────────────────

function footer() {
  const H = 120
  const r = rng(11)
  let cells = ''
  for (let x = 0; x < COLS; x++) {
    const v = r()
    const fade = 1 - Math.abs(x - COLS / 2) / (COLS / 2)
    const lvl = v < fade * 0.5 ? (v < fade * 0.2 ? 4 : 3) : v < 0.15 ? 1 : 0
    cells += `<rect x="${(W - COLS * 20 + 4) / 2 + x * 20}" y="24" width="16" height="16" rx="3.5" fill="${C.levels[lvl]}"/>`
  }
  return svg(
    W,
    H,
    'Thanks for stopping by.',
    `  <style>${fonts('GM-400')} .f { font: 400 12px ${MONO}; letter-spacing: 1px; fill: ${C.dim}; }</style>
  ${cells}
  <text x="${W / 2}" y="86" text-anchor="middle" class="f">thanks for stopping by · this page rebuilds itself every morning</text>`,
  )
}

// ── write ───────────────────────────────────────────────────────────────────

await mkdir('assets', { recursive: true })
await mkdir('docs', { recursive: true })
const out = {
  'hero.svg': hero(),
  'link-rally.svg': chip('playrally.app', 'square'),
  'link-nighter.svg': chip('allnighter.in', 'moon'),
  'link-snake.svg': chip('play snake', 'grid'),
  'h-about.svg': header('01', 'About', 'cat about.txt'),
  'h-stack.svg': header('02', 'Stack', 'what it is built with'),
  'h-work.svg': header('03', 'Work', 'shipped, and still shipping'),
  'h-numbers.svg': header('04', 'Numbers', 'live from the GitHub API'),
  'h-snake.svg': header('05', 'Snake', 'it eats the graph. you can play it.'),
  'about.svg': await about(),
  'stack.svg': await stack(),
  'rally.svg': await rallyCard(),
  'nighter.svg': await nighterCard(),
  'numbers.svg': numbers(),
  'months.svg': months(),
  'footer.svg': footer(),
}
for (const [f, s] of Object.entries(out)) await writeFile(`assets/${f}`, s)

// The game board: one column per week, one row per weekday, each cell 0–4
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

console.log(`${Object.keys(out).length} images; ${fmt(calendar.totalContributions)} contributions; streak ${current}/${longest}`)
