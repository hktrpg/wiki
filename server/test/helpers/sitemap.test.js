/**
 * @jest-environment node
 */

describe('helpers/sitemap', () => {
  let sitemapHelper
  let cacheStore

  beforeEach(() => {
    jest.resetModules()
    cacheStore = {}
    global.WIKI = {
      config: {
        host: 'https://wiki.example.com/',
        lang: {
          code: 'en',
          namespacing: false
        },
        seo: {
          robots: ['index', 'follow'],
          description: 'Site description'
        }
      },
      cache: {
        get: jest.fn(async (key) => cacheStore[key]),
        set: jest.fn(async (key, val) => { cacheStore[key] = val }),
        del: jest.fn((key) => { delete cacheStore[key] })
      },
      models: {
        pages: {
          query: jest.fn()
        }
      }
    }
    sitemapHelper = require('../../helpers/sitemap')
  })

  afterEach(() => {
    delete global.WIKI
  })

  it('buildPageUrl omits default locale without namespacing', () => {
    expect(sitemapHelper.buildPageUrl({ localeCode: 'en', path: 'home' }))
      .toBe('https://wiki.example.com/home')
  })

  it('buildPageUrl includes locale when namespacing is enabled', () => {
    WIKI.config.lang.namespacing = true
    expect(sitemapHelper.buildPageUrl({ localeCode: 'en', path: 'rules/intro' }))
      .toBe('https://wiki.example.com/en/rules/intro')
  })

  it('buildPageUrl includes non-default locale even without namespacing', () => {
    expect(sitemapHelper.buildPageUrl({ localeCode: 'zh', path: 'home' }))
      .toBe('https://wiki.example.com/zh/home')
  })

  it('generateXml includes published public pages and skips cache miss write', async () => {
    const orderBy = jest.fn().mockResolvedValue([
      { localeCode: 'en', path: 'home', updatedAt: '2026-01-01T00:00:00.000Z' },
      { localeCode: 'en', path: 'secret', updatedAt: '2026-01-02T00:00:00.000Z' }
    ])
    const where = jest.fn().mockReturnValue({ orderBy })
    const column = jest.fn().mockReturnValue({ where })
    WIKI.models.pages.query.mockReturnValue({ column })

    const xml = await sitemapHelper.generateXml()
    expect(where).toHaveBeenCalledWith({ isPrivate: false, isPublished: true })
    expect(xml).toContain('<loc>https://wiki.example.com/home</loc>')
    expect(xml).toContain('<loc>https://wiki.example.com/secret</loc>')
    expect(xml).toContain('<priority>1.0</priority>')
    expect(WIKI.cache.set).toHaveBeenCalled()
  })

  it('generateXml returns empty urlset when site is noindex', async () => {
    WIKI.config.seo.robots = ['noindex', 'nofollow']
    const xml = await sitemapHelper.generateXml()
    expect(xml).toContain('<urlset')
    expect(xml).not.toContain('<loc>')
    expect(WIKI.models.pages.query).not.toHaveBeenCalled()
  })

  it('generateXml uses cache when present', async () => {
    cacheStore['sitemap:xml'] = 'CACHED'
    const xml = await sitemapHelper.generateXml()
    expect(xml).toBe('CACHED')
    expect(WIKI.models.pages.query).not.toHaveBeenCalled()
  })

  it('invalidate clears cache key', () => {
    cacheStore['sitemap:xml'] = 'CACHED'
    sitemapHelper.invalidate()
    expect(WIKI.cache.del).toHaveBeenCalledWith('sitemap:xml')
    expect(cacheStore['sitemap:xml']).toBeUndefined()
  })
})

describe('helpers/seo', () => {
  let seoHelper

  beforeEach(() => {
    jest.resetModules()
    global.WIKI = {
      config: {
        host: 'https://wiki.example.com',
        title: 'Example Wiki',
        logoUrl: '/_assets/svg/logo.svg',
        lang: { code: 'en' },
        seo: {
          description: 'Fallback site description',
          robots: ['index', 'follow']
        }
      }
    }
    seoHelper = require('../../helpers/seo')
  })

  afterEach(() => {
    delete global.WIKI
  })

  it('applyPageMeta falls back to site description and absolute logo', () => {
    const res = { locals: { pageMeta: {} } }
    seoHelper.applyPageMeta(res, { title: 'Hello' })
    expect(res.locals.pageMeta.title).toBe('Hello')
    expect(res.locals.pageMeta.description).toBe('Fallback site description')
    expect(res.locals.pageMeta.image).toBe('https://wiki.example.com/_assets/svg/logo.svg')
    expect(res.locals.pageMeta.jsonLd).toBe('')
  })

  it('applyPageMeta can force noindex robots', () => {
    const res = { locals: { pageMeta: {} } }
    seoHelper.applyPageMeta(res, { title: 'Edit', robots: 'noindex, nofollow', schema: 'Article' })
    expect(res.locals.pageMeta.robots).toBe('noindex, nofollow')
    expect(res.locals.pageMeta.jsonLd).toBe('')
  })

  it('applyPageMeta builds WebSite + Article JSON-LD when schema is set', () => {
    const res = { locals: { pageMeta: { url: 'https://wiki.example.com/home' } } }
    seoHelper.applyPageMeta(res, {
      title: 'Home',
      description: 'Home page',
      schema: 'Article',
      dateModified: '2026-01-02T00:00:00.000Z',
      datePublished: '2026-01-01T00:00:00.000Z'
    })
    const data = JSON.parse(res.locals.pageMeta.jsonLd)
    expect(data['@context']).toBe('https://schema.org')
    expect(data['@graph'][0]['@type']).toBe('WebSite')
    expect(data['@graph'][0].name).toBe('Example Wiki')
    expect(data['@graph'][1]['@type']).toBe('Article')
    expect(data['@graph'][1].headline).toBe('Home')
    expect(data['@graph'][1].dateModified).toBe('2026-01-02T00:00:00.000Z')
  })
})
