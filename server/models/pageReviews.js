const Model = require('objection').Model
const _ = require('lodash')
const validate = require('validate.js')
const pageHelper = require('../helpers/page')
const ipHelper = require('../helpers/ip')
const guestRateLimit = require('../helpers/guestRateLimit')

/* global WIKI */

/**
 * Page Reviews model — pending publish workflow
 */
module.exports = class PageReview extends Model {
  static get tableName() { return 'pageReviews' }

  static get jsonAttributes() {
    return ['tags']
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['path', 'title', 'content', 'changeReason', 'authorId', 'localeCode', 'editorKey', 'contentType'],
      properties: {
        id: { type: 'integer' },
        pageId: { type: ['integer', 'null'] },
        localeCode: { type: 'string' },
        path: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        content: { type: 'string' },
        contentType: { type: 'string' },
        editorKey: { type: 'string' },
        changeReason: { type: 'string' },
        status: { type: 'string' },
        pendingKey: { type: ['string', 'null'] },
        gitBranch: { type: ['string', 'null'] },
        authorId: { type: 'integer' },
        authorIp: { type: 'string' },
        guestName: { type: 'string' },
        guestEmail: { type: 'string' },
        reviewerId: { type: ['integer', 'null'] },
        reviewerComment: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        reviewedAt: { type: ['string', 'null'] }
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageReviews.authorId',
          to: 'users.id'
        }
      },
      reviewer: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageReviews.reviewerId',
          to: 'users.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'pageReviews.pageId',
          to: 'pages.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Sanitize free-text fields
   */
  static sanitizeText(value, maxLen) {
    const cleaned = _.trim(_.toString(value || '')).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    return cleaned.substring(0, maxLen)
  }

  static buildPendingKey(localeCode, path) {
    return `${localeCode}:${path}`
  }

  static normalizePath(rawPath) {
    let path = _.toString(rawPath || '')
    if (path.includes('.') || path.includes(' ') || path.includes('\\') || path.includes('//')) {
      throw new WIKI.Error.PageIllegalPath()
    }
    if (path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    if (path.startsWith('/')) {
      path = path.slice(1)
    }
    return path
  }

  /**
   * Guest authors all share authorId = 2 — own by guestEmail + authorIp.
   * Logged-in users own by authorId only.
   */
  static isSameAuthor(review, { user, ip, guestEmail } = {}) {
    if (!review || !user) {
      return false
    }
    if (user.id !== 2) {
      return review.authorId === user.id
    }
    if (review.authorId !== 2) {
      return false
    }
    const email = _.toLower(_.trim(guestEmail || ''))
    const reviewEmail = _.toLower(_.trim(review.guestEmail || ''))
    if (!email || !reviewEmail || email !== reviewEmail) {
      return false
    }
    return ipHelper.normalizeIp(review.authorIp) === ipHelper.normalizeIp(ip)
  }

  /**
   * Submit or update a pending review
   */
  static async submit(opts) {
    const user = opts.user
    const path = this.normalizePath(opts.path)
    const locale = opts.locale
    const pageArgs = { locale, path }

    guestRateLimit.consume({ user, ip: opts.ip, action: 'pageWrite' })

    if (!locale || !_.isString(locale)) {
      throw new WIKI.Error.PageIllegalPath()
    }

    if (pageHelper.isReservedPath(path)) {
      throw new WIKI.Error.PageIllegalPath()
    }

    if (!WIKI.auth.checkAccess(user, ['write:pages:pending'], pageArgs)) {
      throw new WIKI.Error.PageReviewForbidden()
    }
    // Direct publishers should use create/update, not reviews (Guests always use reviews)
    if (user.id !== 2 && WIKI.auth.checkAccess(user, ['write:pages'], pageArgs) && !opts.forcePending) {
      throw new WIKI.Error.PageReviewForbidden()
    }

    if (!opts.content || _.trim(opts.content).length < 1) {
      throw new WIKI.Error.PageEmptyContent()
    }

    const editor = _.find(WIKI.data.editors, ['key', opts.editor])
    if (!editor) {
      throw new WIKI.Error.PageGenericError()
    }

    const changeReason = this.sanitizeText(opts.changeReason, 500)
    if (!changeReason || changeReason.length < 1) {
      throw new WIKI.Error.PageReviewInvalidReason()
    }

    let guestName = ''
    let guestEmail = ''
    if (user.id === 2) {
      guestName = this.sanitizeText(opts.guestName, 255)
      guestEmail = _.toLower(_.trim(opts.guestEmail || ''))
      const validation = validate({
        email: guestEmail,
        name: guestName
      }, {
        email: {
          email: true,
          length: { maximum: 255 }
        },
        name: {
          presence: { allowEmpty: false },
          length: { minimum: 2, maximum: 255 }
        }
      }, { format: 'flat' })
      if (validation && validation.length > 0) {
        throw new WIKI.Error.InputInvalid(validation[0])
      }
    }

    // Strip elevated script fields unless user also has those perms
    let scriptCss = ''
    if (WIKI.auth.checkAccess(user, ['write:styles'], pageArgs) && !_.isEmpty(opts.scriptCss)) {
      scriptCss = opts.scriptCss
    }
    let scriptJs = ''
    if (WIKI.auth.checkAccess(user, ['write:scripts'], pageArgs)) {
      scriptJs = opts.scriptJs || ''
    }

    const contentType = _.get(editor, 'contentType', 'text')
    const tags = Array.isArray(opts.tags) ? opts.tags.filter(t => _.isString(t)).slice(0, 50) : []
    const pendingKey = this.buildPendingKey(locale, path)
    const isPublished = opts.isPublished === true || opts.isPublished === 1 || opts.isPublished === 'true'

    const existingPage = await WIKI.models.pages.query()
      .select('id')
      .where({ localeCode: locale, path })
      .first()

    const existingPending = await WIKI.models.pageReviews.query()
      .where({ pendingKey, status: 'pending' })
      .first()

    if (existingPending && !this.isSameAuthor(existingPending, {
      user,
      ip: opts.ip,
      guestEmail
    })) {
      throw new WIKI.Error.PageReviewConflict()
    }

    const payload = {
      pageId: existingPage ? existingPage.id : null,
      localeCode: locale,
      path,
      title: this.sanitizeText(opts.title, 255) || 'Untitled',
      description: this.sanitizeText(opts.description, 255),
      content: opts.content,
      contentType,
      editorKey: opts.editor,
      tags,
      scriptCss,
      scriptJs,
      isPublished,
      publishStartDate: opts.publishStartDate || '',
      publishEndDate: opts.publishEndDate || '',
      changeReason,
      status: 'pending',
      pendingKey,
      authorId: user.id,
      authorIp: ipHelper.normalizeIp(opts.ip),
      guestName,
      guestEmail,
      reviewerId: null,
      reviewerComment: null,
      reviewedAt: null
    }

    let review
    try {
      if (existingPending) {
        // Delete old draft branch before replacing
        if (existingPending.gitBranch) {
          await this.safeDeleteGitBranch(existingPending.gitBranch)
        }
        await WIKI.models.pageReviews.query().findById(existingPending.id).patch({
          ...payload,
          gitBranch: null
        })
        review = await WIKI.models.pageReviews.query().findById(existingPending.id)
      } else {
        review = await WIKI.models.pageReviews.query().insertAndFetch(payload)
      }
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505' || /unique/i.test(err.message || '')) {
        throw new WIKI.Error.PageReviewConflict()
      }
      throw err
    }

    // Best-effort git draft
    try {
      const gitBranch = await this.pushGitDraft(review, user)
      if (gitBranch) {
        await WIKI.models.pageReviews.query().findById(review.id).patch({ gitBranch })
        review.gitBranch = gitBranch
      }
    } catch (err) {
      WIKI.logger.warn('(PAGE-REVIEW) Git draft push failed (DB review kept):')
      WIKI.logger.warn(err)
    }

    return review
  }

  /**
   * Count pending reviews visible to the given approver
   */
  static async countPendingForUser(user) {
    const pending = await WIKI.models.pageReviews.query()
      .select('localeCode', 'path')
      .where('status', 'pending')

    if (WIKI.auth.checkAccess(user, ['manage:system'])) {
      return pending.length
    }

    return pending.filter(r => WIKI.auth.checkAccess(user, ['approve:pages'], {
      locale: r.localeCode,
      path: r.path
    })).length
  }

  /**
   * List reviews (approvers only; filtered by pageRules in caller if needed)
   */
  static async list({ status = 'pending', limit = 50, offset = 0 } = {}) {
    const q = WIKI.models.pageReviews.query()
      .withGraphFetched('[author, reviewer]')
      .orderBy('updatedAt', 'desc')
      .limit(Math.min(limit, 100))
      .offset(offset)

    if (status && status !== 'all') {
      q.where('status', status)
    }

    return q
  }

  /**
   * Load a single review with access check
   */
  static async getAccessible(id, user, { ip, guestEmail } = {}) {
    const review = await WIKI.models.pageReviews.query()
      .findById(id)
      .withGraphFetched('[author, reviewer]')
    if (!review) {
      throw new WIKI.Error.PageReviewNotFound()
    }

    const pageArgs = { locale: review.localeCode, path: review.path }
    const isAuthor = this.isSameAuthor(review, { user, ip, guestEmail })
    const canApprove = WIKI.auth.checkAccess(user, ['approve:pages'], pageArgs)

    if (!isAuthor && !canApprove) {
      throw new WIKI.Error.PageReviewForbidden()
    }

    return review
  }

  /**
   * Approve a pending review and publish to live pages
   */
  static async approve(opts) {
    const user = opts.user
    const review = await WIKI.models.pageReviews.query().findById(opts.id)
    if (!review) {
      throw new WIKI.Error.PageReviewNotFound()
    }
    if (review.status !== 'pending') {
      throw new WIKI.Error.PageReviewInvalidState()
    }

    const pageArgs = { locale: review.localeCode, path: review.path }
    if (!WIKI.auth.checkAccess(user, ['approve:pages'], pageArgs)) {
      throw new WIKI.Error.PageReviewForbidden()
    }

    const isSystem = WIKI.auth.checkAccess(user, ['manage:system'])
    if (this.isSameAuthor(review, { user, ip: opts.ip, guestEmail: opts.guestEmail }) && !isSystem) {
      throw new WIKI.Error.PageReviewSelfApprovalDenied()
    }

    const author = await WIKI.models.users.query().findById(review.authorId)
    if (!author) {
      throw new WIKI.Error.UserNotFound()
    }

    const reviewerComment = this.sanitizeText(opts.comment, 2000) || null
    const reviewedAt = new Date().toISOString()

    // Claim first so concurrent approvers cannot both publish
    const claimed = await WIKI.models.pageReviews.query()
      .where({ id: review.id, status: 'pending' })
      .patch({
        status: 'approved',
        pendingKey: null,
        reviewerId: user.id,
        reviewerComment,
        reviewedAt
      })
    if (!claimed) {
      throw new WIKI.Error.PageReviewInvalidState()
    }

    const pageOpts = {
      content: review.content,
      description: review.description,
      editor: review.editorKey,
      isPrivate: false,
      isPublished: review.isPublished === true || review.isPublished === 1,
      locale: review.localeCode,
      path: review.path,
      publishEndDate: review.publishEndDate || '',
      publishStartDate: review.publishStartDate || '',
      scriptCss: review.scriptCss,
      scriptJs: review.scriptJs,
      tags: review.tags || [],
      title: review.title,
      user,
      fromReviewApproval: true,
      authorId: author.id,
      guestName: review.guestName || '',
      guestEmail: review.guestEmail || '',
      authorIp: review.authorIp || ''
    }

    try {
      // Always resolve the live page by path — pageId may be stale/null
      const livePage = await WIKI.models.pages.query()
        .select('id')
        .where({ localeCode: review.localeCode, path: review.path })
        .first()

      let page
      if (livePage) {
        page = await WIKI.models.pages.updatePage({
          ...pageOpts,
          id: livePage.id
        })
      } else {
        page = await WIKI.models.pages.createPage(pageOpts)
      }

      await WIKI.models.pageReviews.query().findById(review.id).patch({
        pageId: page.id
      })

      if (review.gitBranch) {
        await this.safeDeleteGitBranch(review.gitBranch)
        await WIKI.models.pageReviews.query().findById(review.id).patch({ gitBranch: null })
      }
    } catch (err) {
      await WIKI.models.pageReviews.query().findById(review.id).patch({
        status: 'pending',
        pendingKey: this.buildPendingKey(review.localeCode, review.path),
        reviewerId: null,
        reviewerComment: null,
        reviewedAt: null
      })
      throw err
    }

    return WIKI.models.pageReviews.query().findById(review.id).withGraphFetched('[author, reviewer]')
  }

  /**
   * Reject a pending review
   */
  static async reject(opts) {
    const user = opts.user
    const review = await WIKI.models.pageReviews.query().findById(opts.id)
    if (!review) {
      throw new WIKI.Error.PageReviewNotFound()
    }
    if (review.status !== 'pending') {
      throw new WIKI.Error.PageReviewInvalidState()
    }

    const pageArgs = { locale: review.localeCode, path: review.path }
    if (!WIKI.auth.checkAccess(user, ['approve:pages'], pageArgs)) {
      throw new WIKI.Error.PageReviewForbidden()
    }

    const isSystem = WIKI.auth.checkAccess(user, ['manage:system'])
    if (this.isSameAuthor(review, { user, ip: opts.ip, guestEmail: opts.guestEmail }) && !isSystem) {
      throw new WIKI.Error.PageReviewSelfApprovalDenied()
    }

    const reviewerComment = this.sanitizeText(opts.comment, 2000) || null
    const claimed = await WIKI.models.pageReviews.query()
      .where({ id: review.id, status: 'pending' })
      .patch({
        status: 'rejected',
        pendingKey: null,
        reviewerId: user.id,
        reviewerComment,
        reviewedAt: new Date().toISOString()
      })
    if (!claimed) {
      throw new WIKI.Error.PageReviewInvalidState()
    }

    if (review.gitBranch) {
      await this.safeDeleteGitBranch(review.gitBranch)
      await WIKI.models.pageReviews.query().findById(review.id).patch({ gitBranch: null })
    }

    return WIKI.models.pageReviews.query().findById(review.id).withGraphFetched('[author, reviewer]')
  }

  /**
   * Author withdraws their own pending review
   */
  static async withdraw(opts) {
    const user = opts.user
    const review = await WIKI.models.pageReviews.query().findById(opts.id)
    if (!review) {
      throw new WIKI.Error.PageReviewNotFound()
    }
    if (review.status !== 'pending') {
      throw new WIKI.Error.PageReviewInvalidState()
    }
    if (!this.isSameAuthor(review, {
      user,
      ip: opts.ip,
      guestEmail: opts.guestEmail
    })) {
      throw new WIKI.Error.PageReviewForbidden()
    }

    const claimed = await WIKI.models.pageReviews.query()
      .where({ id: review.id, status: 'pending' })
      .patch({
        status: 'rejected',
        pendingKey: null,
        reviewerId: user.id,
        reviewerComment: 'Withdrawn by author',
        reviewedAt: new Date().toISOString()
      })
    if (!claimed) {
      throw new WIKI.Error.PageReviewInvalidState()
    }

    if (review.gitBranch) {
      await this.safeDeleteGitBranch(review.gitBranch)
      await WIKI.models.pageReviews.query().findById(review.id).patch({ gitBranch: null })
    }

    return WIKI.models.pageReviews.query().findById(review.id)
  }

  /**
   * Get pending review for a path owned by user (for editor resume)
   */
  static async getOwnPending({ locale, path, userId, ip, guestEmail }) {
    const pendingKey = this.buildPendingKey(locale, path)
    const pending = await WIKI.models.pageReviews.query()
      .where({ pendingKey, status: 'pending', authorId: userId })
      .first()
    if (!pending) {
      return null
    }
    if (userId === 2 && !this.isSameAuthor(pending, {
      user: { id: 2 },
      ip,
      guestEmail
    })) {
      return null
    }
    return pending
  }

  /**
   * Get any pending review for a path (for pending preview page)
   */
  static async getPendingByPath({ locale, path }) {
    const pendingKey = this.buildPendingKey(locale, this.normalizePath(path))
    return WIKI.models.pageReviews.query()
      .where({ pendingKey, status: 'pending' })
      .withGraphFetched('author')
      .first()
  }

  static getGitTarget() {
    return _.find(WIKI.models.storage.targets, t => t.key === 'git' && t.isEnabled !== false && t.fn)
  }

  static async pushGitDraft(review, user) {
    const target = this.getGitTarget()
    if (!target || !_.isFunction(target.fn.pushReviewDraft)) {
      return null
    }

    const authorName = user.name || user.email || 'Wiki User'
    const authorEmail = user.email || 'wiki@localhost'
    return target.fn.pushReviewDraft({
      userId: user.id,
      path: review.path,
      localeCode: review.localeCode,
      title: review.title,
      description: review.description,
      content: review.content,
      contentType: review.contentType,
      editorKey: review.editorKey,
      isPublished: review.isPublished,
      tags: (review.tags || []).map(t => (_.isString(t) ? { tag: t } : t)),
      authorName,
      authorEmail,
      message: review.changeReason,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt
    })
  }

  static async safeDeleteGitBranch(branch) {
    try {
      const target = this.getGitTarget()
      if (target && _.isFunction(target.fn.deleteReviewBranch)) {
        await target.fn.deleteReviewBranch(branch)
      }
    } catch (err) {
      WIKI.logger.warn(`(PAGE-REVIEW) Failed to delete git branch ${branch}:`)
      WIKI.logger.warn(err)
    }
  }
}
