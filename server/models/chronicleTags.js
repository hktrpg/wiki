const Model = require('objection').Model

/* global WIKI */

module.exports = class ChronicleTag extends Model {
  static get tableName() { return 'chronicleTags' }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['chronicleId', 'tag'],
      properties: {
        id: { type: 'integer' },
        chronicleId: { type: 'integer' },
        tag: { type: 'string' },
        title: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    return {
      chronicle: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./chronicles'),
        join: {
          from: 'chronicleTags.chronicleId',
          to: 'chronicles.id'
        }
      },
      events: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./chronicleEvents'),
        join: {
          from: 'chronicleTags.id',
          through: {
            from: 'chronicleEventTags.tagId',
            to: 'chronicleEventTags.eventId'
          },
          to: 'chronicleEvents.id'
        }
      }
    }
  }

  static async ensureTags (chronicleId, tags = []) {
    const normalized = [...new Set(tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))]
    const existing = await WIKI.models.chronicleTags.query().where('chronicleId', chronicleId)
    const byTag = new Map(existing.map(t => [t.tag, t]))
    const result = []
    for (const tag of normalized) {
      if (byTag.has(tag)) {
        result.push(byTag.get(tag))
      } else {
        result.push(await WIKI.models.chronicleTags.query().insertAndFetch({
          chronicleId,
          tag,
          title: tag
        }))
      }
    }
    return result
  }
}
