'use client';

// from base-app/src/services/activity-service.ts — ported verbatim; only import paths rewired.

import { getAppEngineClient } from '@/modules/store/lib/appmint-client';
import { API_ENDPOINTS } from '@/modules/store/lib/appmint-endpoints';

export interface ActivityOwner {
  datatype: string;
  id: string;
}

export interface ActivityPayload {
  author?: string;
  datatype: string;
  id: string;
  activityType: 'like' | 'dislike' | 'view' | 'share' | 'rating' | 'reaction';
  action: 'add' | 'remove' | 'update';
  value?: any;
}

export interface ActivitySummary {
  likes: number;
  dislikes: number;
  views: number;
  shares: number;
  bookmarks?: number;
  follows?: number;
  averageRating: number;
  ratingCount: number;
  reactions: Array<{ author: string; reaction: string; reacted_at: Date | string }>;
  reactionSummary?: { [type: string]: number };
  last_viewed?: string;
  last_activity?: string;
  user?: {
    liked?: boolean;
    disliked?: boolean;
    viewed?: boolean;
    shared?: boolean;
    bookmarked?: boolean;
    followed?: boolean;
    rating?: number;
    reaction?: string;
  };
}

export interface Note {
  author: string;
  comment: string;
  date: string;
}

export interface Comment {
  sk: string;
  /** Who wrote it (the record's author — a login). Show `view.author`, never this. */
  author: string;
  owner?: ActivityOwner;
  data: {
    message: string;
    title?: string;
    rating?: number;
    parentComment?: string | null;
    pinned?: boolean;
    page?: CommentPage;
    /** @deprecated retained for backward-compat with the old crm/comment/* API. */
    content?: string;
  };
  /** What a client shows for this comment — the server works all of it out for the caller. */
  view?: CommentView;
  createdate: string;
  modifydate?: string;
}

/** The server-built view of one comment for the person asking. */
export interface CommentView {
  /** The caller's own comment that isn't shown to others yet. */
  waiting: boolean;
  /** e.g. "Waiting for approval" / "Edited — waiting for approval". */
  notice?: string;
  /** The display name (never an email). */
  author: string;
  byBusiness: boolean;
  businessName?: string;
  verifiedPurchase: boolean;
  edited: boolean;
  replyCount: number;
  likes: number;
  liked: boolean;
  can: { reply: boolean; edit: boolean; delete: boolean; report: boolean; like: boolean };
}

/** The server-built comment form for the caller on this record. */
export interface CommentForm {
  open: boolean;
  closedMessage?: string;
  /** yes — the form; sign_in — a sign-in link; guest — the form with the guest `fields`. */
  mayPost: 'yes' | 'sign_in' | 'guest';
  signInMessage?: string;
  /** ['name', 'email'] for a guest. */
  fields?: string[];
  reviewsWithRating?: boolean;
  /** The reasons a caller may pick when reporting a comment. */
  reportReasons?: { value: CommentReportReason; label: string }[];
}

export interface CommentList {
  data: Comment[];
  total: number;
  approvedCount?: number;
  form?: CommentForm;
}

/** What a post or edit answers: the saved comment (with its view) and the message to show. */
export interface CommentSaved {
  comment: Comment;
  notice?: string | null;
}

/** The page a comment was written on. */
export interface CommentPage {
  path: string;
  url: string;
  title: string;
}

/** Extra fields on a new comment: a guest's name/email (when the site lets anyone comment), the reCAPTCHA token. */
export interface CommentPostExtras {
  name?: string;
  email?: string;
  recaptchaToken?: string;
  page?: CommentPage;
}

export type CommentReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export interface CommentListOptions {
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'top';
  /** Pass null to fetch only top-level (non-reply) comments. */
  parent?: string | null;
  includeHidden?: boolean;
}

class ActivityService {
  private client = getAppEngineClient();

  /**
   * Manage activity (like, dislike, rating, reaction, etc.)
   */
  async manageActivity(payload: ActivityPayload): Promise<{ message: string; summary: ActivitySummary }> {
    try {
      const result = await this.client.processRequest('post', API_ENDPOINTS.CRM_ACTIVITY_MANAGE, payload);
      return result;
    } catch (error) {
      console.error('Activity manage error:', error);
      throw error;
    }
  }

  /**
   * Get user's activities for a specific resource
   */
  async getUserActivities(owner: ActivityOwner): Promise<any> {
    try {
      const endpoint = `${API_ENDPOINTS.CRM_ACTIVITY_CUSTOMER_ACTIVITY}/${owner.datatype}/${owner.id}`;
      const result = await this.client.processRequest('get', endpoint);
      return result;
    } catch (error) {
      console.error('Get user activities error:', error);
      return null;
    }
  }

