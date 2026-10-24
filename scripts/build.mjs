// Rebuilds the profile's live pieces from the GitHub API:
//   assets/pulse-dark.svg, assets/pulse-light.svg — a year of contributions as a card
//   README.md, between the ACTIVITY markers   — the latest public work
// Runs daily in .github/workflows/profile.yml. Node 20+, no dependencies.

import { readFile, writeFile } from 'node:fs/promises'

const LOGIN = process.env.PROFILE_LOGIN || 'arykv'
const TOKEN = process.env.GITHUB_TOKEN
if (!TOKEN) throw new Error('GITHUB_TOKEN is required')

const headers = { Authorization: `Bearer ${TOKEN}`, 'User-Agent': LOGIN }

async function graphql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json()
  if (body.errors) throw new Error(JSON.stringify(body.errors))
  return body.data
}

const { user } = await graphql(
  `query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
      repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
        nodes { languages(first: 6, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } }
      }
    }
  }`,
  { login: LOGIN },
)

const calendar = user.contributionsCollection.contributionCalendar
const days = calendar.weeks.flatMap((w) => w.contributionDays)

// Streaks. Today having no contributions yet does not break the current one.
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

// Languages across the repos this token can see, by bytes.
const bytes = new Map()
for (const repo of user.repositories.nodes) {
  for (const { size, node } of repo.languages.edges) bytes.set(node.name, (bytes.get(node.name) || 0) + size)
}
const totalBytes = [...bytes.values()].reduce((a, b) => a + b, 0) || 1
const languages = [...bytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 4)
  .map(([name, size]) => ({ name, pct: Math.round((size / totalBytes) * 100) }))

const THEMES = {
  dark: { bg: '#12110F', ink: '#F2EDE4', mute: '#8E8A82', faint: '#24221E', accent: '#C8F169', rule: '#2A2925' },
  light: { bg: '#FAF7F1', ink: '#16140F', mute: '#6B675F', faint: '#ECE6DA', accent: '#4F7A00', rule: '#E4DED2' },
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const fmt = (n) => n.toLocaleString('en-US')

function card(t) {
  const W = 880
  const H = 236
  const weeks = calendar.weeks.map((w) => w.contributionDays.reduce((a, d) => a + d.contributionCount, 0))
  const peak = Math.max(1, ...weeks)
  const barW = 784 / weeks.length
  const bars = weeks
    .map((v, i) => {
      const h = v === 0 ? 2 : 6 + (v / peak) * 62
      const fill = v === 0 ? t.faint : t.accent
      const op = v === 0 ? 1 : (0.35 + 0.65 * (v / peak)).toFixed(2)
      return `<rect x="${(48 + i * barW).toFixed(1)}" y="${(196 - h).toFixed(1)}" width="${Math.max(1, barW - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${fill}" fill-opacity="${op}"/>`
    })
    .join('')

  const stat = (x, value, label) =>
    `<text x="${x}" y="88" class="big">${esc(value)}</text><text x="${x}" y="110" class="label">${esc(label)}</text>`

  const langs = languages.map((l) => `${l.name} ${l.pct}%`).join('  ·  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${fmt(calendar.totalContributions)} contributions in the last year, ${current}-day current streak, ${longest}-day longest streak">
  <style>
    .tag { font: 500 12px ui-monospace, 'SF Mono', Menlo, Consolas, monospace; letter-spacing: 2.4px; fill: ${t.accent}; }
    .big { font: 400 40px 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif; letter-spacing: -1px; fill: ${t.ink}; }
    .label, .langs { font: 500 12px ui-monospace, 'SF Mono', Menlo, Consolas, monospace; fill: ${t.mute}; }
  </style>
  <rect width="${W}" height="${H}" rx="18" fill="${t.bg}"/>
  <text x="48" y="44" class="tag">THE LAST 52 WEEKS</text>
  ${stat(48, fmt(calendar.totalContributions), 'contributions')}
  ${stat(268, `${activeDays}`, 'days with work shipped')}
  ${stat(488, `${current}d`, 'current streak')}
  ${stat(668, `${longest}d`, 'longest streak')}
  ${bars}
  <line x1="48" y1="200" x2="832" y2="200" stroke="${t.rule}"/>
  <text x="48" y="222" class="langs">${esc(langs)}</text>
</svg>
`
}

await writeFile('assets/pulse-dark.svg', card(THEMES.dark))
await writeFile('assets/pulse-light.svg', card(THEMES.light))

// Latest public work, newest first, one line per repo-day.
const evRes = await fetch(`https://api.github.com/users/${LOGIN}/events/public?per_page=100`, { headers })
const events = evRes.ok ? await evRes.json() : []
const seen = new Set()
const lines = []
for (const e of events) {
  const day = e.created_at.slice(0, 10)
  const repo = e.repo.name
  let what = null
  if (e.type === 'PushEvent') what = `pushed ${e.payload.size || e.payload.distinct_size || ''} commit${(e.payload.size || 0) === 1 ? '' : 's'}`.replace(/\s+/g, ' ')
  else if (e.type === 'PullRequestEvent' && e.payload.action === 'opened') what = 'opened a pull request'
  else if (e.type === 'PullRequestEvent' && e.payload.pull_request?.merged) what = 'merged a pull request'
  else if (e.type === 'CreateEvent' && e.payload.ref_type === 'repository') what = 'started a new repo'
  else if (e.type === 'ReleaseEvent') what = `released ${e.payload.release?.tag_name || ''}`.trim()
  if (!what || repo === `${LOGIN}/${LOGIN}`) continue
  const key = `${repo}|${day}|${e.type}`
  if (seen.has(key)) continue
  seen.add(key)
  lines.push(`- \`${day}\` ${what} to [${repo.split('/')[1]}](https://github.com/${repo})`)
  if (lines.length === 5) break
}
const activity = lines.length ? lines.join('\n') : '_Most of the work lives in private repos — the graph above is the honest count._'

const readme = await readFile('README.md', 'utf8')
const next = readme.replace(
  /<!--ACTIVITY:START-->[\s\S]*?<!--ACTIVITY:END-->/,
  `<!--ACTIVITY:START-->\n${activity}\n<!--ACTIVITY:END-->`,
)
await writeFile('README.md', next)

console.log(`${calendar.totalContributions} contributions, streak ${current}/${longest}, ${lines.length} activity lines`)
