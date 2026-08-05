const graphHelper = require('../../helpers/graph')
const chronicleAi = require('../../helpers/chronicle-ai')
const _ = require('lodash')

/* global WIKI */

function parseJsonArg (value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }
  if (_.isObject(value)) {
    return value
  }
  try {
    return JSON.parse(value)
  } catch (err) {
    throw new Error('INVALID_JSON')
  }
}

function mapTag (tag) {
  if (!tag) { return null }
  return {
    id: tag.id,
    tag: tag.tag,
    title: tag.title || tag.tag
  }
}

function mapEraMap (eraMap) {
  if (!eraMap) { return null }
  return {
    id: eraMap.id,
    chronicleId: eraMap.chronicleId,
    title: eraMap.title,
    timeStart: eraMap.timeStart || '',
    timeEnd: eraMap.timeEnd || '',
    mapMode: eraMap.mapMode,
    basemapSource: eraMap.basemapSource,
    basemapConfig: JSON.stringify(eraMap.basemapConfig || {}),
    alignment: JSON.stringify(eraMap.alignment || { type: 'identity' }),
    status: eraMap.status,
    sortIndex: eraMap.sortIndex || 0,
    createdAt: eraMap.createdAt,
    updatedAt: eraMap.updatedAt
  }
}

function mapEvent (event) {
  if (!event) { return null }
  return {
    id: event.id,
    chronicleId: event.chronicleId,
    title: event.title,
    summary: event.summary || '',
    occurrenceStart: event.occurrenceStart || '',
    occurrenceEnd: event.occurrenceEnd || '',
    occurrenceFuzzy: !!event.occurrenceFuzzy,
    lat: event.lat,
    lng: event.lng,
    elevation: event.elevation,
    footprint: event.footprint ? JSON.stringify(event.footprint) : null,
    status: event.status,
    tags: (event.tags || []).map(mapTag),
    pageIds: (event.pages || []).map(p => p.id || p),
    pinOverrides: (event.pinOverrides || []).map(p => ({
      id: p.id,
      eventId: p.eventId,
      eraMapId: p.eraMapId,
      lat: p.lat,
      lng: p.lng,
      mapX: p.mapX,
      mapY: p.mapY
    })),
    visibilityOverrides: (event.visibilityOverrides || []).map(v => ({
      id: v.id,
      eventId: v.eventId,
      eraMapId: v.eraMapId,
      mode: v.mode
    })),
    displayLat: event.displayLat,
    displayLng: event.displayLng,
    positionSource: event.positionSource,
    aiMeta: event.aiMeta ? JSON.stringify(event.aiMeta) : null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    approvedAt: event.approvedAt
  }
}

function mapChronicle (chronicle) {
  if (!chronicle) { return null }
  return {
    id: chronicle.id,
    slug: chronicle.slug,
    title: chronicle.title,
    description: chronicle.description || '',
    isPublished: !!chronicle.isPublished,
    tags: (chronicle.tags || []).map(mapTag),
    eraMaps: (chronicle.eraMaps || []).map(mapEraMap),
    events: (chronicle.events || []).map(mapEvent),
    createdAt: chronicle.createdAt,
    updatedAt: chronicle.updatedAt
  }
}

function canManage (user) {
  return WIKI.auth.checkAccess(user, ['manage:chronicles', 'manage:system'])
}

function canWrite (user) {
  return WIKI.auth.checkAccess(user, ['write:chronicles', 'manage:chronicles', 'manage:system'])
}

function canApprove (user) {
  return WIKI.auth.checkAccess(user, ['approve:chronicles', 'manage:chronicles', 'manage:system'])
}

function canRead (user) {
  return WIKI.auth.checkAccess(user, ['read:chronicles', 'write:chronicles', 'manage:chronicles', 'manage:system'])
}

function filterChronicleForViewer (chronicle, { includeDrafts = false, includeUnpublished = false } = {}) {
  if (!chronicle) { return null }
  const clone = { ...chronicle }
  clone.eraMaps = (chronicle.eraMaps || []).filter(em => {
    if (em.status === 'live') { return true }
    return includeDrafts || includeUnpublished
  })
  clone.events = (chronicle.events || []).filter(ev => {
    if (ev.status === 'live') { return true }
    return includeDrafts
  })
  return clone
}

