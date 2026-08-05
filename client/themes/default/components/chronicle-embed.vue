<template lang='pug'>
  chronicle-map(
    :initial-slug='slug'
    :initial-tags='tagList'
    :initial-era-map-id='eraMapIdNum'
    :embedded='true'
    :height='height || "420px"'
  )
</template>

<script>
export default {
  props: {
    slug: { type: String, required: true },
    tags: { type: String, default: '' },
    eraMapId: { type: [String, Number], default: null },
    height: { type: String, default: '420px' }
  },
  computed: {
    tagList () {
      if (!this.tags) { return [] }
      return String(this.tags).split(',').map(t => t.trim()).filter(Boolean)
    },
    eraMapIdNum () {
      if (this.eraMapId == null || this.eraMapId === '') { return null }
      const n = Number(this.eraMapId)
      return Number.isFinite(n) ? n : null
    }
  }
}
</script>
