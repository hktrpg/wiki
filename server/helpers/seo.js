const _ = require('lodash')
const sitemapHelper = require('./sitemap')

/* global WIKI */

/**
 * Absolute image URL helper
 */
function toAbsoluteUrl (url) {
  let image = _.trim(url || '')
  if (!image) {
    return ''
  }
  if (!/^https?:\/\//i.test(image)) {
    const host = sitemapHelper.getHost()
    image = `${host}${image.startsWith('/') ? '' : '/'}${image}`
  }
  return image
}

/**
 * Build JSON-LD graph (WebSite + optional WebPage/Article)
 *
 * @param {Object} opts
 * @param {string} [opts.type] WebPage | Article
 * @param {string} [opts.title]
 * @param {string} [opts.description]
 * @param {string} [opts.url]
 * @param {string} [opts.image]
 * @param {string|Date} [opts.dateModified]
 * @param {string|Date} [opts.datePublished]
 * @returns {Object}
 */
function buildJsonLd (opts = {}) {
  const host = sitemapHelper.getHost()
  const siteName = WIKI.config.title || 'Wiki'
  const siteDescription = _.get(WIKI.config, 'seo.description', '') || WIKI.config.description || ''
  const lang = _.get(WIKI.config, 'lang.code', 'en')

  const graph = [{
    '@type': 'WebSite',
    '@id': `${host}/#website`,
    name: siteName,
    url: host,
    inLanguage: lang,
    description: siteDescription || undefined
  }]

  if (opts.type === 'Article' || opts.type === 'WebPage') {
    const pageUrl = opts.url || host
    const pageNode = {
      '@type': opts.type,
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: opts.title || undefined,
      description: opts.description || undefined,
      isPartOf: { '@id': `${host}/#website` },
      inLanguage: lang
    }
    if (opts.type === 'Article') {
      pageNode.headline = opts.title || undefined
    }
    if (opts.image) {
      pageNode.image = opts.image
      pageNode.primaryImageOfPage = opts.image
    }
    if (opts.dateModified) {
      pageNode.dateModified = new Date(opts.dateModified).toISOString()
    }
    if (opts.datePublished) {
      pageNode.datePublished = new Date(opts.datePublished).toISOString()
    }
    graph.push(pageNode)
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  }
}

/**
 * Safe JSON-LD string for embedding in <script>
 */
function stringifyJsonLd (obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

/**
 * Apply SEO fallbacks onto res.locals.pageMeta
 *
 * @param {Express.Response} res
 * @param {Object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.description]
 * @param {string} [opts.image]
 * @param {string} [opts.robots] Force robots meta (e.g. noindex, nofollow)
 * @param {string} [opts.schema] WebPage | Article — enables JSON-LD when indexable
 * @param {string|Date} [opts.dateModified]
 * @param {string|Date} [opts.datePublished]
 */
function applyPageMeta (res, opts = {}) {
  if (opts.title) {
    _.set(res.locals, 'pageMeta.title', opts.title)
  }

  const siteDescription = _.get(WIKI.config, 'seo.description', '') || WIKI.config.description || ''
  const description = _.trim(opts.description || '') || siteDescription
  _.set(res.locals, 'pageMeta.description', description)

  let image = _.trim(opts.image || _.get(res.locals, 'pageMeta.image', '') || '')
  if (!image) {
    image = WIKI.config.logoUrl || ''
  }
  image = toAbsoluteUrl(image)
  _.set(res.locals, 'pageMeta.image', image)

  if (opts.robots) {
    _.set(res.locals, 'pageMeta.robots', opts.robots)
  }

  // JSON-LD only for indexable public pages
  _.set(res.locals, 'pageMeta.jsonLd', '')
  const robots = opts.robots || _.get(res.locals, 'pageMeta.robots', '') || ''
  const isNoIndex = /\bnoindex\b/i.test(robots) ||
    _.includes(_.get(WIKI.config, 'seo.robots', []), 'noindex')
  if (opts.schema && !isNoIndex) {
    const jsonLd = buildJsonLd({
      type: opts.schema,
      title: _.get(res.locals, 'pageMeta.title'),
      description: _.get(res.locals, 'pageMeta.description'),
      image: _.get(res.locals, 'pageMeta.image'),
      url: _.get(res.locals, 'pageMeta.url'),
      dateModified: opts.dateModified,
      datePublished: opts.datePublished
    })
    _.set(res.locals, 'pageMeta.jsonLd', stringifyJsonLd(jsonLd))
  }
}

/**
 * Default site-wide robots meta string from config
 */
function getDefaultRobotsMeta () {
  const robots = _.get(WIKI.config, 'seo.robots', ['index', 'follow'])
  if (_.isArray(robots) && robots.length > 0) {
    return robots.join(', ')
  }
  return 'index, follow'
}

module.exports = {
  applyPageMeta,
  getDefaultRobotsMeta,
  buildJsonLd,
  stringifyJsonLd,
  toAbsoluteUrl
}
