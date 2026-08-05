module.exports = {
  async init($, config) {
    $('pre.chronicle-embed > code, code.chronicle-embed, pre > code.language-chronicle-embed').each((idx, elm) => {
      let raw = $(elm).text() || ''
      let slug = ''
      let tags = ''
      let eraMapId = ''
      let height = '420px'
      try {
        const parsed = JSON.parse(raw)
        slug = parsed.slug || ''
        tags = Array.isArray(parsed.tags) ? parsed.tags.join(',') : (parsed.tags || '')
        eraMapId = parsed.eraMapId != null ? String(parsed.eraMapId) : ''
        height = parsed.height || height
      } catch (err) {
        raw.split(/\n/).forEach(line => {
          const m = line.match(/^\s*([a-zA-Z]+)\s*:\s*(.+)\s*$/)
          if (!m) { return }
          const key = m[1].toLowerCase()
          const val = m[2].trim()
          if (key === 'slug') { slug = val }
          if (key === 'tags') { tags = val }
          if (key === 'eramapid' || key === 'era_map_id') { eraMapId = val }
          if (key === 'height') { height = val }
        })
      }
      if (!slug) { return }
      const attrs = [
        `slug="${slug.replace(/"/g, '&quot;')}"`,
        tags ? `tags="${String(tags).replace(/"/g, '&quot;')}"` : '',
        eraMapId ? `era-map-id="${eraMapId}"` : '',
        `height="${height.replace(/"/g, '&quot;')}"`
      ].filter(Boolean).join(' ')
      const parent = $(elm).closest('pre')
      const target = parent.length ? parent : $(elm)
      target.replaceWith(`<chronicle-embed ${attrs}></chronicle-embed>`)
    })
  }
}
