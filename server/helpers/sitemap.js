const _ = require('lodash')

/* global WIKI */

const CACHE_KEY = 'sitemap:xml'
const CACHE_TTL = 3600

/**
 * Site host without trailing slash
 */
function getHost () {
  return _.trimEnd(WIKI.config.host || '', '/')
}

/**
 * Build public page URL matching Wiki.js routing / lang namespacing
 */
function buildPageUrl (page) {
  const host = getHost()
  const locale = page.localeCode
  const pagePath = page.path
  const namespacing = _.get(WIKI.config, 'lang.namespacing', false)
  const defaultLocale = _.get(WIKI.config, 'lang.code', 'en')
  if (namespacing || locale !== defaultLocale) {
    return `${host}/${locale}/${pagePath}`
  }
  return `${host}/${pagePath}`
}

function escapeXml (str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Invalidate cached sitemap XML
 */
function invalidate () {
  if (WIKI.cache) {
    WIKI.cache.del(CACHE_KEY)
  }
}

/**
 * Generate sitemap.xml for published public pages
 */
async function generateXml () {
  if (_.includes(_.get(WIKI.config, 'seo.robots', []), 'noindex')) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n'
  }

  const cached = await WIKI.cache.get(CACHE_KEY)
  if (cached) {
    return cached
  }

  const pages = await WIKI.models.pages.query()
    .column(['localeCode', 'path', 'updatedAt'])
    .where({
      isPrivate: false,
      isPublished: true
    })
    .orderBy(['localeCode', 'path'])

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  for (const page of pages) {
    const loc = buildPageUrl(page)
    const isHome = page.path === 'home'
    const lastmod = page.updatedAt ? new Date(page.updatedAt).toISOString() : ''
    xml += '  <url>\n'
    xml += `    <loc>${escapeXml(loc)}</loc>\n`
    if (lastmod) {
      xml += `    <lastmod>${lastmod}</lastmod>\n`
    }
    xml += `    <changefreq>${isHome ? 'daily' : 'weekly'}</changefreq>\n`
    xml += `    <priority>${isHome ? '1.0' : '0.5'}</priority>\n`
    xml += '  </url>\n'
  }

  xml += '</urlset>\n'
  await WIKI.cache.set(CACHE_KEY, xml, CACHE_TTL)
  return xml
}

module.exports = {
  CACHE_KEY,
  getHost,
  buildPageUrl,
  invalidate,
  generateXml
}
