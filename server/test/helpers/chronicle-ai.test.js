const { analyzeTextToDrafts, findPlace, findYear } = require('../../helpers/chronicle-ai')

describe('chronicle-ai heuristic analysis', () => {
  test('extracts HK place and year into a draft', () => {
    const drafts = analyzeTextToDrafts('1920年中環有靈異傳聞，行人夜半聽見腳步聲。')
    expect(drafts.length).toBe(1)
    expect(drafts[0].lat).toBeCloseTo(22.2819, 3)
    expect(drafts[0].occurrenceStart).toBe('1920')
    expect(drafts[0].tags).toEqual(expect.arrayContaining(['haunt', 'urban']))
    expect(drafts[0].aiMeta.provider).toBe('heuristic-v1')
  })

  test('skips unrelated short noise', () => {
    expect(analyzeTextToDrafts('hi\nok')).toEqual([])
  })

  test('findPlace matches english aliases', () => {
    const p = findPlace('A ghost story near Bride\'s Pool')
    expect(p.matchedName.toLowerCase()).toContain('bride')
  })

  test('findYear detects fuzzy markers', () => {
    const y = findYear('約 1985 年附近')
    expect(y.start).toBe('1985')
    expect(y.fuzzy).toBe(true)
  })
})
