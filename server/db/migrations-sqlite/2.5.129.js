exports.up = async knex => {
  await knex.schema.createTable('pageReviews', table => {
    table.increments('id').primary()
    table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('SET NULL')
    table.string('localeCode', 5).notNullable()
    table.string('path').notNullable()
    table.string('title').notNullable()
    table.string('description').notNullable().defaultTo('')
    table.text('content').notNullable()
    table.string('contentType').notNullable()
    table.string('editorKey').notNullable()
    table.json('tags').notNullable()
    table.text('scriptCss').notNullable().defaultTo('')
    table.text('scriptJs').notNullable().defaultTo('')
    table.boolean('isPublished').notNullable().defaultTo(true)
    table.string('publishStartDate').notNullable().defaultTo('')
    table.string('publishEndDate').notNullable().defaultTo('')
    table.string('changeReason', 500).notNullable()
    table.string('status', 20).notNullable().defaultTo('pending')
    table.string('pendingKey').nullable().unique()
    table.string('gitBranch').nullable()
    table.integer('authorId').unsigned().notNullable().references('id').inTable('users')
    table.integer('reviewerId').unsigned().references('id').inTable('users').onDelete('SET NULL')
    table.string('reviewerComment', 2000).nullable()
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
    table.string('reviewedAt').nullable()
    table.index(['status', 'updatedAt'])
    table.index(['localeCode', 'path'])
  })

  const existing = await knex('groups').where('name', 'Pending Contributors').first()
  if (!existing) {
    const now = new Date().toISOString()
    await knex('groups').insert({
      name: 'Pending Contributors',
      permissions: JSON.stringify([
        'read:pages',
        'read:assets',
        'read:comments',
        'write:pages:pending'
      ]),
      pageRules: JSON.stringify([
        {
          id: 'pending-contributors',
          deny: false,
          match: 'START',
          roles: [
            'read:pages',
            'read:assets',
            'read:comments',
            'write:pages:pending'
          ],
          path: '',
          locales: []
        }
      ]),
      isSystem: false,
      redirectOnLogin: '/',
      createdAt: now,
      updatedAt: now
    })
  }
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('pageReviews')
  await knex('groups').where('name', 'Pending Contributors').del()
}
