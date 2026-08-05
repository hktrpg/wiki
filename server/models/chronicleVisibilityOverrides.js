const Model = require('objection').Model

module.exports = class ChronicleVisibilityOverride extends Model {
  static get tableName() { return 'chronicleVisibilityOverrides' }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['eventId', 'eraMapId', 'mode'],
      properties: {
        id: { type: 'integer' },
        eventId: { type: 'integer' },
        eraMapId: { type: 'integer' },
        mode: { type: 'string' }
      }
    }
  }
}
