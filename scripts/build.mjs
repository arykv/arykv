// Draws every image on the profile, in a dark and a light version:
//   assets/hero-*.svg     name, one line, and the year's work as a single line
//   assets/rally-*.svg    project tiles, from the product's own share image
//   assets/nighter-*.svg  (assets/src/*.jpg)
// The hero is the only live part; it redraws daily in
// .github/workflows/profile.yml. Node 20+, no dependencies.

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
        contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } }
      }
    }`,
    variables: { login: LOGIN },
  }),
})
const body = await res.json()
if (body.errors) throw new Error(JSON.stringify(body.errors))

const weeks = body.data.user.contributionsCollection.contributionCalendar.weeks
const days = weeks.flatMap((w) => w.contributionDays)
const last = [...days].reverse().find((d) => d.contributionCount > 0)
const lastShipped = last
  ? new Date(`${last.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toLowerCase()
  : '—'

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"

const THEMES = {
  dark: { bg: '#0A0A0A', ink: '#F5F5F4', mute: '#8A8A86', faint: '#2A2A28', edge: '#1F1F1E', dot: '#3A3A38', accent: '#FF5B22' },
  light: { bg: '#FFFFFF', ink: '#0A0A0A', mute: '#6B6B67', faint: '#E7E5E1', edge: '#E7E5E1', dot: '#D6D3CD', accent: '#F04A10' },
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// The year as one smooth line: weekly totals, square-rooted so one huge week
// does not flatten the rest, blurred across neighbouring weeks, and joined
// with a Catmull-Rom curve.
function yearLine(x0, x1, yBase, height) {
  const sums = weeks.map((w) => w.contributionDays.reduce((a, d) => a + d.contributionCount, 0))
  const root = sums.map((v) => Math.sqrt(v))
  const kernel = [0.06, 0.24, 0.4, 0.24, 0.06]
  const scaled = root.map((_, i) => kernel.reduce((a, k, j) => a + k * (root[Math.min(root.length - 1, Math.max(0, i + j - 2))]), 0))
  const peak = Math.max(1, ...scaled)
  const pts = scaled.map((v, i) => [x0 + (i / (scaled.length - 1)) * (x1 - x0), yBase - (v / peak) * height])
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(yBase, p1[1] + (p2[1] - p0[1]) / 6)]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(yBase, p2[1] - (p3[1] - p1[1]) / 6)]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  const end = pts[pts.length - 1]
  return { d, area: `${d} L ${x1} ${yBase} L ${x0} ${yBase} Z`, end }
}