module.exports = {
  Query: {
    async chronicles () { return {} }
  },
  Mutation: {
    async chronicles () { return {} }
  },
  ChronicleQuery: {
    async list (obj, args, context) {
      if (!canRead(context.req.user)) {
        throw new Error('Forbidden')
      }
      const includeUnpublished = !!args.includeUnpublished && canManage(context.req.user)
      return WIKI.models.chronicles.list({ includeUnpublished })
    },
    async single (obj, args, context) {
      if (!canRead(context.req.user)) {
        throw new Error('Forbidden')
      }
      const includeUnpublished = canManage(context.req.user)
      const includeDrafts = canApprove(context.req.user)
      let chronicle = null
      if (args.id) {
        chronicle = await WIKI.models.chronicles.query()
          .findById(args.id)
          .withGraphFetched('[tags, eraMaps, events.[tags, pinOverrides, visibilityOverrides, pages]]')
          .modifyGraph('eraMaps', b => b.orderBy('sortIndex').orderBy('id'))
      } else if (args.slug) {
        chronicle = await WIKI.models.chronicles.getBySlug(args.slug, { includeUnpublished })
      }
      if (!chronicle) {
        return null
      }
      if (!chronicle.isPublished && !includeUnpublished) {
        return null
      }
      return mapChronicle(filterChronicleForViewer(chronicle, { includeDrafts, includeUnpublished }))
    },
    async mapView (obj, args, context) {
      if (!canRead(context.req.user)) {
        throw new Error('Forbidden')
      }
      const includeUnpublished = canManage(context.req.user)
      const includeDrafts = canApprove(context.req.user)
      const slugs = [args.slug, ...(args.overlaySlugs || [])].filter(Boolean)
      const chronicles = []
      for (const slug of slugs) {
        const c = await WIKI.models.chronicles.getBySlug(slug, { includeUnpublished })
        if (c) {
          chronicles.push(filterChronicleForViewer(c, { includeDrafts, includeUnpublished }))
        }
      }
      if (!chronicles.length) {
        return { chronicles: [], activeEraMap: null, pins: [] }
      }
      const primary = chronicles[0]
      let eraMap = null
      if (args.eraMapId) {
        eraMap = (primary.eraMaps || []).find(e => e.id === args.eraMapId) || null
      }
      if (!eraMap) {
        eraMap = (primary.eraMaps || []).find(e => e.status === 'live') || null
      }

      const pins = []
      for (const c of chronicles) {
        // Overlay chronicles project onto the primary Era Map when available,
        // so pins share one spatial frame (Canonical Position / overrides).
        const active = (c.id === primary.id ? eraMap : null) ||
          (c.eraMaps || []).find(e => e.status === 'live') ||
          null
        if (!active) {
          continue
        }
        const projected = WIKI.models.chronicleEvents.projectForEraMap(c.events || [], active, {
          tags: args.tags,
          includeDrafts
        })
        pins.push(...projected)
      }

      return {
        chronicles: chronicles.map(mapChronicle),
        activeEraMap: mapEraMap(eraMap),
        pins: pins.map(mapEvent)
      }
    },
    async drafts (obj, args, context) {
      if (!canApprove(context.req.user)) {
        throw new Error('Forbidden')
      }
      const drafts = await WIKI.models.chronicleEvents.query()
        .where({
          chronicleId: args.chronicleId,
          status: 'draft'
        })
        .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
        .orderBy('createdAt', 'desc')
      return drafts.map(mapEvent)
    }
  },
  ChronicleMutation: {
    async create (obj, args, context) {
      try {
        const chronicle = await WIKI.models.chronicles.create({
          ...args,
          userId: context.req.user.id
        })
        const full = await WIKI.models.chronicles.getBySlug(chronicle.slug, { includeUnpublished: true })
        return {
          responseResult: graphHelper.generateSuccess('Chronicle created'),
          chronicle: mapChronicle(full)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async update (obj, args, context) {
      try {
        await WIKI.models.chronicles.update(args.id, args)
        const chronicle = await WIKI.models.chronicles.query()
          .findById(args.id)
          .withGraphFetched('[tags, eraMaps, events.[tags, pinOverrides, visibilityOverrides, pages]]')
        return {
          responseResult: graphHelper.generateSuccess('Chronicle updated'),
          chronicle: mapChronicle(chronicle)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async delete (obj, args) {
      try {
        await WIKI.models.chronicles.remove(args.id)
        return {
          responseResult: graphHelper.generateSuccess('Chronicle deleted')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async createEraMap (obj, args) {
      try {
        const eraMap = await WIKI.models.chronicleEraMaps.create({
          ...args,
          basemapConfig: parseJsonArg(args.basemapConfig, undefined),
          alignment: parseJsonArg(args.alignment, undefined)
        })
        return {
          responseResult: graphHelper.generateSuccess('Era Map created'),
          eraMap: mapEraMap(eraMap)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateEraMap (obj, args) {
      try {
        const patch = { ...args }
        if (args.basemapConfig !== undefined) {
          patch.basemapConfig = parseJsonArg(args.basemapConfig, {})
        }
        if (args.alignment !== undefined) {
          patch.alignment = parseJsonArg(args.alignment, { type: 'identity' })
        }
        const eraMap = await WIKI.models.chronicleEraMaps.update(args.id, patch)
        return {
          responseResult: graphHelper.generateSuccess('Era Map updated'),
          eraMap: mapEraMap(eraMap)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deleteEraMap (obj, args) {
      try {
        await WIKI.models.chronicleEraMaps.remove(args.id)
        return {
          responseResult: graphHelper.generateSuccess('Era Map deleted')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async createEvent (obj, args, context) {
      try {
        if (args.status === 'live' && !canWrite(context.req.user)) {
          throw new Error('Forbidden')
        }
        const event = await WIKI.models.chronicleEvents.create({
          ...args,
          footprint: parseJsonArg(args.footprint, null),
          aiMeta: parseJsonArg(args.aiMeta, null),
          userId: context.req.user.id,
          status: args.status || 'live'
        })
        return {
          responseResult: graphHelper.generateSuccess('Event created'),
          event: mapEvent(event)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async updateEvent (obj, args, context) {
      try {
        const existing = await WIKI.models.chronicleEvents.query().findById(args.id)
        if (!existing) {
          throw new Error('EVENT_NOT_FOUND')
        }
        const patch = { ...args }
        if (args.footprint !== undefined) {
          patch.footprint = parseJsonArg(args.footprint, null)
        }
        if (args.aiMeta !== undefined) {
          patch.aiMeta = parseJsonArg(args.aiMeta, null)
        }
        // Promoting draft → live requires approve (or manage), not write alone.
        if (args.status === 'live' && existing.status === 'draft' && !canApprove(context.req.user)) {
          throw new Error('Forbidden')
        }
        const event = await WIKI.models.chronicleEvents.update(args.id, patch)
        return {
          responseResult: graphHelper.generateSuccess('Event updated'),
          event: mapEvent(event)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async approveEventDraft (obj, args, context) {
      try {
        const event = await WIKI.models.chronicleEvents.approveDraft(args.id, context.req.user.id)
        return {
          responseResult: graphHelper.generateSuccess('Event draft approved'),
          event: mapEvent(event)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async deleteEvent (obj, args) {
      try {
        await WIKI.models.chronicleEvents.remove(args.id)
        return {
          responseResult: graphHelper.generateSuccess('Event deleted')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async setPinOverride (obj, args) {
      try {
        const event = await WIKI.models.chronicleEvents.query().findById(args.eventId)
        if (!event) {
          throw new Error('EVENT_NOT_FOUND')
        }
        const eraMap = await WIKI.models.chronicleEraMaps.query().findById(args.eraMapId)
        if (!eraMap || eraMap.chronicleId !== event.chronicleId) {
          throw new Error('ERA_MAP_MISMATCH')
        }
        const existing = await WIKI.models.chroniclePinOverrides.query()
          .where({ eventId: args.eventId, eraMapId: args.eraMapId })
          .first()
        if (existing) {
          await WIKI.models.chroniclePinOverrides.query().findById(existing.id).patch({
            lat: args.lat != null ? args.lat : null,
            lng: args.lng != null ? args.lng : null,
            mapX: args.mapX != null ? args.mapX : null,
            mapY: args.mapY != null ? args.mapY : null
          })
        } else {
          await WIKI.models.chroniclePinOverrides.query().insert({
            eventId: args.eventId,
            eraMapId: args.eraMapId,
            lat: args.lat != null ? args.lat : null,
            lng: args.lng != null ? args.lng : null,
            mapX: args.mapX != null ? args.mapX : null,
            mapY: args.mapY != null ? args.mapY : null
          })
        }
        const updated = await WIKI.models.chronicleEvents.query()
          .findById(args.eventId)
          .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
        return {
          responseResult: graphHelper.generateSuccess('Pin override saved'),
          event: mapEvent(updated)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async clearPinOverride (obj, args) {
      try {
        await WIKI.models.chroniclePinOverrides.query()
          .where({ eventId: args.eventId, eraMapId: args.eraMapId })
          .delete()
        const event = await WIKI.models.chronicleEvents.query()
          .findById(args.eventId)
          .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
        return {
          responseResult: graphHelper.generateSuccess('Pin override cleared'),
          event: mapEvent(event)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async setVisibilityOverride (obj, args) {
      try {
        if (!['include', 'exclude'].includes(args.mode)) {
          throw new Error('INVALID_MODE')
        }
        const event = await WIKI.models.chronicleEvents.query().findById(args.eventId)
        if (!event) {
          throw new Error('EVENT_NOT_FOUND')
        }
        const eraMap = await WIKI.models.chronicleEraMaps.query().findById(args.eraMapId)
        if (!eraMap || eraMap.chronicleId !== event.chronicleId) {
          throw new Error('ERA_MAP_MISMATCH')
        }
        const existing = await WIKI.models.chronicleVisibilityOverrides.query()
          .where({ eventId: args.eventId, eraMapId: args.eraMapId })
          .first()
        if (existing) {
          await WIKI.models.chronicleVisibilityOverrides.query().findById(existing.id).patch({ mode: args.mode })
        } else {
          await WIKI.models.chronicleVisibilityOverrides.query().insert({
            eventId: args.eventId,
            eraMapId: args.eraMapId,
            mode: args.mode
          })
        }
        const updated = await WIKI.models.chronicleEvents.query()
          .findById(args.eventId)
          .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
        return {
          responseResult: graphHelper.generateSuccess('Visibility override saved'),
          event: mapEvent(updated)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async clearVisibilityOverride (obj, args) {
      try {
        await WIKI.models.chronicleVisibilityOverrides.query()
          .where({ eventId: args.eventId, eraMapId: args.eraMapId })
          .delete()
        const event = await WIKI.models.chronicleEvents.query()
          .findById(args.eventId)
          .withGraphFetched('[tags, pages, pinOverrides, visibilityOverrides]')
        return {
          responseResult: graphHelper.generateSuccess('Visibility override cleared'),
          event: mapEvent(event)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async ingestEventDraft (obj, args, context) {
      try {
        const event = await WIKI.models.chronicleEvents.create({
          ...args,
          status: 'draft',
          aiMeta: parseJsonArg(args.aiMeta, { source: 'ingest' }),
          userId: context.req.user.id
        })
        return {
          responseResult: graphHelper.generateSuccess('Event draft ingested'),
          event: mapEvent(event)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async analyzeText (obj, args, context) {
      try {
        const chronicle = await WIKI.models.chronicles.query().findById(args.chronicleId)
        if (!chronicle) {
          throw new Error('CHRONICLE_NOT_FOUND')
        }
        const suggestions = chronicleAi.analyzeTextToDrafts(args.text)
        const mappedSuggestions = suggestions.map((s, idx) => mapEvent({
          id: -(idx + 1),
          chronicleId: args.chronicleId,
          title: s.title,
          summary: s.summary,
          occurrenceStart: s.occurrenceStart,
          occurrenceEnd: s.occurrenceEnd,
          occurrenceFuzzy: s.occurrenceFuzzy,
          lat: s.lat,
          lng: s.lng,
          status: 'draft',
          tags: (s.tags || []).map((t, i) => ({ id: i, tag: t, title: t })),
          pages: [],
          pinOverrides: [],
          visibilityOverrides: [],
          aiMeta: s.aiMeta,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))

        const events = []
        if (args.persist !== false) {
          for (const s of suggestions) {
            const event = await WIKI.models.chronicleEvents.create({
              chronicleId: args.chronicleId,
              title: s.title,
              summary: s.summary,
              occurrenceStart: s.occurrenceStart,
              occurrenceEnd: s.occurrenceEnd,
              occurrenceFuzzy: s.occurrenceFuzzy,
              lat: s.lat,
              lng: s.lng,
              tags: s.tags,
              status: 'draft',
              aiMeta: s.aiMeta,
              userId: context.req.user.id
            })
            events.push(mapEvent(event))
          }
        }

        return {
          responseResult: graphHelper.generateSuccess(`Analyzed ${suggestions.length} candidate event(s)`),
          suggestions: mappedSuggestions,
          events
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
