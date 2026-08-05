<template lang='pug'>
  component(:is='embedded ? "div" : "v-app"', :dark='!embedded && $vuetify.theme.dark')
    nav-header(v-if='!embedded')
    .chronicle-map-view(:class='{ "chronicle-map-view--page": !embedded }')
      .chronicle-map-toolbar
        .chronicle-map-title {{ title }}
        v-select.chronicle-select(
          v-if='chronicleOptions.length'
          v-model='slug'
          :items='chronicleOptions'
          item-text='title'
          item-value='slug'
          dense
          outlined
          hide-details
          label='Chronicle'
          style='max-width: 280px;'
          @change='reload'
        )
        v-select.chronicle-select(
          v-if='eraMapOptions.length'
          v-model='eraMapId'
          :items='eraMapOptions'
          item-text='title'
          item-value='id'
          dense
          outlined
          hide-details
          label='Era Map'
          style='max-width: 240px;'
          @change='reload'
        )
        v-chip-group(v-if='tagOptions.length', column)
          v-chip(
            v-for='t in tagOptions'
            :key='t'
            filter
            :input-value='selectedTags.includes(t)'
            @click='toggleTag(t)'
          ) {{ t }}
      .chronicle-map-canvas(ref='mapEl')
      .chronicle-map-sidebar(v-if='selected')
        .subtitle-1 {{ selected.title }}
        .caption.grey--text {{ selected.occurrenceStart }}{{ selected.occurrenceEnd && selected.occurrenceEnd !== selected.occurrenceStart ? ' – ' + selected.occurrenceEnd : '' }}
        p.body-2.mt-2 {{ selected.summary }}
        .caption(v-if='selected.tags && selected.tags.length') Tags: {{ selected.tags.map(t => t.tag).join(', ') }}
        v-btn.mt-3(v-if='embedded', text, small, color='primary', :href='`/chronicle/${slug}`') Open full map
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const MAP_VIEW_QUERY = gql`
  query ($slug: String!, $eraMapId: Int, $tags: [String], $overlaySlugs: [String]) {
    chronicles {
      mapView(slug: $slug, eraMapId: $eraMapId, tags: $tags, overlaySlugs: $overlaySlugs) {
        chronicles {
          id
          slug
          title
          tags { tag }
          eraMaps {
            id
            title
            timeStart
            timeEnd
            basemapSource
            basemapConfig
            alignment
            status
          }
        }
        activeEraMap {
          id
          title
          basemapSource
          basemapConfig
          alignment
        }
        pins {
          id
          title
          summary
          occurrenceStart
          occurrenceEnd
          displayLat
          displayLng
          lat
          lng
          tags { tag }
          status
        }
      }
    }
  }
`

const LIST_QUERY = gql`
  query {
    chronicles {
      list {
        id
        slug
        title
      }
    }
  }
`

let leafletPromise = null

function loadLeaflet () {
  if (window.L) {
    return Promise.resolve(window.L)
  }
  if (leafletPromise) {
    return leafletPromise
  }
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.head.appendChild(script)
  })
  return leafletPromise
}

