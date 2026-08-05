<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Chronicles', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Chronicles
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Era maps and pinned events
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

    v-dialog(v-model='dialog', max-width='720', scrollable)
      v-card(v-if='form')
        v-card-title {{ form.id ? 'Edit Chronicle' : 'New Chronicle' }}
        v-divider
        v-card-text
          v-text-field(v-model='form.title', label='Title', outlined, dense)
          v-text-field(v-model='form.slug', label='Slug', outlined, dense, hint='Used in /chronicle/{slug}', persistent-hint)
          v-textarea(v-model='form.description', label='Description', outlined, dense, rows='3')
          v-switch(v-model='form.isPublished', label='Published', inset)
          template(v-if='form.id')
            v-divider.my-4
            .subtitle-2.mb-2 Era Maps
            v-list(dense)
              v-list-item(v-for='em in eraMaps', :key='em.id')
                v-list-item-content
                  v-list-item-title {{ em.title }}
                  v-list-item-subtitle {{ em.timeStart || '…' }} → {{ em.timeEnd || '…' }} · {{ em.basemapSource }} · {{ em.mapMode }}
                v-list-item-action
                  v-btn(icon, small, @click='deleteEraMap(em.id)')
                    v-icon mdi-delete-outline
            v-btn.mt-2(small, outlined, color='primary', @click='addEraMap') Add Era Map (OSM / HK default)
            v-divider.my-4
            .subtitle-2.mb-2 Events
            v-list(dense)
              v-list-item(v-for='ev in events', :key='ev.id')
                v-list-item-content
                  v-list-item-title {{ ev.title }}
                  v-list-item-subtitle {{ ev.occurrenceStart || '?' }} · {{ ev.lat }}, {{ ev.lng }} · {{ ev.status }}
                v-list-item-action
                  v-btn(v-if='ev.status === `draft`', icon, small, color='green', @click='approveDraft(ev.id)')
                    v-icon mdi-check
                  v-btn(icon, small, @click='deleteEvent(ev.id)')
                    v-icon mdi-delete-outline
            v-btn.mt-2(small, outlined, color='primary', @click='addSampleEvent') Add sample HK event
        v-divider
        v-card-actions
          v-btn(v-if='form.id', text, color='error', :loading='acting', @click='remove') Delete
          v-spacer
          v-btn(text, @click='dialog = false') Cancel
          v-btn(color='primary', dark, :loading='acting', @click='save') Save
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const LIST_QUERY = gql`
  query ($includeUnpublished: Boolean) {
    chronicles {
      list(includeUnpublished: $includeUnpublished) {
        id
        slug
        title
        description
        isPublished
        updatedAt
      }
    }
  }
`

const SINGLE_QUERY = gql`
  query ($id: Int!) {
    chronicles {
      single(id: $id) {
        id
        slug
        title
        description
        isPublished
        eraMaps {
          id
          title
          timeStart
          timeEnd
          mapMode
          basemapSource
          status
        }
        events {
          id
          title
          summary
          occurrenceStart
          lat
          lng
          status
        }
      }
    }
  }
`

