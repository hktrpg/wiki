const Model = require('objection').Model
const _ = require('lodash')

/* global WIKI */

/**
 * Chronicle aggregate root
 */
module.exports = class Chronicle extends Model {
  static get tableName() { return 'chronicles' }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['slug', 'title'],
      properties: {
        id: { type: 'integer' },
        slug: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        isPublished: { type: 'boolean' },
        createdById: { type: ['integer', 'null'] }
      }
    }
  }

  static get relationMappings() {
    return {
      eraMaps: {
        relation: Model.HasManyRelation,
        modelClass: require('./chronicleEraMaps'),
        join: {
          from: 'chronicles.id',
          to: 'chronicleEraMaps.chronicleId'
        }
      },
      events: {
        relation: Model.HasManyRelation,
        modelClass: require('./chronicleEvents'),
        join: {
          from: 'chronicles.id',
          to: 'chronicleEvents.chronicleId'
        }
      },
      tags: {
        relation: Model.HasManyRelation,
        modelClass: require('./chronicleTags'),
        join: {
          from: 'chronicles.id',
          to: 'chronicleTags.chronicleId'
        }
      },
      createdBy: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'chronicles.createdById',
          to: 'users.id'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
    if (this.isPublished == null) {
      this.isPublished = true
    }
    if (!this.description) {
      this.description = ''
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  static normalizeSlug (slug) {
    return _.chain(slug)
      .toLower()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .value()
  }

  static async list ({ includeUnpublished = false } = {}) {
    let q = WIKI.models.chronicles.query().orderBy('title')
    if (!includeUnpublished) {
      q = q.where('isPublished', true)
    }
    return q
  }

  static async getBySlug (slug, { includeUnpublished = false } = {}) {
    let q = WIKI.models.chronicles.query()
      .where('slug', slug)
      .withGraphFetched('[tags, eraMaps, events.[tags, pinOverrides, visibilityOverrides, pages]]')
      .modifyGraph('eraMaps', b => b.orderBy('sortIndex').orderBy('id'))
      .modifyGraph('events', b => b.orderBy('occurrenceStart').orderBy('id'))
      .first()
    const chronicle = await q
    if (!chronicle) {
      return null
    }
    if (!includeUnpublished && !chronicle.isPublished) {
      return null
    }
    return chronicle
  }

  static async create (opts) {
    const slug = this.normalizeSlug(opts.slug || opts.title)
    if (!slug) {
      throw new Error('INVALID_SLUG')
    }
    const existing = await WIKI.models.chronicles.query().where('slug', slug).first()
    if (existing) {
      throw new Error('SLUG_EXISTS')
    }
    return WIKI.models.chronicles.query().insertAndFetch({
      slug,
      title: opts.title,
      description: opts.description || '',
      isPublished: opts.isPublished !== false,
      createdById: opts.userId || null
    })
  }

  static async update (id, opts) {
    const patch = _.pick(opts, ['title', 'description', 'isPublished'])
    if (opts.slug) {
      patch.slug = this.normalizeSlug(opts.slug)
      const clash = await WIKI.models.chronicles.query()
        .where('slug', patch.slug)
        .whereNot('id', id)
        .first()
      if (clash) {
        throw new Error('SLUG_EXISTS')
      }
    }
    await WIKI.models.chronicles.query().findById(id).patch(patch)
    return WIKI.models.chronicles.query().findById(id)
  }

  static async remove (id) {
    return WIKI.models.chronicles.query().deleteById(id)
  }
}
