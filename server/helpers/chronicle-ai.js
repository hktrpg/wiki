/**
 * Heuristic "AI Analysis" stub for Chronicle Event Drafts.
 * Produces structured draft suggestions from free text without an external LLM.
 * Replace/extend later with a real provider via aiMeta.provider.
 */

const HK_PLACES = [
  { names: ['中環', 'central'], lat: 22.2819, lng: 114.1556, tag: 'urban' },
  { names: ['旺角', 'mong kok', 'mongkok'], lat: 22.3193, lng: 114.1694, tag: 'urban' },
  { names: ['尖沙咀', 'tsim sha tsui', 'tst'], lat: 22.2976, lng: 114.1722, tag: 'urban' },
  { names: ['銅鑼灣', 'causeway bay'], lat: 22.2800, lng: 114.1850, tag: 'urban' },
  { names: ['灣仔', 'wan chai', 'wanchai'], lat: 22.2770, lng: 114.1733, tag: 'urban' },
  { names: ['油麻地', 'yau ma tei'], lat: 22.3120, lng: 114.1700, tag: 'urban' },
  { names: ['深水埗', 'sham shui po'], lat: 22.3307, lng: 114.1622, tag: 'urban' },
  { names: ['觀塘', 'kwun tong'], lat: 22.3120, lng: 114.2265, tag: 'urban' },
  { names: ['荃灣', 'tsuen wan'], lat: 22.3714, lng: 114.1139, tag: 'urban' },
  { names: ['沙田', 'sha tin', 'shatin'], lat: 22.3870, lng: 114.1910, tag: 'urban' },
  { names: ['大嶼山', 'lantau'], lat: 22.2669, lng: 113.9420, tag: 'outlying' },
  { names: ['長洲', 'cheung chau'], lat: 22.2092, lng: 114.0286, tag: 'outlying' },
  { names: ['西貢', 'sai kung'], lat: 22.3819, lng: 114.2733, tag: 'outlying' },
  { names: ['太平山', 'victoria peak', 'the peak'], lat: 22.2759, lng: 114.1455, tag: 'haunt' },
  { names: ['新娘潭', 'bride\'s pool', 'brides pool'], lat: 22.5040, lng: 114.2500, tag: 'haunt' },
  { names: ['南丫島', 'lamma'], lat: 22.2000, lng: 114.1350, tag: 'outlying' },
  { names: ['薄扶林', 'pok fu lam', 'pokfulam'], lat: 22.2600, lng: 114.1380, tag: 'haunt' },
  { names: ['衙前圍', 'nga tsin wai'], lat: 22.3350, lng: 114.1950, tag: 'haunt' },
  { names: ['香港', 'hong kong'], lat: 22.3193, lng: 114.1694, tag: 'urban' }
]

const HAUNT_KEYWORDS = ['鬼', '靈異', '凶宅', 'haunt', 'ghost', 'paranormal', '靈', '冤', '自殺', '命案']

function findPlace (text) {
  const lower = text.toLowerCase()
  for (const place of HK_PLACES) {
    for (const name of place.names) {
      if (lower.includes(name.toLowerCase()) || text.includes(name)) {
        return { ...place, matchedName: name }
      }
    }
  }
  return null
}

function findYear (text) {
  const m = text.match(/(?:公元)?\s*((?:1[6-9]|20)\d{2})\s*年?|(?:in\s+)?((?:1[6-9]|20)\d{2})\b/i)
  if (!m) {
    return { start: '', end: '', fuzzy: true }
  }
  const year = m[1] || m[2]
  return { start: year, end: year, fuzzy: /約|左右|大概|around|circa|~|～/.test(text) }
}

function looksHaunted (text) {
  const lower = text.toLowerCase()
  return HAUNT_KEYWORDS.some(k => lower.includes(k.toLowerCase()) || text.includes(k))
}

/**
 * Split free text into candidate event lines/paragraphs and suggest drafts.
 * @param {string} text
 * @param {object} [opts]
 * @returns {Array<object>} draft payloads (not yet persisted)
 */
function analyzeTextToDrafts (text, opts = {}) {
  const raw = String(text || '').trim()
  if (!raw) {
    return []
  }

  const chunks = raw
    .split(/\n+/)
    .map(s => s.trim())
    .filter(s => s.length >= 4)

  const drafts = []
  for (const chunk of chunks) {
    const place = findPlace(chunk)
    const year = findYear(chunk)
    const haunt = looksHaunted(chunk)
    if (!place && !haunt && !year.start) {
      continue
    }
    const lat = place ? place.lat : (opts.defaultLat != null ? opts.defaultLat : 22.3193)
    const lng = place ? place.lng : (opts.defaultLng != null ? opts.defaultLng : 114.1694)
    const tags = []
    if (haunt) { tags.push('haunt') }
    if (place && place.tag) { tags.push(place.tag) }

    let title = chunk
    if (title.length > 80) {
      title = title.slice(0, 77) + '…'
    }
    if (place) {
      title = `${place.matchedName} — ${title}`.slice(0, 120)
    }

    drafts.push({
      title,
      summary: chunk,
      occurrenceStart: year.start,
      occurrenceEnd: year.end,
      occurrenceFuzzy: year.fuzzy || !year.start,
      lat,
      lng,
      tags: [...new Set(tags)],
      aiMeta: {
        provider: 'heuristic-v1',
        matchedPlace: place ? place.matchedName : null,
        confidence: place && year.start ? 0.75 : (place || year.start ? 0.55 : 0.35),
        sourceExcerpt: chunk
      }
    })
  }
  return drafts
}

module.exports = {
  HK_PLACES,
  analyzeTextToDrafts,
  findPlace,
  findYear
}
