const Model = require('objection').Model

module.exports = class ChroniclePinOverride extends Model {
  static get tableName() { return 'chroniclePinOverrides' }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['eventId', 'eraMapId'],
      properties: {
        id: { type: 'integer' },
        eventId: { type: 'integer' },
        eraMapId: { type: 'integer' },
        lat: { type: ['number', 'null'] },
        lng: { type: ['number', 'null'] },
        mapX: { type: ['number', 'null'] },
        mapY: { type: ['number', 'null'] }
      }
    }
  }
}
