const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

function mapReview (review, liveContent = null, user = null) {
  if (!review) { return null }
  const ipHelper = require('../../helpers/ip')
  const revealFull = user && (
    WIKI.auth.checkAccess(user, ['manage:system']) ||
    WIKI.auth.checkAccess(user, ['approve:pages'], { locale: review.localeCode, path: review.path })
  )
  const rawIp = review.authorIp || ''
  return {
    id: review.id,
    pageId: review.pageId,
    locale: review.localeCode,
    path: review.path,
    title: review.title,
    description: review.description,
    content: review.content,
    contentType: review.contentType,
    editor: review.editorKey,
    tags: review.tags || [],
    scriptCss: review.scriptCss,
    scriptJs: review.scriptJs,
    isPublished: review.isPublished === true || review.isPublished === 1,
    publishStartDate: review.publishStartDate,
    publishEndDate: review.publishEndDate,
    changeReason: review.changeReason,
    status: review.status,
    gitBranch: review.gitBranch,
    authorId: review.authorId,
    authorName: review.guestName || _.get(review, 'author.name', null),
    authorEmail: review.guestEmail || _.get(review, 'author.email', null),
    authorIP: revealFull ? ipHelper.normalizeIp(rawIp) : null,
    authorIPMasked: revealFull ? ipHelper.maskIp(rawIp) : null,
    guestName: review.guestName || '',
    guestEmail: review.guestEmail || '',
    reviewerId: review.reviewerId,
    reviewerName: _.get(review, 'reviewer.name', null),
    reviewerComment: review.reviewerComment,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    reviewedAt: review.reviewedAt,
    liveContent
  }
}

module.exports = {
  Query: {
    async pageReviews() { return {} }
  },
  Mutation: {
    async pageReviews() { return {} }
  },
  PageReviewQuery: {
    async list(obj, args, context) {
      const reviews = await WIKI.models.pageReviews.list({
        status: args.status || 'pending',
        limit: args.limit || 50,
        offset: args.offset || 0
      })
      return reviews
        .filter(r => WIKI.auth.checkAccess(context.req.user, ['approve:pages'], {
          locale: r.localeCode,
          path: r.path
        }))
        .map(r => mapReview(r, null, context.req.user))
    },
    async pendingCount(obj, args, context) {
      return WIKI.models.pageReviews.countPendingForUser(context.req.user)
    },
    async single(obj, args, context) {
      const review = await WIKI.models.pageReviews.getAccessible(args.id, context.req.user)
      let liveContent = null
      if (review.pageId) {
        const page = await WIKI.models.pages.query().select('content').findById(review.pageId)
        liveContent = page ? page.content : null
      }
      return mapReview(review, liveContent, context.req.user)
    },
    async ownPending(obj, args, context) {
      const review = await WIKI.models.pageReviews.getOwnPending({
        locale: args.locale,
        path: args.path,
        userId: context.req.user.id
      })
      return mapReview(review, null, context.req.user)
    }
  },
  PageReviewMutation: {
    async submit(obj, args, context) {
      try {
        const review = await WIKI.models.pageReviews.submit({
          ...args,
          user: context.req.user,
          ip: context.req.ip
        })
        return {
          responseResult: graphHelper.generateSuccess('Page review submitted successfully'),
          review: mapReview(review, null, context.req.user)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async approve(obj, args, context) {
      try {
        const review = await WIKI.models.pageReviews.approve({
          id: args.id,
          comment: args.comment,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page review approved successfully'),
          review: mapReview(review, null, context.req.user)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async reject(obj, args, context) {
      try {
        const review = await WIKI.models.pageReviews.reject({
          id: args.id,
          comment: args.comment,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page review rejected successfully'),
          review: mapReview(review, null, context.req.user)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async withdraw(obj, args, context) {
      try {
        const review = await WIKI.models.pageReviews.withdraw({
          id: args.id,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page review withdrawn successfully'),
          review: mapReview(review, null, context.req.user)
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
