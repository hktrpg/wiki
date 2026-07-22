const _ = require('lodash')

/**
 * Normalize and mask IP addresses for public display.
 * IPv4 example: 111.111.111.123 -> 111.111.111.*
 */
module.exports = {
  normalizeIp (raw) {
    let ip = _.trim(_.toString(raw || ''))
    if (!ip) { return '' }
    // Strip IPv4-mapped IPv6 prefix
    if (_.startsWith(ip, '::ffff:')) {
      ip = ip.substring(7)
    }
    return ip.substring(0, 64)
  },

  maskIp (raw) {
    const ip = this.normalizeIp(raw)
    if (!ip) { return '' }

    const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/)
    if (v4) {
      return `${v4[1]}.*`
    }

    // IPv6: keep first 3 hextets, mask the rest
    if (ip.includes(':')) {
      const parts = ip.split(':').filter((p, idx, arr) => !(p === '' && arr[idx - 1] === ''))
      if (parts.length >= 3) {
        return `${parts.slice(0, 3).join(':')}:*`
      }
      return `${ip}*`
    }

    return ip
  },

  /**
   * Return full IP for privileged users, otherwise masked.
   */
  displayIp (raw, { revealFull = false } = {}) {
    return revealFull ? this.normalizeIp(raw) : this.maskIp(raw)
  }
}
