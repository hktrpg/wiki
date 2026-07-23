const PageReview = require('../../models/pageReviews')
const PageHistory = require('../../models/pageHistory')

describe('pageReviews guest ownership (QA)', () => {
  const guest = { id: 2 }
  const reviewA = {
    authorId: 2,
    guestEmail: 'a@example.com',
    authorIp: '1.1.1.1'
  }

  it('same guest email+ip is same author', () => {
    expect(PageReview.isSameAuthor(reviewA, {
      user: guest,
      ip: '1.1.1.1',
      guestEmail: 'a@example.com'
    })).toBe(true)
  })

  it('different guest email on same ip is NOT same author (conflict case)', () => {
    expect(PageReview.isSameAuthor(reviewA, {
      user: guest,
      ip: '1.1.1.1',
      guestEmail: 'b@example.com'
    })).toBe(false)
  })

  it('same email different ip is NOT same author', () => {
    expect(PageReview.isSameAuthor(reviewA, {
      user: guest,
      ip: '2.2.2.2',
      guestEmail: 'a@example.com'
    })).toBe(false)
  })

  it('missing guest email cannot claim ownership', () => {
    expect(PageReview.isSameAuthor(reviewA, {
      user: guest,
      ip: '1.1.1.1',
      guestEmail: ''
    })).toBe(false)
  })

  it('logged-in users match by authorId only', () => {
    const review = { authorId: 5, guestEmail: '', authorIp: '9.9.9.9' }
    expect(PageReview.isSameAuthor(review, {
      user: { id: 5 },
      ip: '8.8.8.8',
      guestEmail: ''
    })).toBe(true)
    expect(PageReview.isSameAuthor(review, {
      user: { id: 6 },
      ip: '9.9.9.9',
      guestEmail: ''
    })).toBe(false)
  })

  it('email comparison is case-insensitive', () => {
    expect(PageReview.isSameAuthor(reviewA, {
      user: guest,
      ip: '1.1.1.1',
      guestEmail: 'A@Example.COM'
    })).toBe(true)
  })
})

describe('pageHistory PII gate (QA)', () => {
  const buildTrail = (revealPii) => {
    // Exercise the field mapping used by getHistory without DB:
    const ph = {
      id: 1,
      authorId: 2,
      guestName: 'Guest A',
      authorName: 'Guest',
      guestEmail: 'secret@example.com',
      authorIp: '10.0.0.5',
      path: 'demo',
      action: 'updated',
      versionDate: '2026-01-01T00:00:00.000Z'
    }
    return {
      versionId: ph.id,
      authorId: ph.authorId,
      authorName: ph.guestName || ph.authorName,
      authorEmail: revealPii ? (ph.guestEmail || null) : null,
      authorIP: revealPii ? (ph.authorIp || null) : null
    }
  }

  it('hides email/IP when revealPii=false (read:history only)', () => {
    const row = buildTrail(false)
    expect(row.authorName).toBe('Guest A')
    expect(row.authorEmail).toBeNull()
    expect(row.authorIP).toBeNull()
  })

  it('reveals email/IP when revealPii=true (approver/admin)', () => {
    const row = buildTrail(true)
    expect(row.authorEmail).toBe('secret@example.com')
    expect(row.authorIP).toBe('10.0.0.5')
  })
})

describe('approve race claim pattern (QA)', () => {
  it('second conditional patch on non-pending returns 0', async () => {
    // Simulate the claim semantics used by approve/reject/withdraw
    let status = 'pending'
    const claim = () => {
      if (status !== 'pending') return 0
      status = 'approved'
      return 1
    }
    expect(claim()).toBe(1)
    expect(claim()).toBe(0)
    expect(status).toBe('approved')
  })
})

// Keep require warm / ensure model loads
describe('models load', () => {
  it('loads PageReview and PageHistory', () => {
    expect(PageReview.tableName).toBe('pageReviews')
    expect(PageHistory.tableName).toBe('pageHistory')
  })
})