  /**
   * Get all activities for a resource
   */
  async getResourceActivities(owner: ActivityOwner): Promise<any> {
    try {
      const endpoint = `${API_ENDPOINTS.CRM_ACTIVITY_RESOURCE_ACTIVITY}/${owner.datatype}/${owner.id}`;
      const result = await this.client.processRequest('get', endpoint);
      return result;
    } catch (error) {
      console.error('Get resource activities error:', error);
      return { data: [] };
    }
  }

  /**
   * Create a comment on an item.
   * Uses the new `/comments/:datatype/:id` API. The `message` field is the
   * canonical body field; legacy callers may still pass `content`-shaped data
   * in `optional.body`, but new code should pass `message`.
   */
  async createComment(
    owner: ActivityOwner,
    message: string,
    title?: string,
    rating?: number,
    parentComment?: string,
    extras: CommentPostExtras = {},
  ): Promise<CommentSaved> {
    try {
      const endpoint = API_ENDPOINTS.COMMENTS_CREATE(owner.datatype, owner.id);
      const body: any = { message };
      if (title !== undefined) body.title = title;
      if (rating !== undefined) body.rating = rating;
      if (parentComment) body.parentComment = parentComment;
      // The page it was written on, so the business sees where the comment came from.
      const page = extras.page || (typeof window !== 'undefined'
        ? { path: window.location.pathname, url: window.location.href, title: document.title }
        : undefined);
      if (page) body.page = page;
      if (extras.name?.trim()) body.name = extras.name.trim();
      if (extras.email?.trim()) body.email = extras.email.trim();
      if (extras.recaptchaToken) body.recaptchaToken = extras.recaptchaToken;
      const result = await this.client.processRequest('post', endpoint, body);
      return result;
    } catch (error) {
      console.error('Create comment error:', error);
      throw error;
    }
  }

