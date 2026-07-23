<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark', :class='$vuetify.rtl ? `is-rtl` : `is-ltr`')
    nav-header
    v-main
      v-alert.mb-0(
        color='orange darken-2'
        dark
        dense
        tile
        icon='mdi-file-clock-outline'
        )
        .d-flex.align-center.flex-wrap
          .body-2.mr-3 {{ bannerMessage }}
          v-chip.ml-2(x-small, outlined) {{ status }}
          v-spacer
          v-btn.mr-2(
            v-if='hasLivePageBool'
            :href='`/${locale}/${path}`'
            small
            depressed
            color='white'
            light
            )
            v-icon(left, small) mdi-eye
            span.text-none View live
          v-btn.mr-2(
            v-if='isAuthorBool'
            :href='`/e/${locale}/${path}`'
            small
            depressed
            color='white'
            light
            )
            v-icon(left, small) mdi-pencil
            span.text-none Edit
          v-btn.mr-2(
            v-if='canApproveBool'
            href='/a/page-reviews'
            small
            depressed
            color='white'
            light
            )
            v-icon(left, small) mdi-file-check-outline
            span.text-none Review
          v-btn(
            href='/'
            small
            text
            dark
            )
            v-icon(left, small) mdi-home
            span.text-none Home

      v-container.grey.pa-0(fluid, :class='$vuetify.theme.dark ? `darken-4-l3` : `lighten-4`')
        v-row.page-header-section(no-gutters, align-content='center', style='min-height: 90px;')
          v-col.page-col-content.is-page-header.pl-4(style='margin-top: auto; margin-bottom: auto;')
            .page-header-headings
              .headline.grey--text(:class='$vuetify.theme.dark ? `text--lighten-2` : `text--darken-3`') {{ title }}
              .caption.grey--text.text--darken-1(v-if='description') {{ description }}
            .caption.grey--text.mt-2
              span /{{ locale }}/{{ path }}
              span.mx-2 ·
              span {{ authorName }}
              span(v-if='authorEmail')  ({{ authorEmail }})
              span.mx-2(v-if='canApproveBool && authorIp') ·
              code(v-if='canApproveBool && authorIp') {{ authorIp }}
            .caption.orange--text.text--darken-2.mt-1(v-if='changeReason')
              strong Reason:
              span.ml-1 {{ changeReason }}

      v-container.pa-0(fluid, grid-list-xl)
        v-layout(row)
          v-flex.page-col-content.xs12
            .contents.pending-preview-contents
              slot(name='contents')

    nav-footer
    notify
</template>

<script>
export default {
  props: {
    reviewId: { type: Number, default: 0 },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    path: { type: String, default: '' },
    locale: { type: String, default: 'en' },
    changeReason: { type: String, default: '' },
    content: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    authorName: { type: String, default: '' },
    authorEmail: { type: String, default: '' },
    authorIp: { type: String, default: '' },
    createdAt: { type: String, default: '' },
    updatedAt: { type: String, default: '' },
    isAuthor: { type: [Boolean, String], default: false },
    canApprove: { type: [Boolean, String], default: false },
    hasLivePage: { type: [Boolean, String], default: false },
    effectivePermissions: { type: String, default: '' }
  },
  computed: {
    isAuthorBool () {
      return this.isAuthor === true || this.isAuthor === 'true'
    },
    canApproveBool () {
      return this.canApprove === true || this.canApprove === 'true'
    },
    hasLivePageBool () {
      return this.hasLivePage === true || this.hasLivePage === 'true'
    },
    bannerMessage () {
      return this.hasLivePageBool
        ? 'Proposed changes awaiting approval (preview — not live yet).'
        : 'This page is awaiting approval and is not published yet.'
    }
  },
  created () {
    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/title', this.title)
    this.$store.set('page/mode', 'view')
  }
}
</script>

<style lang='scss'>
.pending-preview-contents {
  padding: 24px 16px 48px;
  background: #fff;

  @at-root .theme--dark & {
    background: transparent;
  }

  img {
    max-width: 100%;
  }
}
</style>
