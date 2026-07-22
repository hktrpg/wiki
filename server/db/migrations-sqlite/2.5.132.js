/* global WIKI */

exports.up = async knex => {
  const guests = await knex('groups').where('name', 'Guests').first()
  if (!guests) {
    return
  }

  const now = new Date().toISOString()
  const permissions = [
    'read:pages',
    'write:pages',
    'write:pages:pending',
    'read:assets',
    'read:comments',
    'write:comments'
  ]
  const pageRules = [
    {
      id: 'guest',
      deny: false,
      match: 'START',
      roles: [
        'read:pages',
        'write:pages',
        'write:pages:pending',
        'read:assets',
        'read:comments',
        'write:comments'
      ],
      path: '',
      locales: []
    }
  ]

  await knex('groups').where('id', guests.id).update({
    permissions: JSON.stringify(permissions),
    pageRules: JSON.stringify(pageRules),
    updatedAt: now
  })
}

exports.down = async knex => {
  const guests = await knex('groups').where('name', 'Guests').first()
  if (!guests) {
    return
  }

  const now = new Date().toISOString()
  await knex('groups').where('id', guests.id).update({
    permissions: JSON.stringify([
      'read:pages',
      'read:assets',
      'read:comments',
      'write:comments',
      'write:pages:pending'
    ]),
    pageRules: JSON.stringify([
      {
        id: 'guest',
        deny: false,
        match: 'START',
        roles: [
          'read:pages',
          'read:assets',
          'read:comments',
          'write:comments',
          'write:pages:pending'
        ],
        path: '',
        locales: []
      }
    ]),
    updatedAt: now
  })
}
