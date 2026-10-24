// Draws the profile card, assets/card-dark.svg and assets/card-light.svg.
// The only live value is the date of the last day with commits, so the card
// says when work last shipped without saying how much. Runs daily in
// .github/workflows/profile.yml. Node 20+, no dependencies.

import { mkdir, writeFile } from 'node:fs/promises'

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

const days = body.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays)
const last = [...days].reverse().find((d) => d.contributionCount > 0)
const lastShipped = last
  ? new Date(`${last.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).toLowerCase()
  : '—'

const ROWS = [
  ['now', 'rally — ratings for the people you actually play with'],
  ['before', 'all nighter — every ncert chapter, the night before'],
  ['stack', 'typescript, react native, next.js, supabase, swift'],
  ['last ship', lastShipped],
]

const THEMES = {
  dark: { ink: '#E6EDF3', mute: '#7D8590', rule: '#30363D', live: '#3FB950' },
  light: { ink: '#1F2328', mute: '#656D76', rule: '#D0D7DE', live: '#1A7F37' },
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function card(t) {
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif"
  const mono = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"
  const rows = ROWS.map(
    ([k, v], i) =>
      `<text x="0" y="${152 + i * 26}" class="k">${esc(k)}</text><text x="104" y="${152 + i * 26}" class="v">${esc(v)}</text>`,
  ).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="252" viewBox="0 0 720 252" role="img" aria-label="aryan rao. product engineer. now building rally.">
  <style>
    .name { font: 600 30px ${sans}; letter-spacing: -0.8px; fill: ${t.ink}; }
    .line { font: 400 15px ${sans}; fill: ${t.mute}; }
    .k { font: 400 12.5px ${mono}; fill: ${t.mute}; }
    .v { font: 400 12.5px ${mono}; fill: ${t.ink}; }
    .live { font: 400 12px ${mono}; fill: ${t.mute}; }
    .dot { fill: ${t.live}; }
    .ring { fill: none; stroke: ${t.live}; stroke-width: 1; transform-box: fill-box; transform-origin: center; animation: ping 2.4s cubic-bezier(0, 0, .2, 1) infinite; }
    @keyframes ping { 0% { transform: scale(1); opacity: .7 } 80%, 100% { transform: scale(2.6); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .ring { animation: none; opacity: 0 } }
  </style>
  <text x="0" y="44" class="name">aryan rao</text>
  <text x="0" y="74" class="line">product engineer. i ship the whole thing.</text>
  <circle cx="619" cy="36" r="3.5" class="ring"/>
  <circle cx="619" cy="36" r="3.5" class="dot"/>
  <text x="632" y="40" class="live">shipping</text>
  <line x1="0" y1="112" x2="720" y2="112" stroke="${t.rule}"/>
  ${rows}
</svg>
`
}

await mkdir('assets', { recursive: true })
await writeFile('assets/card-dark.svg', card(THEMES.dark))
await writeFile('assets/card-light.svg', card(THEMES.light))
console.log(`last shipped ${lastShipped}`)
