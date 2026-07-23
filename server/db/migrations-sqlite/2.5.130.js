exports.up = async knex => {
  await knex.schema.alterTable('pageReviews', table => {
    table.string('authorIp', 64).notNullable().defaultTo('')
  })

  const guests = await knex('groups').where('name', 'Guests').first()
  if (guests) {
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
}

exports.down = async knex => {
  await knex.schema.alterTable('pageReviews', table => {
    table.dropColumn('authorIp')
  })
}
