const _ = require('lodash')
const ipHelper = require('./ip')

/* global WIKI */

/**
 * In-memory IP rate limiter for Guest (anonymous) writes.
 * Windows: per-minute + per-hour (configurable).
 */
const buckets = new Map()

const DEFAULTS = {
  commentsPerMinute: 5,
  commentsPerHour: 30,
  pageWritesPerMinute: 3,
  pageWritesPerHour: 15
}

function getConfig () {
  const sec = _.get(WIKI, 'config.security', {})
  return {
    commentsPerMinute: Math.max(0, _.toSafeInteger(_.get(sec, 'guestCommentsPerMinute', DEFAULTS.commentsPerMinute))),
    commentsPerHour: Math.max(0, _.toSafeInteger(_.get(sec, 'guestCommentsPerHour', DEFAULTS.commentsPerHour))),
    pageWritesPerMinute: Math.max(0, _.toSafeInteger(_.get(sec, 'guestPageWritesPerMinute', DEFAULTS.pageWritesPerMinute))),
    pageWritesPerHour: Math.max(0, _.toSafeInteger(_.get(sec, 'guestPageWritesPerHour', DEFAULTS.pageWritesPerHour)))
  }
}

function prune (timestamps, windowMs, now) {
  return timestamps.filter(t => (now - t) < windowMs)
}

function checkWindows (key, windows, now) {
  let entry = buckets.get(key) || { hits: [] }
  entry.hits = prune(entry.hits, Math.max(...windows.map(w => w.windowMs)), now)

  for (const win of windows) {
    if (win.max <= 0) {
      continue // 0 = disabled for this window
    }
    const count = entry.hits.filter(t => (now - t) < win.windowMs).length
    if (count >= win.max) {
      const oldestInWindow = entry.hits.filter(t => (now - t) < win.windowMs).sort((a, b) => a - b)[0]
      const retryAfterSec = Math.max(1, Math.ceil((win.windowMs - (now - oldestInWindow)) / 1000))
      const err = new WIKI.Error.GuestRateLimitExceeded()
      err.message = `Too many requests from this IP. Try again in ${retryAfterSec}s.`
      err.retryAfter = retryAfterSec
      throw err
    }
  }

  entry.hits.push(now)
  buckets.set(key, entry)
}

// Periodic cleanup to avoid unbounded memory growth
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  const maxWindow = 60 * 60 * 1000
  for (const [key, entry] of buckets.entries()) {
    entry.hits = prune(entry.hits, maxWindow, now)
    if (entry.hits.length === 0) {
      buckets.delete(key)
    }
  }
}, 5 * 60 * 1000)
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref()
}

module.exports = {
  DEFAULTS,

  /**
   * Enforce guest IP limits. No-op for authenticated non-guest users.
   * @param {Object} opts
   * @param {Object} opts.user
   * @param {string} opts.ip
   * @param {'comment'|'pageWrite'} opts.action
   */
  consume ({ user, ip, action }) {
    if (!user || user.id !== 2) {
      return
    }

    const normalizedIp = ipHelper.normalizeIp(ip) || 'unknown'
    const cfg = getConfig()
    const now = Date.now()

    if (action === 'comment') {
      checkWindows(`comment:${normalizedIp}`, [
        { windowMs: 60 * 1000, max: cfg.commentsPerMinute },
        { windowMs: 60 * 60 * 1000, max: cfg.commentsPerHour }
      ], now)
      return
    }

    if (action === 'pageWrite') {
      checkWindows(`pageWrite:${normalizedIp}`, [
        { windowMs: 60 * 1000, max: cfg.pageWritesPerMinute },
        { windowMs: 60 * 60 * 1000, max: cfg.pageWritesPerHour }
      ], now)
    }
  }
}