export default {
  data() {
    return {
      loading: false,
      acting: false,
      chronicles: [],
      dialog: false,
      form: null,
      eraMaps: [],
      events: [],
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
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.loading = false
    },
    openCreate() {
      this.form = {
        id: null,
        title: '',
        slug: '',
        description: '',
        isPublished: true
      }
      this.eraMaps = []
      this.events = []
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
            mutation: gql`
              mutation ($id: Int!, $slug: String, $title: String, $description: String, $isPublished: Boolean) {
                chronicles {
                  update(id: $id, slug: $slug, title: $title, description: $description, isPublished: $isPublished) {
                    responseResult { succeeded message }
                    chronicle { id slug }
                  }
                }
              }
            `,
            variables: { ...this.form }
          })
        } else {
          const resp = await this.$apollo.mutate({
            mutation: gql`
              mutation ($title: String!, $slug: String, $description: String, $isPublished: Boolean) {
                chronicles {
                  create(title: $title, slug: $slug, description: $description, isPublished: $isPublished) {
                    responseResult { succeeded message }
                    chronicle { id slug }
                  }
                }
              }
            `,
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
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Chronicle saved',
          icon: 'check'
        })
        await this.refresh()
        if (this.form.id) {
          await this.openEdit({ id: this.form.id })
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.acting = false
    },
    async remove() {
      if (!this.form.id || !confirm('Delete this chronicle and all its maps/events?')) { return }
      this.acting = true
      try {
        await this.$apollo.mutate({
            mutation: gql`
            mutation ($id: Int!) {
              chronicles {
                delete(id: $id) {
                  responseResult { succeeded message }
                }
              }
            }
          `,
          variables: { id: this.form.id }
        })
        this.dialog = false
        await this.refresh()
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.acting = false
    },
    async addEraMap() {
      if (!this.form.id) { return }
      await this.$apollo.mutate({
        mutation: gql`
          mutation ($chronicleId: Int!, $title: String!, $timeStart: String, $timeEnd: String, $mapMode: String, $basemapSource: String, $basemapConfig: String, $alignment: String) {
            chronicles {
              createEraMap(chronicleId: $chronicleId, title: $title, timeStart: $timeStart, timeEnd: $timeEnd, mapMode: $mapMode, basemapSource: $basemapSource, basemapConfig: $basemapConfig, alignment: $alignment) {
                responseResult { succeeded message }
              }
            }
          }
        `,
        variables: {
          chronicleId: this.form.id,
          title: 'Modern Hong Kong',
          timeStart: '1997',
          timeEnd: '2030',
          mapMode: '2d',
          basemapSource: 'public',
          basemapConfig: JSON.stringify({
            provider: 'osm',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '&copy; OpenStreetMap contributors',
            center: [22.3193, 114.1694],
            zoom: 11
          }),
          alignment: JSON.stringify({ type: 'identity' })
        }
      })
      await this.openEdit({ id: this.form.id })
    },
    async deleteEraMap(id) {
      await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!) {
            chronicles { deleteEraMap(id: $id) { responseResult { succeeded message } } }
          }
        `,
        variables: { id }
      })
      await this.openEdit({ id: this.form.id })
    },
    async addSampleEvent() {
      if (!this.form.id) { return }
      await this.$apollo.mutate({
        mutation: gql`
          mutation ($chronicleId: Int!, $title: String!, $summary: String, $occurrenceStart: String, $occurrenceEnd: String, $lat: Float!, $lng: Float!, $tags: [String], $status: String) {
            chronicles {
              createEvent(chronicleId: $chronicleId, title: $title, summary: $summary, occurrenceStart: $occurrenceStart, occurrenceEnd: $occurrenceEnd, lat: $lat, lng: $lng, tags: $tags, status: $status) {
                responseResult { succeeded message }
              }
            }
          }
        `,
        variables: {
          chronicleId: this.form.id,
          title: 'Sample paranormal sighting',
          summary: 'Example pin near Central, Hong Kong.',
          occurrenceStart: '2005',
          occurrenceEnd: '2005',
          lat: 22.2819,
          lng: 114.1556,
          tags: ['haunt', 'urban'],
          status: 'live'
        }
      })
      await this.openEdit({ id: this.form.id })
    },
    async deleteEvent(id) {
      await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!) {
            chronicles { deleteEvent(id: $id) { responseResult { succeeded message } } }
          }
        `,
        variables: { id }
      })
      await this.openEdit({ id: this.form.id })
    },
    async approveDraft(id) {
      await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!) {
            chronicles {
              approveEventDraft(id: $id) {
                responseResult { succeeded message }
              }
            }
          }
        `,
        variables: { id }
      })
      await this.openEdit({ id: this.form.id })
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
