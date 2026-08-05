/**
 * Chronicle map domain helpers — visibility + pin projection.
 */

function parseYear (value) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const n = Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

/**
 * Does Occurrence intersect an Era Map time range?
 * Empty bounds on either side mean "unbounded".
 */
function timeRangesIntersect (occurrenceStart, occurrenceEnd, mapStart, mapEnd) {
  const oStart = parseYear(occurrenceStart)
  const oEnd = parseYear(occurrenceEnd !== '' && occurrenceEnd != null ? occurrenceEnd : occurrenceStart)
  const mStart = parseYear(mapStart)
  const mEnd = parseYear(mapEnd)

  if (oStart == null && oEnd == null) {
    return true
  }
  const eventStart = oStart != null ? oStart : oEnd
  const eventEnd = oEnd != null ? oEnd : oStart

  if (mStart == null && mEnd == null) {
    return true
  }
  const eraStart = mStart != null ? mStart : Number.NEGATIVE_INFINITY
  const eraEnd = mEnd != null ? mEnd : Number.POSITIVE_INFINITY

  return eventStart <= eraEnd && eventEnd >= eraStart
}

/**
 * Resolve whether an Event is visible on an Era Map.
 * @param {object} opts
 * @param {string} opts.occurrenceStart
 * @param {string} opts.occurrenceEnd
 * @param {string} opts.mapTimeStart
 * @param {string} opts.mapTimeEnd
 * @param {'include'|'exclude'|null|undefined} opts.visibilityOverride
 */
function isEventVisibleOnEraMap (opts) {
  if (opts.visibilityOverride === 'include') {
    return true
  }
  if (opts.visibilityOverride === 'exclude') {
    return false
  }
  return timeRangesIntersect(
    opts.occurrenceStart,
    opts.occurrenceEnd,
    opts.mapTimeStart,
    opts.mapTimeEnd
  )
}

/**
 * Resolve display position for an Event on an Era Map.
 * Pin Override wins; otherwise Canonical Position (identity alignment)
 * or a simple bilinear estimate from control points when provided.
 */
function resolveEventPosition (opts) {
  const { event, eraMap, pinOverride } = opts

  if (pinOverride) {
    if (pinOverride.lat != null && pinOverride.lng != null) {
      return { lat: pinOverride.lat, lng: pinOverride.lng, source: 'override' }
    }
    if (pinOverride.mapX != null && pinOverride.mapY != null && eraMap.basemapConfig) {
      const bounds = eraMap.basemapConfig.bounds
      if (bounds && bounds.length === 2) {
        const [[south, west], [north, east]] = bounds
        return {
          lat: south + (north - south) * (1 - pinOverride.mapY),
          lng: west + (east - west) * pinOverride.mapX,
          source: 'override-xy'
        }
      }
    }
  }

  const alignment = eraMap.alignment || { type: 'identity' }
  if (!alignment.type || alignment.type === 'identity') {
    return { lat: event.lat, lng: event.lng, source: 'canonical' }
  }

  // Control-point alignment: if we have bounds on the image overlay in lat/lng
  // space already (post-warped), treat as identity for display.
  if (alignment.type === 'controlPoints' && eraMap.basemapConfig && eraMap.basemapConfig.bounds) {
    return { lat: event.lat, lng: event.lng, source: 'canonical-aligned' }
  }

  return { lat: event.lat, lng: event.lng, source: 'canonical' }
}

module.exports = {
  parseYear,
  timeRangesIntersect,
  isEventVisibleOnEraMap,
  resolveEventPosition
}
