const Model = require('objection').Model

/* global WIKI */

const DEFAULT_ALIGNMENT = { type: 'identity' }
const DEFAULT_BASEMAP = {
  provider: 'osm',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap contributors',
  center: [22.3193, 114.1694],
  zoom: 11
}

module.exports = class ChronicleEraMap extends Model {
  static get tableName() { return 'chronicleEraMaps' }

  static get jsonAttributes() {
    return ['basemapConfig', 'alignment']
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['chronicleId', 'title'],
      properties: {
        id: { type: 'integer' },
        chronicleId: { type: 'integer' },
        title: { type: 'string' },
        timeStart: { type: 'string' },
        timeEnd: { type: 'string' },
        mapMode: { type: 'string' },
        basemapSource: { type: 'string' },
        basemapConfig: { type: 'object' },
        alignment: { type: 'object' },
        status: { type: 'string' },
        sortIndex: { type: 'integer' }
      }
    }
  }

  static get relationMappings() {
    return {
      chronicle: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./chronicles'),
        join: {
          from: 'chronicleEraMaps.chronicleId',
          to: 'chronicles.id'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
    if (!this.basemapConfig) {
      this.basemapConfig = { ...DEFAULT_BASEMAP }
    }
    if (!this.alignment) {
      this.alignment = { ...DEFAULT_ALIGNMENT }
    }
    if (!this.mapMode) {
      this.mapMode = '2d'
    }
    if (!this.basemapSource) {
      this.basemapSource = 'public'
    }
    if (!this.status) {
      this.status = 'live'
    }
    if (this.sortIndex == null) {
      this.sortIndex = 0
    }
    if (!this.timeStart) {
      this.timeStart = ''
    }
    if (!this.timeEnd) {
      this.timeEnd = ''
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  static async create (opts) {
    const status = opts.status || (opts.basemapSource === 'derived' ? 'draft' : 'live')
    return WIKI.models.chronicleEraMaps.query().insertAndFetch({
      chronicleId: opts.chronicleId,
      title: opts.title,
      timeStart: opts.timeStart || '',
      timeEnd: opts.timeEnd || '',
      mapMode: opts.mapMode || '2d',
      basemapSource: opts.basemapSource || 'public',
      basemapConfig: opts.basemapConfig || { ...DEFAULT_BASEMAP },
      alignment: opts.alignment || { ...DEFAULT_ALIGNMENT },
      status,
      sortIndex: opts.sortIndex || 0
    })
  }

  static async update (id, opts) {
    const patch = {}
    ;['title', 'timeStart', 'timeEnd', 'mapMode', 'basemapSource', 'basemapConfig', 'alignment', 'status', 'sortIndex'].forEach(k => {
      if (opts[k] !== undefined) {
        patch[k] = opts[k]
      }
    })
    await WIKI.models.chronicleEraMaps.query().findById(id).patch(patch)
    return WIKI.models.chronicleEraMaps.query().findById(id)
  }

  static async remove (id) {
    return WIKI.models.chronicleEraMaps.query().deleteById(id)
  }
}