function hero(name, t) {
  const W = 1200
  const H = 460
  const line = yearLine(660, 1120, 330, 190)
  const meta = [
    ['now', 'rally'],
    ['before', 'all nighter'],
    ['last ship', lastShipped],
  ]
  const metaSvg = meta
    .map(([k, v], i) => `<text x="${72 + i * 190}" y="388" class="k">${esc(k)}</text><text x="${72 + i * 190}" y="410" class="v">${esc(v)}</text>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="aryan rao — product engineer. i ship the whole thing.">
  <defs>
    <pattern id="grid-${name}" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${t.dot}"/></pattern>
    <radialGradient id="fade-${name}" cx="78%" cy="45%" r="62%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
    <mask id="m-${name}"><rect width="${W}" height="${H}" fill="url(#fade-${name})"/></mask>
    <linearGradient id="stroke-${name}" x1="660" x2="1120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.ink}" stop-opacity=".15"/><stop offset=".7" stop-color="${t.ink}" stop-opacity=".7"/><stop offset="1" stop-color="${t.accent}"/></linearGradient>
    <linearGradient id="area-${name}" x1="0" x2="0" y1="140" y2="330" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.accent}" stop-opacity=".16"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>
    <clipPath id="card-${name}"><rect width="${W}" height="${H}" rx="20"/></clipPath>
  </defs>
  <style>
    .tag { font: 500 12px ${MONO}; letter-spacing: 2px; fill: ${t.mute}; }
    .name { font: 600 92px ${SANS}; letter-spacing: -2.6px; fill: ${t.ink}; }
    .line { font: 400 22px ${SANS}; letter-spacing: -0.3px; fill: ${t.mute}; }
    .k { font: 400 11.5px ${MONO}; letter-spacing: 1px; fill: ${t.mute}; }
    .v { font: 500 15px ${SANS}; fill: ${t.ink}; }
    .axis { font: 400 11px ${MONO}; letter-spacing: 1px; fill: ${t.mute}; }
    .ping { transform-box: fill-box; transform-origin: center; animation: ping 2.4s cubic-bezier(0, 0, .2, 1) infinite; }
    @keyframes ping { 0% { transform: scale(1); opacity: .8 } 80%, 100% { transform: scale(3.2); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .ping { animation: none } .ping { opacity: 0 } }
  </style>
  <g clip-path="url(#card-${name})">
    <rect width="${W}" height="${H}" fill="${t.bg}"/>
    <rect width="${W}" height="${H}" fill="url(#grid-${name})" mask="url(#m-${name})"/>
    <path d="${line.area}" fill="url(#area-${name})"/>
    <path d="${line.d}" fill="none" stroke="url(#stroke-${name})" stroke-width="2" stroke-linecap="round"/>
    <line x1="660" y1="330.5" x2="1120" y2="330.5" stroke="${t.faint}"/>
    <text x="660" y="352" class="axis">52 WEEKS AGO</text>
    <text x="1120" y="352" class="axis" text-anchor="end">TODAY</text>
    <circle cx="${line.end[0].toFixed(1)}" cy="${line.end[1].toFixed(1)}" r="4" fill="none" stroke="${t.accent}" class="ping"/>
    <circle cx="${line.end[0].toFixed(1)}" cy="${line.end[1].toFixed(1)}" r="4" fill="${t.accent}"/>
  </g>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="19.5" fill="none" stroke="${t.edge}"/>
  <circle cx="76" cy="80" r="4" fill="${t.accent}"/>
  <text x="90" y="84" class="tag">PRODUCT ENGINEER</text>
  <text x="66" y="210" class="name">aryan rao</text>
  <text x="72" y="256" class="line">i ship the whole thing.</text>
  <line x1="72" y1="340.5" x2="580" y2="340.5" stroke="${t.faint}"/>
  ${metaSvg}
</svg>
`
}

async function tile(file, title, kind, line, t) {
  const img = (await readFile(`assets/src/${file}`)).toString('base64')
  const W = 600
  const H = 410
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)} — ${esc(line)}">
  <defs><clipPath id="c"><rect x="0" y="0" width="${W}" height="315" rx="16"/></clipPath></defs>
  <style>
    .t { font: 600 22px ${SANS}; letter-spacing: -0.6px; fill: ${t.ink}; }
    .kind { font: 400 11.5px ${MONO}; letter-spacing: 1px; fill: ${t.mute}; }
    .l { font: 400 15px ${SANS}; fill: ${t.mute}; }
  </style>
  <image clip-path="url(#c)" width="${W}" height="315" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${img}" xlink:href="data:image/jpeg;base64,${img}"/>
  <rect x=".5" y=".5" width="${W - 1}" height="314" rx="15.5" fill="none" stroke="${t.edge}"/>
  <text x="2" y="358" class="t">${esc(title)}</text>
  <text x="${W - 2}" y="356" class="kind" text-anchor="end">${esc(kind.toUpperCase())}  ↗</text>
  <text x="2" y="388" class="l">${esc(line)}</text>
</svg>
`
}

await mkdir('assets', { recursive: true })
for (const [name, t] of Object.entries(THEMES)) {
  await writeFile(`assets/hero-${name}.svg`, hero(name, t))
  await writeFile(`assets/rally-${name}.svg`, await tile('rally.jpg', 'rally', 'ios · android', 'ratings for the people you actually play with.', t))
  await writeFile(`assets/nighter-${name}.svg`, await tile('allnighter.jpg', 'all nighter', 'web', 'the night before the paper, planned honestly.', t))
}
console.log(`last shipped ${lastShipped}`)
