const {
  timeRangesIntersect,
  isEventVisibleOnEraMap,
  resolveEventPosition
} = require('../../helpers/chronicle-map')

describe('chronicle-map helpers', () => {
  describe('timeRangesIntersect', () => {
    test('overlaps when event falls inside era', () => {
      expect(timeRangesIntersect('1920', '1925', '1900', '1950')).toBe(true)
    })

    test('no overlap when event is outside era', () => {
      expect(timeRangesIntersect('1980', '1985', '1900', '1950')).toBe(false)
    })

    test('point occurrence uses start as end', () => {
      expect(timeRangesIntersect('1941', '', '1939', '1945')).toBe(true)
    })

    test('unbounded era accepts any dated event', () => {
      expect(timeRangesIntersect('1800', '1801', '', '')).toBe(true)
    })
  })

  describe('isEventVisibleOnEraMap', () => {
    test('force include wins over non-overlap', () => {
      expect(isEventVisibleOnEraMap({
        occurrenceStart: '2000',
        occurrenceEnd: '2001',
        mapTimeStart: '1800',
        mapTimeEnd: '1850',
        visibilityOverride: 'include'
      })).toBe(true)
    })

    test('force exclude wins over overlap', () => {
      expect(isEventVisibleOnEraMap({
        occurrenceStart: '1920',
        occurrenceEnd: '1921',
        mapTimeStart: '1900',
        mapTimeEnd: '1950',
        visibilityOverride: 'exclude'
      })).toBe(false)
    })
  })

  describe('resolveEventPosition', () => {
    test('uses canonical position with identity alignment', () => {
      const pos = resolveEventPosition({
        event: { lat: 22.3, lng: 114.2 },
        eraMap: { alignment: { type: 'identity' } },
        pinOverride: null
      })
      expect(pos).toEqual({ lat: 22.3, lng: 114.2, source: 'canonical' })
    })

    test('pin override replaces projection', () => {
      const pos = resolveEventPosition({
        event: { lat: 22.3, lng: 114.2 },
        eraMap: { alignment: { type: 'identity' } },
        pinOverride: { lat: 22.4, lng: 114.1 }
      })
      expect(pos).toEqual({ lat: 22.4, lng: 114.1, source: 'override' })
    })
  })
})