export default {
  props: {
    initialSlug: { type: String, default: '' },
    initialTags: { type: Array, default: () => [] },
    initialEraMapId: { type: Number, default: null },
    overlaySlugs: { type: Array, default: () => [] },
    embedded: { type: Boolean, default: false },
    height: { type: String, default: '70vh' }
  },
  data () {
    return {
      slug: this.initialSlug || '',
      eraMapId: this.initialEraMapId,
      selectedTags: [...(this.initialTags || [])],
      chronicleOptions: [],
      eraMapOptions: [],
      tagOptions: [],
      title: 'Chronicle Map',
      pins: [],
      selected: null,
      map: null,
      layerGroup: null,
      tileLayer: null
    }
  },
  methods: {
    toggleTag (t) {
      if (this.selectedTags.includes(t)) {
        this.selectedTags = this.selectedTags.filter(x => x !== t)
      } else {
        this.selectedTags = [...this.selectedTags, t]
      }
      this.reload()
    },
    async ensureSlug () {
      if (this.slug) { return }
      const resp = await this.$apollo.query({
        query: LIST_QUERY,
        fetchPolicy: 'network-only'
      })
      this.chronicleOptions = _.get(resp, 'data.chronicles.list', [])
      if (this.chronicleOptions.length) {
        this.slug = this.chronicleOptions[0].slug
      }
    },
    async reload () {
      await this.ensureSlug()
      if (!this.slug) { return }
      const resp = await this.$apollo.query({
        query: MAP_VIEW_QUERY,
        fetchPolicy: 'network-only',
        variables: {
          slug: this.slug,
          eraMapId: this.eraMapId || undefined,
          tags: this.selectedTags.length ? this.selectedTags : undefined,
          overlaySlugs: this.overlaySlugs.length ? this.overlaySlugs : undefined
        }
      })
      const view = _.get(resp, 'data.chronicles.mapView')
      if (!view) { return }
      const primary = (view.chronicles || [])[0]
      this.title = primary ? primary.title : 'Chronicle Map'
      if (!this.chronicleOptions.length) {
        this.chronicleOptions = (view.chronicles || []).map(c => ({ slug: c.slug, title: c.title }))
      }
      this.eraMapOptions = primary ? (primary.eraMaps || []).filter(e => e.status === 'live' || !e.status) : []
      this.tagOptions = primary ? (primary.tags || []).map(t => t.tag) : []
      if (!this.eraMapId && view.activeEraMap) {
        this.eraMapId = view.activeEraMap.id
      }
      this.pins = view.pins || []
      await this.renderMap(view.activeEraMap)
    },
    async renderMap (eraMap) {
      const L = await loadLeaflet()
      if (!this.map) {
        this.map = L.map(this.$refs.mapEl, { scrollWheelZoom: !this.embedded })
        this.layerGroup = L.layerGroup().addTo(this.map)
      }
      if (this.tileLayer) {
        this.map.removeLayer(this.tileLayer)
        this.tileLayer = null
      }
      this.layerGroup.clearLayers()

      let config = {}
      try {
        config = eraMap && eraMap.basemapConfig ? JSON.parse(eraMap.basemapConfig) : {}
      } catch (e) {
        config = {}
      }

      if (eraMap && eraMap.basemapSource === 'uploaded' && config.imageUrl && config.bounds) {
        this.tileLayer = L.imageOverlay(config.imageUrl, config.bounds).addTo(this.map)
        this.map.fitBounds(config.bounds)
      } else {
        const url = config.url || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        this.tileLayer = L.tileLayer(url, {
          attribution: config.attribution || '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(this.map)
        const center = config.center || [22.3193, 114.1694]
        const zoom = config.zoom || 11
        this.map.setView(center, zoom)
      }

      this.pins.forEach(pin => {
        const lat = pin.displayLat != null ? pin.displayLat : pin.lat
        const lng = pin.displayLng != null ? pin.displayLng : pin.lng
        if (lat == null || lng == null) { return }
        const marker = L.marker([lat, lng])
        marker.bindPopup(`<strong>${_.escape(pin.title)}</strong><br>${_.escape(pin.summary || '')}`)
        marker.on('click', () => { this.selected = pin })
        marker.addTo(this.layerGroup)
      })

      this.$nextTick(() => {
        if (this.map) {
          this.map.invalidateSize()
        }
      })
    }
  },
  async mounted () {
    this.$refs.mapEl.style.height = this.embedded ? (this.height || '420px') : this.height
    if (!this.slug && !this.embedded) {
      const parts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')
      // /chronicle or /chronicle/:slug
      if (parts[0] === 'chronicle' && parts[1]) {
        this.slug = decodeURIComponent(parts[1])
      }
    }
    await this.reload()
  },
  beforeDestroy () {
    if (this.map) {
      this.map.remove()
      this.map = null
    }
  }
}
</script>

<style scoped>
.chronicle-map-view {
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  min-height: 320px;
}
.chronicle-map-view--page {
  height: calc(100vh - 64px);
}
.chronicle-map-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255,255,255,0.92);
  border-bottom: 1px solid rgba(0,0,0,0.08);
  z-index: 500;
}
.chronicle-map-title {
  font-weight: 600;
  margin-right: 8px;
}
.chronicle-map-canvas {
  flex: 1;
  min-height: 320px;
  width: 100%;
  z-index: 1;
}
.chronicle-map-sidebar {
  position: absolute;
  right: 12px;
  top: 72px;
  width: 280px;
  max-width: calc(100% - 24px);
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  padding: 12px 14px;
  z-index: 600;
}
</style>
