exports.up = async knex => {
  await knex.schema
    .createTable('chronicles', table => {
      table.increments('id').primary()
      table.string('slug', 255).notNullable().unique()
      table.string('title').notNullable()
      table.string('description', 2000).notNullable().defaultTo('')
      table.boolean('isPublished').notNullable().defaultTo(true)
      table.integer('createdById').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
    })
    .createTable('chronicleTags', table => {
      table.increments('id').primary()
      table.integer('chronicleId').unsigned().notNullable().references('id').inTable('chronicles').onDelete('CASCADE')
      table.string('tag', 255).notNullable()
      table.string('title').notNullable().defaultTo('')
      table.unique(['chronicleId', 'tag'])
    })
    .createTable('chronicleEraMaps', table => {
      table.increments('id').primary()
      table.integer('chronicleId').unsigned().notNullable().references('id').inTable('chronicles').onDelete('CASCADE')
      table.string('title').notNullable()
      table.string('timeStart', 64).notNullable().defaultTo('')
      table.string('timeEnd', 64).notNullable().defaultTo('')
      table.string('mapMode', 16).notNullable().defaultTo('2d')
      table.string('basemapSource', 32).notNullable().defaultTo('public')
      table.json('basemapConfig').notNullable()
      table.json('alignment').notNullable()
      table.string('status', 20).notNullable().defaultTo('live')
      table.integer('sortIndex').notNullable().defaultTo(0)
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
      table.index(['chronicleId', 'status'])
    })
    .createTable('chronicleEvents', table => {
      table.increments('id').primary()
      table.integer('chronicleId').unsigned().notNullable().references('id').inTable('chronicles').onDelete('CASCADE')
      table.string('title').notNullable()
      table.string('summary', 4000).notNullable().defaultTo('')
      table.string('occurrenceStart', 64).notNullable().defaultTo('')
      table.string('occurrenceEnd', 64).notNullable().defaultTo('')
      table.boolean('occurrenceFuzzy').notNullable().defaultTo(false)
      table.float('lat').notNullable()
      table.float('lng').notNullable()
      table.float('elevation').nullable()
      table.json('footprint').nullable()
      table.string('status', 20).notNullable().defaultTo('live')
      table.json('aiMeta').nullable()
      table.integer('createdById').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.integer('approvedById').unsigned().references('id').inTable('users').onDelete('SET NULL')
      table.string('createdAt').notNullable()
      table.string('updatedAt').notNullable()
      table.string('approvedAt').nullable()
      table.index(['chronicleId', 'status'])
      table.index(['occurrenceStart', 'occurrenceEnd'])
    })
    .createTable('chronicleEventTags', table => {
      table.integer('eventId').unsigned().notNullable().references('id').inTable('chronicleEvents').onDelete('CASCADE')
      table.integer('tagId').unsigned().notNullable().references('id').inTable('chronicleTags').onDelete('CASCADE')
      table.primary(['eventId', 'tagId'])
    })
    .createTable('chronicleEventPages', table => {
      table.integer('eventId').unsigned().notNullable().references('id').inTable('chronicleEvents').onDelete('CASCADE')
      table.integer('pageId').unsigned().notNullable().references('id').inTable('pages').onDelete('CASCADE')
      table.primary(['eventId', 'pageId'])
    })
    .createTable('chroniclePinOverrides', table => {
      table.increments('id').primary()
      table.integer('eventId').unsigned().notNullable().references('id').inTable('chronicleEvents').onDelete('CASCADE')
      table.integer('eraMapId').unsigned().notNullable().references('id').inTable('chronicleEraMaps').onDelete('CASCADE')
      table.float('lat').nullable()
      table.float('lng').nullable()
      table.float('mapX').nullable()
      table.float('mapY').nullable()
      table.unique(['eventId', 'eraMapId'])
    })
    .createTable('chronicleVisibilityOverrides', table => {
      table.increments('id').primary()
      table.integer('eventId').unsigned().notNullable().references('id').inTable('chronicleEvents').onDelete('CASCADE')
      table.integer('eraMapId').unsigned().notNullable().references('id').inTable('chronicleEraMaps').onDelete('CASCADE')
      table.string('mode', 16).notNullable()
      table.unique(['eventId', 'eraMapId'])
    })

  const guests = await knex('groups').where('name', 'Guests').first()
  if (guests) {
    let permissions = guests.permissions
    if (typeof permissions === 'string') {
      permissions = JSON.parse(permissions)
    }
    if (!permissions.includes('read:chronicles')) {
      permissions.push('read:chronicles')
      await knex('groups').where('id', guests.id).update({
        permissions: JSON.stringify(permissions),
        updatedAt: new Date().toISOString()
      })
    }
  }
}

exports.down = async knex => {
  await knex.schema
    .dropTableIfExists('chronicleVisibilityOverrides')
    .dropTableIfExists('chroniclePinOverrides')
    .dropTableIfExists('chronicleEventPages')
    .dropTableIfExists('chronicleEventTags')
    .dropTableIfExists('chronicleEvents')
    .dropTableIfExists('chronicleEraMaps')
    .dropTableIfExists('chronicleTags')
    .dropTableIfExists('chronicles')
}