  /**
   * List comments for a resource.
   */
  async getComments(
    owner: ActivityOwner,
    options: CommentListOptions = {},
  ): Promise<CommentList> {
    try {
      const params = new URLSearchParams();
      params.set('p', String(options.page ?? 1));
      params.set('ps', String(options.pageSize ?? 50));
      if (options.sort) params.set('sort', options.sort);
      if (options.parent === null) params.set('parent', 'null');
      else if (options.parent) params.set('parent', options.parent);
      if (options.includeHidden) params.set('includeHidden', 'true');
      const endpoint = `${API_ENDPOINTS.COMMENTS_LIST(owner.datatype, owner.id)}?${params.toString()}`;
      const result = await this.client.processRequest('get', endpoint);
      return result;
    } catch (error) {
      console.error('Get comments error:', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * Update a comment's message / title / rating.
   */
  async updateComment(
    commentId: string,
    patch: { message?: string; title?: string; rating?: number },
  ): Promise<CommentSaved> {
    try {
      const endpoint = API_ENDPOINTS.COMMENTS_UPDATE(commentId);
      return await this.client.processRequest('put', endpoint, patch);
    } catch (error) {
      console.error('Update comment error:', error);
      throw error;
    }
  }

  /**
   * Delete a comment (author or staff). Answers `{ removed: true }` when it no longer shows.
   */
  async deleteComment(commentId: string): Promise<{ removed: boolean }> {
    try {
      const endpoint = API_ENDPOINTS.COMMENTS_DELETE(commentId);
      return await this.client.processRequest('delete', endpoint);
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  }

  /** Get a single comment by id. */
  async getComment(commentId: string): Promise<Comment | null> {
    try {
      return await this.client.processRequest('get', API_ENDPOINTS.COMMENTS_ONE(commentId));
    } catch (error) {
      console.error('Get comment error:', error);
      return null;
    }
  }

  /** List replies under a comment. */
  async getReplies(
    commentId: string,
    options: Omit<CommentListOptions, 'parent' | 'includeHidden'> = {},
  ): Promise<CommentList> {
    try {
      const params = new URLSearchParams();
      params.set('p', String(options.page ?? 1));
      params.set('ps', String(options.pageSize ?? 50));
      if (options.sort) params.set('sort', options.sort);
      const endpoint = `${API_ENDPOINTS.COMMENTS_REPLIES(commentId)}?${params.toString()}`;
      return await this.client.processRequest('get', endpoint);
    } catch (error) {
      console.error('Get replies error:', error);
      return { data: [], total: 0 };
    }
  }

  /** Pin or unpin a comment (moderation). */
  async pinComment(commentId: string, pinned = true): Promise<Comment | null> {
    try {
      return await this.client.processRequest('post', API_ENDPOINTS.COMMENTS_PIN(commentId), { pinned });
    } catch (error) {
      console.error('Pin comment error:', error);
      throw error;
    }
  }

  /** Change a comment's moderation status. */
  async setCommentStatus(commentId: string, status: string): Promise<Comment | null> {
    try {
      return await this.client.processRequest('post', API_ENDPOINTS.COMMENTS_STATUS(commentId), { status });
    } catch (error) {
      console.error('Set comment status error:', error);
      throw error;
    }
  }

  /** Report a comment. */
  async reportComment(commentId: string, reason: CommentReportReason, note?: string): Promise<{ notice?: string }> {
    try {
      const body: any = { reason };
      if (note?.trim()) body.note = note.trim();
      return await this.client.processRequest('post', API_ENDPOINTS.COMMENTS_REPORT(commentId), body);
    } catch (error) {
      console.error('Report comment error:', error);
      throw error;
    }
  }

  /** List comments authored by a user. */
  async getCommentsByAuthor(author: string, page = 1, pageSize = 50): Promise<{ data: Comment[]; total: number }> {
    try {
      const endpoint = `${API_ENDPOINTS.COMMENTS_BY_AUTHOR(author)}?p=${page}&ps=${pageSize}`;
      return await this.client.processRequest('get', endpoint);
    } catch (error) {
      console.error('Get comments by author error:', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * POST /stats/:datatype/:id/:signal — toggle/update a stats signal.
   * signal: like | dislike | bookmark | follow | rating | reaction | view | share
   */
  private async postSignal(
    owner: ActivityOwner,
    signal: string,
    body?: { action?: 'add' | 'remove' | 'update'; value?: any },
  ): Promise<{ message: string; summary: ActivitySummary } | null> {
    try {
      const endpoint = API_ENDPOINTS.STATS_SIGNAL(owner.datatype, owner.id, signal);
      return await this.client.processRequest('post', endpoint, body || {});
    } catch (error) {
      console.error(`Stats ${signal} error:`, error);
      return null;
    }
  }

  toggleLike(owner: ActivityOwner, action: 'add' | 'remove' = 'add') {
    return this.postSignal(owner, 'like', { action });
  }

  toggleDislike(owner: ActivityOwner, action: 'add' | 'remove' = 'add') {
    return this.postSignal(owner, 'dislike', { action });
  }

  toggleBookmark(owner: ActivityOwner, action: 'add' | 'remove' = 'add') {
    return this.postSignal(owner, 'bookmark', { action });
  }

  toggleFollow(owner: ActivityOwner, action: 'add' | 'remove' = 'add') {
    return this.postSignal(owner, 'follow', { action });
  }

  setRating(owner: ActivityOwner, value: number, action: 'add' | 'update' = 'add') {
    return this.postSignal(owner, 'rating', { action, value });
  }

  setReaction(owner: ActivityOwner, value: string, action: 'add' | 'update' | 'remove' = 'add') {
    return this.postSignal(owner, 'reaction', { action, value });
  }

  /** Anonymous counter bump — call once when content is confirmed visible. */
  recordView(owner: ActivityOwner) {
    return this.postSignal(owner, 'view');
  }

  /** Anonymous counter bump — call on actual share action. */
  recordShare(owner: ActivityOwner) {
    return this.postSignal(owner, 'share');
  }

  /** GET /stats/:datatype/:id — full summary (+ user block when authed). */
  async getStats(owner: ActivityOwner): Promise<ActivitySummary | null> {
    try {
      const endpoint = API_ENDPOINTS.STATS_GET(owner.datatype, owner.id);
      const result = await this.client.processRequest('get', endpoint);
      return result?.summary || result || null;
    } catch (error) {
      console.error('Get stats error:', error);
      return null;
    }
  }

  /** POST /notes/:datatype/:id — append a note. */
  async addNote(owner: ActivityOwner, comment: string): Promise<Note | null> {
    if (!comment?.trim()) return null;
    try {
      const endpoint = API_ENDPOINTS.NOTES(owner.datatype, owner.id);
      return await this.client.processRequest('post', endpoint, { comment });
    } catch (error) {
      console.error('Add note error:', error);
      throw error;
    }
  }

  /** GET /notes/:datatype/:id — list notes (oldest → newest). */
  async getNotes(owner: ActivityOwner): Promise<Note[]> {
    try {
      const endpoint = API_ENDPOINTS.NOTES(owner.datatype, owner.id);
      const result = await this.client.processRequest('get', endpoint);
      return Array.isArray(result) ? result : result?.data || [];
    } catch (error) {
      console.error('Get notes error:', error);
      return [];
    }
  }
}

export const activityService = new ActivityService();
