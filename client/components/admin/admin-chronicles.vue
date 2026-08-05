<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Chronicles', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Chronicles
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Era maps, events, AI drafts
          v-spacer
          v-btn.mr-2.animated.fadeInDown(outlined, color='primary', href='/chronicle', target='_blank')
            v-icon(left) mdi-map
            span Open map
          v-btn.animated.fadeInDown(color='primary', dark, @click='openCreate')
            v-icon(left) mdi-plus
            span New Chronicle
        v-card.mt-3.animated.fadeInUp
          v-data-table(
            :items='chronicles'
            :headers='headers'
            :loading='loading'
            hide-default-footer
            :items-per-page='50'
          )
            template(slot='item', slot-scope='props')
              tr.is-clickable(@click='openEdit(props.item)')
                td {{ props.item.id }}
                td
                  .body-2: strong {{ props.item.title }}
                  .caption /chronicle/{{ props.item.slug }}
                td
                  v-chip(small, :color='props.item.isPublished ? `green` : `grey`', dark) {{ props.item.isPublished ? 'published' : 'draft' }}
                td {{ props.item.updatedAt | moment('calendar') }}
            template(slot='no-data')
              v-alert.ma-3(icon='mdi-map-outline', :value='true', outlined) No chronicles yet.

    //- Chronicle editor
    v-dialog(v-model='dialog', max-width='960', scrollable)
      v-card(v-if='form')
        v-card-title {{ form.id ? 'Edit Chronicle' : 'New Chronicle' }}
        v-divider
        v-card-text
          v-text-field(v-model='form.title', label='Title', outlined, dense)
          v-text-field(v-model='form.slug', label='Slug', outlined, dense, hint='Used in /chronicle/{slug}', persistent-hint)
          v-textarea(v-model='form.description', label='Description', outlined, dense, rows='2')
          v-switch(v-model='form.isPublished', label='Published', inset)
          template(v-if='form.id')
            v-tabs(v-model='tab')
              v-tab Era Maps
              v-tab Events
              v-tab AI / Text ingest
              v-tab-item.pt-3
                v-list(dense)
                  v-list-item(v-for='em in eraMaps', :key='em.id', @click='openEraMap(em)')
                    v-list-item-content
                      v-list-item-title {{ em.title }}
                      v-list-item-subtitle {{ em.timeStart || '…' }} → {{ em.timeEnd || '…' }} · {{ em.basemapSource }} · {{ em.mapMode }} · {{ em.status }}
                    v-list-item-action
                      v-btn(icon, small, @click.stop='deleteEraMap(em.id)')
                        v-icon mdi-delete-outline
                v-btn.mt-2(small, outlined, color='primary', @click='openEraMap(null)') Add Era Map
              v-tab-item.pt-3
                v-list(dense)
                  v-list-item(v-for='ev in events', :key='ev.id', @click='openEvent(ev)')
                    v-list-item-content
                      v-list-item-title {{ ev.title }}
                      v-list-item-subtitle {{ ev.occurrenceStart || '?' }} · {{ ev.lat }}, {{ ev.lng }} · {{ ev.status }}
                    v-list-item-action
                      v-btn(v-if='ev.status === `draft`', icon, small, color='green', @click.stop='approveDraft(ev.id)')
                        v-icon mdi-check
                      v-btn(icon, small, @click.stop='deleteEvent(ev.id)')
                        v-icon mdi-delete-outline
                v-btn.mt-2.mr-2(small, outlined, color='primary', @click='openEvent(null)') Add Event
                v-btn.mt-2(small, text, @click='addSampleEvent') Sample HK pin
              v-tab-item.pt-3
                .caption.grey--text.mb-2 Heuristic analysis (no external LLM). Parses places/years from text into Event Drafts.
                v-textarea(v-model='aiText', label='Paste notes / articles (one event per line)', outlined, rows='6')
                v-btn(color='primary', dark, :loading='acting', :disabled='!aiText', @click='runAnalyze') Analyze → Drafts
        v-divider
        v-card-actions
          v-btn(v-if='form.id', text, color='error', :loading='acting', @click='remove') Delete
          v-spacer
          v-btn(text, @click='dialog = false') Close
          v-btn(color='primary', dark, :loading='acting', @click='save') Save Chronicle

    //- Era Map editor
    v-dialog(v-model='eraDialog', max-width='720', scrollable)
      v-card(v-if='eraForm')
        v-card-title {{ eraForm.id ? 'Edit Era Map' : 'New Era Map' }}
        v-divider
        v-card-text
          v-text-field(v-model='eraForm.title', label='Title', outlined, dense)
          v-layout(row, wrap)
            v-flex(xs6, class='pr-2')
              v-text-field(v-model='eraForm.timeStart', label='Time start (year)', outlined, dense)
            v-flex(xs6, class='pl-2')
              v-text-field(v-model='eraForm.timeEnd', label='Time end (year)', outlined, dense)
          v-select(v-model='eraForm.mapMode', :items='mapModes', label='Map Mode', outlined, dense)
          v-select(v-model='eraForm.basemapSource', :items='basemapSources', label='Basemap Source', outlined, dense, @change='onBasemapSourceChange')
          v-select(v-model='eraForm.status', :items='["live", "draft"]', label='Status', outlined, dense)
          template(v-if='eraForm.basemapSource === "public"')
            v-text-field(v-model='eraForm.tileUrl', label='Tile URL template', outlined, dense)
            v-text-field(v-model='eraForm.centerLat', label='Center lat', outlined, dense, type='number', step='any')
            v-text-field(v-model='eraForm.centerLng', label='Center lng', outlined, dense, type='number', step='any')
            v-text-field(v-model='eraForm.zoom', label='Zoom', outlined, dense, type='number')
          template(v-else)
            v-text-field(v-model='eraForm.imageUrl', label='Image URL (uploaded / derived asset)', outlined, dense)
            v-text-field(v-model='eraForm.boundSouth', label='Bounds south', outlined, dense, type='number', step='any')
            v-text-field(v-model='eraForm.boundWest', label='Bounds west', outlined, dense, type='number', step='any')
            v-text-field(v-model='eraForm.boundNorth', label='Bounds north', outlined, dense, type='number', step='any')
            v-text-field(v-model='eraForm.boundEast', label='Bounds east', outlined, dense, type='number', step='any')
          v-select(v-model='eraForm.alignmentType', :items='alignmentTypes', label='Alignment', outlined, dense)
          v-textarea(
            v-if='eraForm.alignmentType === "controlPoints"'
            v-model='eraForm.alignmentJson'
            label='Alignment JSON (control points)'
            outlined
            dense
            rows='4'
            hint='{"type":"controlPoints","points":[{"canonical":{"lat":22.3,"lng":114.2},"map":{"x":0.5,"y":0.4}}]}'
            persistent-hint
          )
        v-divider
        v-card-actions
          v-spacer
          v-btn(text, @click='eraDialog = false') Cancel
          v-btn(color='primary', dark, :loading='acting', @click='saveEraMap') Save Era Map

    //- Event editor
    v-dialog(v-model='eventDialog', max-width='720', scrollable)
      v-card(v-if='eventForm')
        v-card-title {{ eventForm.id ? 'Edit Event' : 'New Event' }}
        v-divider
        v-card-text
          v-text-field(v-model='eventForm.title', label='Title', outlined, dense)
          v-textarea(v-model='eventForm.summary', label='Summary', outlined, dense, rows='3')
          v-layout(row, wrap)
            v-flex(xs6, class='pr-2')
              v-text-field(v-model='eventForm.occurrenceStart', label='Occurrence start', outlined, dense)
            v-flex(xs6, class='pl-2')
              v-text-field(v-model='eventForm.occurrenceEnd', label='Occurrence end', outlined, dense)
          v-switch(v-model='eventForm.occurrenceFuzzy', label='Fuzzy date', inset)
          v-layout(row, wrap)
            v-flex(xs6, class='pr-2')
              v-text-field(v-model.number='eventForm.lat', label='Canonical lat', outlined, dense, type='number', step='any')
            v-flex(xs6, class='pl-2')
              v-text-field(v-model.number='eventForm.lng', label='Canonical lng', outlined, dense, type='number', step='any')
          v-combobox(v-model='eventForm.tags', label='Chronicle Tags', multiple, chips, small-chips, outlined, dense, hint='haunt, urban, outlying…', persistent-hint)
          v-select(v-model='eventForm.status', :items='["live", "draft"]', label='Status', outlined, dense)
        v-divider
        v-card-actions
          v-spacer
          v-btn(text, @click='eventDialog = false') Cancel
          v-btn(color='primary', dark, :loading='acting', @click='saveEvent') Save Event
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const LIST_QUERY = gql`
  query ($includeUnpublished: Boolean) {
    chronicles {
      list(includeUnpublished: $includeUnpublished) {
        id slug title description isPublished updatedAt
      }
    }
  }
`

