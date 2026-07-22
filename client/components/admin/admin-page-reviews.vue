<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Reviews', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Page Reviews
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Approve or reject pending page changes
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(icon, color='grey', outlined, @click='refresh')
            v-icon.grey--text mdi-refresh
        v-card.mt-3.animated.fadeInUp
          .pa-2.d-flex.align-center(:class='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-3`')
            v-btn-toggle(v-model='statusFilter', mandatory, dense)
              v-btn(value='pending', small) Pending
              v-btn(value='approved', small) Approved
              v-btn(value='rejected', small) Rejected
              v-btn(value='all', small) All
            v-spacer
            v-text-field(
              solo
              flat
              v-model='search'
              prepend-inner-icon='mdi-magnify'
              label='Search...'
              hide-details
              dense
              style='max-width: 320px;'
            )
          v-divider
          v-data-table(
            :items='filteredReviews'
            :headers='headers'
            :search='search'
            :loading='loading'
            hide-default-footer
            :items-per-page='20'
          )
            template(slot='item', slot-scope='props')
              tr.is-clickable(@click='openReview(props.item)')
                td {{ props.item.id }}
                td
                  .body-2: strong {{ props.item.title }}
                  .caption {{ props.item.changeReason }}
                td
                  v-chip(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
                  span.ml-2 {{ props.item.path }}
                td {{ props.item.authorName || props.item.authorId }}
                td
                  v-chip(small, :color='statusColor(props.item.status)', dark) {{ props.item.status }}
                td {{ props.item.updatedAt | moment('calendar') }}
            template(slot='no-data')
              v-alert.ma-3(icon='mdi-inbox', :value='true', outlined) No reviews to display.

    v-dialog(v-model='dialog', max-width='960', scrollable)
      v-card(v-if='selected')
        v-card-title
          span Review #{{ selected.id }} — {{ selected.title }}
          v-spacer
          v-chip(small, :color='statusColor(selected.status)', dark) {{ selected.status }}
        v-divider
        v-card-text
          .mb-3
            .caption.grey--text Author
            .body-1 {{ selected.authorName }} ({{ selected.authorEmail }})
          .mb-3
            .caption.grey--text Path
            .body-1 /{{ selected.locale }}/{{ selected.path }}
          .mb-3
            .caption.grey--text Change reason
            .body-1 {{ selected.changeReason }}
          .mb-3(v-if='selected.gitBranch')
            .caption.grey--text Git branch
            code {{ selected.gitBranch }}
          v-tabs(v-model='tab')
            v-tab Proposed
            v-tab(v-if='selected.liveContent != null') Current live
            v-tab-item
              pre.review-content {{ selected.content }}
            v-tab-item(v-if='selected.liveContent != null')
              pre.review-content {{ selected.liveContent }}
          v-textarea.mt-4(
            v-if='selected.status === `pending`'
            v-model='reviewComment'
            label='Reviewer comment (optional)'
            outlined
            rows='2'
            counter='2000'
          )
        v-divider
        v-card-actions(v-if='selected.status === `pending`')
          v-btn(text, color='error', :loading='acting', @click='reject') Reject
          v-spacer
          v-btn(text, @click='dialog = false') Close
          v-btn(color='primary', depressed, :loading='acting', @click='approve') Approve
        v-card-actions(v-else)
          v-spacer
          v-btn(text, @click='dialog = false') Close
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const LIST_QUERY = gql`
  query ($status: PageReviewStatus) {
    pageReviews {
      list(status: $status) {
        id
        pageId
        locale
        path
        title
        changeReason
        status
        gitBranch
        authorId
        authorName
        updatedAt
        createdAt
      }
    }
  }
`

const SINGLE_QUERY = gql`
  query ($id: Int!) {
    pageReviews {
      single(id: $id) {
        id
        pageId
        locale
        path
        title
        description
        content
        liveContent
        changeReason
        status
        gitBranch
        authorId
        authorName
        authorEmail
        reviewerName
        reviewerComment
        updatedAt
        createdAt
        reviewedAt
      }
    }
  }
`

export default {
  data() {
    return {
      loading: false,
      acting: false,
      reviews: [],
      search: '',
      statusFilter: 'pending',
      dialog: false,
      selected: null,
      reviewComment: '',
      tab: 0,
      headers: [
        { text: 'ID', value: 'id', width: 80 },
        { text: 'Title', value: 'title' },
        { text: 'Path', value: 'path' },
        { text: 'Author', value: 'authorName', width: 160 },
        { text: 'Status', value: 'status', width: 120 },
        { text: 'Updated', value: 'updatedAt', width: 180 }
      ]
    }
  },
  computed: {
    filteredReviews() {
      return this.reviews
    }
  },
  watch: {
    statusFilter() {
      this.refresh()
    }
  },
  mounted() {
    this.refresh()
  },
  methods: {
    statusColor(status) {
      switch (status) {
        case 'pending': return 'orange darken-2'
        case 'approved': return 'green darken-2'
        case 'rejected': return 'red darken-2'
        default: return 'grey'
      }
    },
    async refresh() {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
          query: LIST_QUERY,
          variables: { status: this.statusFilter },
          fetchPolicy: 'network-only'
        })
        this.reviews = _.get(resp, 'data.pageReviews.list', [])
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    },
    async openReview(item) {
      try {
        const resp = await this.$apollo.query({
          query: SINGLE_QUERY,
          variables: { id: item.id },
          fetchPolicy: 'network-only'
        })
        this.selected = _.get(resp, 'data.pageReviews.single', null)
        this.reviewComment = ''
        this.tab = 0
        this.dialog = true
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
    },
    async approve() {
      this.acting = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $comment: String) {
              pageReviews {
                approve(id: $id, comment: $comment) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: this.selected.id, comment: this.reviewComment || null }
        })
        const result = _.get(resp, 'data.pageReviews.approve.responseResult', {})
        if (result.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Review approved and published',
            style: 'success',
            icon: 'check'
          })
          this.dialog = false
          this.refresh()
        } else {
          throw new Error(result.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.acting = false
    },
    async reject() {
      this.acting = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $comment: String) {
              pageReviews {
                reject(id: $id, comment: $comment) {
                  responseResult {
                    succeeded
                    message
                  }
                }
              }
            }
          `,
          variables: { id: this.selected.id, comment: this.reviewComment || null }
        })
        const result = _.get(resp, 'data.pageReviews.reject.responseResult', {})
        if (result.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Review rejected',
            style: 'success',
            icon: 'check'
          })
          this.dialog = false
          this.refresh()
        } else {
          throw new Error(result.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.acting = false
    }
  }
}
</script>

<style scoped>
.review-content {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 420px;
  overflow: auto;
  padding: 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  font-size: 13px;
}
</style>
