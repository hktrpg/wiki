exports.up = knex => {
  return knex.schema
    .alterTable('pageReviews', table => {
      table.string('guestName', 255).notNullable().defaultTo('')
      table.string('guestEmail', 255).notNullable().defaultTo('')
    })
    .alterTable('pages', table => {
      table.string('guestName', 255).notNullable().defaultTo('')
      table.string('guestEmail', 255).notNullable().defaultTo('')
      table.string('authorIp', 64).notNullable().defaultTo('')
    })
    .alterTable('pageHistory', table => {
      table.string('guestName', 255).notNullable().defaultTo('')
      table.string('guestEmail', 255).notNullable().defaultTo('')
      table.string('authorIp', 64).notNullable().defaultTo('')
    })
}

exports.down = knex => {
  return knex.schema
    .alterTable('pageReviews', table => {
      table.dropColumn('guestName')
      table.dropColumn('guestEmail')
    })
    .alterTable('pages', table => {
      table.dropColumn('guestName')
      table.dropColumn('guestEmail')
      table.dropColumn('authorIp')
    })
    .alterTable('pageHistory', table => {
      table.dropColumn('guestName')
      table.dropColumn('guestEmail')
      table.dropColumn('authorIp')
    })
}