const SINGLE_QUERY = gql`
  query ($id: Int!) {
    chronicles {
      single(id: $id) {
        id slug title description isPublished
        eraMaps {
          id title timeStart timeEnd mapMode basemapSource basemapConfig alignment status sortIndex
        }
        events {
          id title summary occurrenceStart occurrenceEnd occurrenceFuzzy lat lng status
          tags { tag }
        }
      }
    }
  }
`

const DEFAULT_OSM = {
  provider: 'osm',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap contributors',
  center: [22.3193, 114.1694],
  zoom: 11
}

export default {
  data() {
    return {
      loading: false,
      acting: false,
      chronicles: [],
      dialog: false,
      form: null,
      tab: 0,
      eraMaps: [],
      events: [],
      aiText: '',
      eraDialog: false,
      eraForm: null,
      eventDialog: false,
      eventForm: null,
      mapModes: ['2d', '3d', 'both'],
      basemapSources: [
        { text: 'Public (tiles)', value: 'public' },
        { text: 'Uploaded', value: 'uploaded' },
        { text: 'Derived (AI/API)', value: 'derived' }
      ],
      alignmentTypes: [
        { text: 'Identity (lat/lng = map)', value: 'identity' },
        { text: 'Control points', value: 'controlPoints' }
      ],
      headers: [
        { text: 'ID', value: 'id', width: 80 },
        { text: 'Chronicle', value: 'title' },
        { text: 'Status', value: 'isPublished', width: 120 },
        { text: 'Updated', value: 'updatedAt', width: 160 }
      ]
    }
  },
  methods: {
    async refresh() {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
          query: LIST_QUERY,
          fetchPolicy: 'network-only',
          variables: { includeUnpublished: true }
        })
        this.chronicles = _.get(resp, 'data.chronicles.list', [])
      } catch (err) {
        this.notify(err.message, 'red')
      }
      this.loading = false
    },
    notify(message, style = 'success') {
      this.$store.commit('showNotification', {
        style,
        message,
        icon: style === 'red' ? 'alert' : 'check'
      })
    },
    openCreate() {
      this.form = { id: null, title: '', slug: '', description: '', isPublished: true }
      this.eraMaps = []
      this.events = []
      this.aiText = ''
      this.tab = 0
      this.dialog = true
    },
    async openEdit(item) {
      const resp = await this.$apollo.query({
        query: SINGLE_QUERY,
        fetchPolicy: 'network-only',
        variables: { id: item.id }
      })
      const c = _.get(resp, 'data.chronicles.single')
      if (!c) { return }
      this.form = {
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        isPublished: c.isPublished
      }
      this.eraMaps = c.eraMaps || []
      this.events = c.events || []
      this.dialog = true
    },
    async save() {
      this.acting = true
      try {
        if (this.form.id) {
          await this.$apollo.mutate({
            mutation: gql`mutation ($id: Int!, $slug: String, $title: String, $description: String, $isPublished: Boolean) {
              chronicles { update(id: $id, slug: $slug, title: $title, description: $description, isPublished: $isPublished) {
                responseResult { succeeded message } chronicle { id slug }
              }}
            }`,
            variables: { ...this.form }
          })
        } else {
          const resp = await this.$apollo.mutate({
            mutation: gql`mutation ($title: String!, $slug: String, $description: String, $isPublished: Boolean) {
              chronicles { create(title: $title, slug: $slug, description: $description, isPublished: $isPublished) {
                responseResult { succeeded message } chronicle { id slug }
              }}
            }`,
            variables: {
              title: this.form.title,
              slug: this.form.slug || undefined,
              description: this.form.description,
              isPublished: this.form.isPublished
            }
          })
          const created = _.get(resp, 'data.chronicles.create.chronicle')
          if (created) {
            this.form.id = created.id
            this.form.slug = created.slug
          }
        }
        this.notify('Chronicle saved')
        await this.refresh()
        if (this.form.id) { await this.openEdit({ id: this.form.id }) }
      } catch (err) {
        this.notify(err.message, 'red')
      }
      this.acting = false
    },
    async remove() {
      if (!this.form.id || !confirm('Delete this chronicle and all its maps/events?')) { return }
      this.acting = true
      try {
        await this.$apollo.mutate({
          mutation: gql`mutation ($id: Int!) { chronicles { delete(id: $id) { responseResult { succeeded message } } } }`,
          variables: { id: this.form.id }
        })
        this.dialog = false
        await this.refresh()
      } catch (err) {
        this.notify(err.message, 'red')
      }
      this.acting = false
    },
    openEraMap(em) {
      let config = {}
      let alignment = { type: 'identity' }
      try { config = em && em.basemapConfig ? JSON.parse(em.basemapConfig) : { ...DEFAULT_OSM } } catch (e) { config = { ...DEFAULT_OSM } }
      try { alignment = em && em.alignment ? JSON.parse(em.alignment) : { type: 'identity' } } catch (e) { alignment = { type: 'identity' } }
      const bounds = config.bounds || [[22.15, 113.8], [22.55, 114.45]]
      this.eraForm = {
        id: em ? em.id : null,
        title: em ? em.title : 'Modern Hong Kong',
        timeStart: em ? em.timeStart : '1997',
        timeEnd: em ? em.timeEnd : '2030',
        mapMode: em ? em.mapMode : '2d',
        basemapSource: em ? em.basemapSource : 'public',
        status: em ? em.status : 'live',
        tileUrl: config.url || DEFAULT_OSM.url,
        centerLat: (config.center && config.center[0]) || 22.3193,
        centerLng: (config.center && config.center[1]) || 114.1694,
        zoom: config.zoom || 11,
        imageUrl: config.imageUrl || '',
        boundSouth: bounds[0][0],
        boundWest: bounds[0][1],
        boundNorth: bounds[1][0],
        boundEast: bounds[1][1],
        alignmentType: alignment.type || 'identity',
        alignmentJson: JSON.stringify(alignment, null, 2)
      }
      this.eraDialog = true
    },
    onBasemapSourceChange() {
      if (this.eraForm.basemapSource === 'derived' && this.eraForm.status === 'live') {
        this.eraForm.status = 'draft'
      }
    },
    buildBasemapConfig() {
      if (this.eraForm.basemapSource === 'public') {
        return {
          provider: 'osm',
          url: this.eraForm.tileUrl || DEFAULT_OSM.url,
          attribution: DEFAULT_OSM.attribution,
          center: [Number(this.eraForm.centerLat), Number(this.eraForm.centerLng)],
          zoom: Number(this.eraForm.zoom) || 11
        }
      }
      return {
        imageUrl: this.eraForm.imageUrl,
        bounds: [
          [Number(this.eraForm.boundSouth), Number(this.eraForm.boundWest)],
          [Number(this.eraForm.boundNorth), Number(this.eraForm.boundEast)]
        ]
      }
    },
    buildAlignment() {
      if (this.eraForm.alignmentType === 'identity') {
        return { type: 'identity' }
      }
      try {
        return JSON.parse(this.eraForm.alignmentJson || '{"type":"controlPoints","points":[]}')
      } catch (e) {
        throw new Error('Invalid alignment JSON')
      }
    },
    async saveEraMap() {
      this.acting = true
      try {
        const basemapConfig = JSON.stringify(this.buildBasemapConfig())
        const alignment = JSON.stringify(this.buildAlignment())
        if (this.eraForm.id) {
          await this.$apollo.mutate({
            mutation: gql`mutation ($id: Int!, $title: String, $timeStart: String, $timeEnd: String, $mapMode: String, $basemapSource: String, $basemapConfig: String, $alignment: String, $status: String) {
              chronicles { updateEraMap(id: $id, title: $title, timeStart: $timeStart, timeEnd: $timeEnd, mapMode: $mapMode, basemapSource: $basemapSource, basemapConfig: $basemapConfig, alignment: $alignment, status: $status) {
                responseResult { succeeded message }
              }}
            }`,
            variables: {
              id: this.eraForm.id,
              title: this.eraForm.title,
              timeStart: this.eraForm.timeStart,
              timeEnd: this.eraForm.timeEnd,
              mapMode: this.eraForm.mapMode,
              basemapSource: this.eraForm.basemapSource,
              basemapConfig,
              alignment,
              status: this.eraForm.status
            }
          })
        } else {
          await this.$apollo.mutate({
            mutation: gql`mutation ($chronicleId: Int!, $title: String!, $timeStart: String, $timeEnd: String, $mapMode: String, $basemapSource: String, $basemapConfig: String, $alignment: String, $status: String) {
              chronicles { createEraMap(chronicleId: $chronicleId, title: $title, timeStart: $timeStart, timeEnd: $timeEnd, mapMode: $mapMode, basemapSource: $basemapSource, basemapConfig: $basemapConfig, alignment: $alignment, status: $status) {
                responseResult { succeeded message }
              }}
            }`,
            variables: {
              chronicleId: this.form.id,
              title: this.eraForm.title,
              timeStart: this.eraForm.timeStart,
              timeEnd: this.eraForm.timeEnd,
              mapMode: this.eraForm.mapMode,
              basemapSource: this.eraForm.basemapSource,
              basemapConfig,
              alignment,
              status: this.eraForm.status
            }
          })
        }
        this.eraDialog = false
        this.notify('Era Map saved')
        await this.openEdit({ id: this.form.id })
      } catch (err) {
        this.notify(err.message, 'red')
      }
      this.acting = false
    },
    async deleteEraMap(id) {
      await this.$apollo.mutate({
        mutation: gql`mutation ($id: Int!) { chronicles { deleteEraMap(id: $id) { responseResult { succeeded message } } } }`,
        variables: { id }
      })
      await this.openEdit({ id: this.form.id })
    },
    openEvent(ev) {
      this.eventForm = {
        id: ev ? ev.id : null,
        title: ev ? ev.title : '',
        summary: ev ? ev.summary : '',
        occurrenceStart: ev ? ev.occurrenceStart : '',
        occurrenceEnd: ev ? ev.occurrenceEnd : '',
        occurrenceFuzzy: ev ? !!ev.occurrenceFuzzy : false,
        lat: ev ? ev.lat : 22.3193,
        lng: ev ? ev.lng : 114.1694,
        tags: ev && ev.tags ? ev.tags.map(t => t.tag) : [],
        status: ev ? ev.status : 'live'
      }
      this.eventDialog = true
    },
    async saveEvent() {
      this.acting = true
      try {
        const vars = {
          title: this.eventForm.title,
          summary: this.eventForm.summary,
          occurrenceStart: this.eventForm.occurrenceStart,
          occurrenceEnd: this.eventForm.occurrenceEnd,
          occurrenceFuzzy: this.eventForm.occurrenceFuzzy,
          lat: Number(this.eventForm.lat),
          lng: Number(this.eventForm.lng),
          tags: this.eventForm.tags,
          status: this.eventForm.status
        }
        if (this.eventForm.id) {
          await this.$apollo.mutate({
            mutation: gql`mutation ($id: Int!, $title: String, $summary: String, $occurrenceStart: String, $occurrenceEnd: String, $occurrenceFuzzy: Boolean, $lat: Float, $lng: Float, $tags: [String], $status: String) {
              chronicles { updateEvent(id: $id, title: $title, summary: $summary, occurrenceStart: $occurrenceStart, occurrenceEnd: $occurrenceEnd, occurrenceFuzzy: $occurrenceFuzzy, lat: $lat, lng: $lng, tags: $tags, status: $status) {
                responseResult { succeeded message }
              }}
            }`,
            variables: { id: this.eventForm.id, ...vars }
          })
        } else {
          await this.$apollo.mutate({
            mutation: gql`mutation ($chronicleId: Int!, $title: String!, $summary: String, $occurrenceStart: String, $occurrenceEnd: String, $occurrenceFuzzy: Boolean, $lat: Float!, $lng: Float!, $tags: [String], $status: String) {
              chronicles { createEvent(chronicleId: $chronicleId, title: $title, summary: $summary, occurrenceStart: $occurrenceStart, occurrenceEnd: $occurrenceEnd, occurrenceFuzzy: $occurrenceFuzzy, lat: $lat, lng: $lng, tags: $tags, status: $status) {
                responseResult { succeeded message }
              }}
            }`,
            variables: { chronicleId: this.form.id, ...vars }
          })
        }
        this.eventDialog = false
        this.notify('Event saved')
        await this.openEdit({ id: this.form.id })
      } catch (err) {
        this.notify(err.message, 'red')
      }
      this.acting = false
    },
    async addSampleEvent() {
      this.openEvent({
        id: null,
        title: 'Sample paranormal sighting',
        summary: 'Example pin near Central, Hong Kong.',
        occurrenceStart: '2005',
        occurrenceEnd: '2005',
        occurrenceFuzzy: false,
        lat: 22.2819,
        lng: 114.1556,
        tags: [{ tag: 'haunt' }, { tag: 'urban' }],
        status: 'live'
      })
    },
    async deleteEvent(id) {
      await this.$apollo.mutate({
        mutation: gql`mutation ($id: Int!) { chronicles { deleteEvent(id: $id) { responseResult { succeeded message } } } }`,
        variables: { id }
      })
      await this.openEdit({ id: this.form.id })
    },
    async approveDraft(id) {
      await this.$apollo.mutate({
        mutation: gql`mutation ($id: Int!) { chronicles { approveEventDraft(id: $id) { responseResult { succeeded message } } } }`,
        variables: { id }
      })
      this.notify('Draft approved')
      await this.openEdit({ id: this.form.id })
    },
    async runAnalyze() {
      this.acting = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`mutation ($chronicleId: Int!, $text: String!, $persist: Boolean) {
            chronicles { analyzeText(chronicleId: $chronicleId, text: $text, persist: $persist) {
              responseResult { succeeded message }
              events { id title }
            }}
          }`,
          variables: {
            chronicleId: this.form.id,
            text: this.aiText,
            persist: true
          }
        })
        const msg = _.get(resp, 'data.chronicles.analyzeText.responseResult.message', 'Done')
        const count = _.get(resp, 'data.chronicles.analyzeText.events', []).length
        this.notify(`${msg} (${count} drafts saved)`)
        this.tab = 1
        await this.openEdit({ id: this.form.id })
      } catch (err) {
        this.notify(err.message, 'red')
      }
      this.acting = false
    }
  },
  mounted() {
    this.refresh()
  }
}
</script>

<style scoped>
.is-clickable { cursor: pointer; }
</style>
