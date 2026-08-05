const Model = require('objection').Model
const _ = require('lodash')
const chronicleMapHelper = require('../helpers/chronicle-map')

/* global WIKI */

module.exports = class ChronicleEvent extends Model {
  static get tableName() { return 'chronicleEvents' }

  static get jsonAttributes() {
    return ['footprint', 'aiMeta']
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['chronicleId', 'title', 'lat', 'lng'],
      properties: {
        id: { type: 'integer' },
        chronicleId: { type: 'integer' },
        title: { type: 'string' },
        summary: { type: 'string' },
        occurrenceStart: { type: 'string' },
        occurrenceEnd: { type: 'string' },
        occurrenceFuzzy: { type: 'boolean' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        elevation: { type: ['number', 'null'] },
        footprint: { type: ['object', 'null'] },
        status: { type: 'string' },
        aiMeta: { type: ['object', 'null'] },
        createdById: { type: ['integer', 'null'] },
        approvedById: { type: ['integer', 'null'] }
      }
    }
  }

  static get relationMappings() {
    return {
      chronicle: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./chronicles'),
        join: {
          from: 'chronicleEvents.chronicleId',
          to: 'chronicles.id'
        }
      },
      tags: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./chronicleTags'),
        join: {
          from: 'chronicleEvents.id',
          through: {
            from: 'chronicleEventTags.eventId',
            to: 'chronicleEventTags.tagId'
          },
          to: 'chronicleTags.id'
        }
      },
      pages: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./pages'),
        join: {
          from: 'chronicleEvents.id',
          through: {
            from: 'chronicleEventPages.eventId',
            to: 'chronicleEventPages.pageId'
          },
          to: 'pages.id'
        }
      },
      pinOverrides: {
        relation: Model.HasManyRelation,
        modelClass: require('./chroniclePinOverrides'),
        join: {
          from: 'chronicleEvents.id',
          to: 'chroniclePinOverrides.eventId'
        }
      },
      visibilityOverrides: {
        relation: Model.HasManyRelation,
        modelClass: require('./chronicleVisibilityOverrides'),
        join: {
          from: 'chronicleEvents.id',
          to: 'chronicleVisibilityOverrides.eventId'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
    if (!this.summary) {
      this.summary = ''
    }
    if (!this.occurrenceStart) {
      this.occurrenceStart = ''
    }
    if (!this.occurrenceEnd) {
      this.occurrenceEnd = ''
    }
    if (this.occurrenceFuzzy == null) {
      this.occurrenceFuzzy = false
    }
    if (!this.status) {
      this.status = 'live'
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  static async create (opts) {
    const status = opts.status || 'live'
    const event = await WIKI.models.chronicleEvents.query().insertAndFetch({
      chronicleId: opts.chronicleId,
      title: opts.title,
      summary: opts.summary || '',
      occurrenceStart: opts.occurrenceStart || '',
      occurrenceEnd: opts.occurrenceEnd || '',
      occurrenceFuzzy: !!opts.occurrenceFuzzy,
      lat: opts.lat,
      lng: opts.lng,
      elevation: opts.elevation != null ? opts.elevation : null,
      footprint: opts.footprint || null,
      status,
      aiMeta: opts.aiMeta || null,
      createdById: opts.userId || null,
      approvedById: status === 'live' ? (opts.userId || null) : null,
      approvedAt: status === 'live' ? new Date().toISOString() : null
    })

    if (opts.tags && opts.tags.length) {
      const tags = await WIKI.models.chronicleTags.ensureTags(opts.chronicleId, opts.tags)
      await event.$relatedQuery('tags').relate(tags.map(t => t.id))
    }
    if (opts.pageIds && opts.pageIds.length) {
      await event.$relatedQuery('pages').relate(opts.pageIds)
    }

    return WIKI.models.chronicleEvents.query()
      .findById(event.id)
      .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
  }

  static async update (id, opts) {
    const event = await WIKI.models.chronicleEvents.query().findById(id)
    if (!event) {
      throw new Error('EVENT_NOT_FOUND')
    }
    const patch = _.pick(opts, [
      'title', 'summary', 'occurrenceStart', 'occurrenceEnd', 'occurrenceFuzzy',
      'lat', 'lng', 'elevation', 'footprint', 'status', 'aiMeta'
    ])
    await WIKI.models.chronicleEvents.query().findById(id).patch(patch)

    if (opts.tags) {
      const tags = await WIKI.models.chronicleTags.ensureTags(event.chronicleId, opts.tags)
      await event.$relatedQuery('tags').unrelate()
      if (tags.length) {
        await event.$relatedQuery('tags').relate(tags.map(t => t.id))
      }
    }
    if (opts.pageIds) {
      await event.$relatedQuery('pages').unrelate()
      if (opts.pageIds.length) {
        await event.$relatedQuery('pages').relate(opts.pageIds)
      }
    }

    return WIKI.models.chronicleEvents.query()
      .findById(id)
      .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
  }

  static async approveDraft (id, userId) {
    const event = await WIKI.models.chronicleEvents.query().findById(id)
    if (!event) {
      throw new Error('EVENT_NOT_FOUND')
    }
    if (event.status !== 'draft') {
      throw new Error('NOT_A_DRAFT')
    }
    await WIKI.models.chronicleEvents.query().findById(id).patch({
      status: 'live',
      approvedById: userId,
      approvedAt: new Date().toISOString()
    })
    return WIKI.models.chronicleEvents.query()
      .findById(id)
      .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
  }

  static async remove (id) {
    return WIKI.models.chronicleEvents.query().deleteById(id)
  }

  /**
   * Events visible on an Era Map after Occurrence ∩ range + Visibility Override,
   * with resolved pin positions.
   */
  static projectForEraMap (events, eraMap, { tags = null, includeDrafts = false } = {}) {
    const tagFilter = tags && tags.length ?
      new Set(tags.map(t => String(t).toLowerCase())) :
      null

    return events
      .filter(ev => includeDrafts || ev.status === 'live')
      .filter(ev => {
        if (!tagFilter) {
          return true
        }
        const evTags = (ev.tags || []).map(t => t.tag || t)
        return evTags.some(t => tagFilter.has(String(t).toLowerCase()))
      })
      .filter(ev => {
        const override = (ev.visibilityOverrides || []).find(v => v.eraMapId === eraMap.id)
        return chronicleMapHelper.isEventVisibleOnEraMap({
          occurrenceStart: ev.occurrenceStart,
          occurrenceEnd: ev.occurrenceEnd,
          mapTimeStart: eraMap.timeStart,
          mapTimeEnd: eraMap.timeEnd,
          visibilityOverride: override ? override.mode : null
        })
      })
      .map(ev => {
        const pinOverride = (ev.pinOverrides || []).find(p => p.eraMapId === eraMap.id)
        const pos = chronicleMapHelper.resolveEventPosition({
          event: ev,
          eraMap,
          pinOverride
        })
        return {
          ...ev,
          displayLat: pos.lat,
          displayLng: pos.lng,
          positionSource: pos.source
        }
      })
  }
}
