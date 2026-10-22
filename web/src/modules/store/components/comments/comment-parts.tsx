'use client';

// from base-app/src/components/comments/comment-parts.tsx — ported verbatim; only import paths rewired.

/**
 * The pieces every public comment widget shares — the blog's comments and the product
 * reviews keep their own look for the comment itself and use these for what sits around
 * it: the badges, Like · Reply · Edit · Delete · Report, one level of replies, and the
 * guest fields.
 *
 * Everything shown comes from the server: each comment's `view` (who wrote it, waiting,
 * what the caller can do), the list's `form` (whether and how the caller may post), and the
 * `notice` a post / edit / report answers with. Nothing here reads a status or a site rule.
 */

import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { BadgeCheck, ThumbsUp } from 'lucide-react';
import { getResponseErrorMessage } from '@/modules/store/lib-client/helpers';
import { activityService, ActivityOwner, Comment, CommentForm, CommentReportReason, CommentSaved } from '@/modules/store/services/activity-service';

export const signInHref = (): string =>
  typeof window !== 'undefined' ? `/login?redirect=${encodeURIComponent(window.location.pathname)}` : '/login';

export interface PostCommentInput {
  message: string;
  title?: string;
  rating?: number;
  parentComment?: string;
  name?: string;
  email?: string;
}

/** Posts a comment; answers the saved comment and the server's notice. Throws the server's plain message. */
export const postComment = async (owner: ActivityOwner, input: PostCommentInput): Promise<CommentSaved> => {
  try {
    return await activityService.createComment(owner, input.message, input.title, input.rating, input.parentComment, {
      name: input.name,
      email: input.email,
    });
  } catch (err: any) {
    throw new Error(getResponseErrorMessage(err, 'Your comment could not be posted. Try again.'));
  }
};

/** The listed comments plus the caller's just-posted ones the list doesn't carry yet. */
export const withMine = (list: Comment[], mine: Comment[]): Comment[] => {
  const listed = new Set(list.map((c) => String(c.sk)));
  return [...mine.filter((c) => !listed.has(String(c.sk))), ...list];
};

export const replaceComment = (list: Comment[], updated: Comment): Comment[] =>
  list.map((c) => (String(c.sk) === String(updated.sk) ? updated : c));

export const removeComment = (list: Comment[], commentId: string): Comment[] => list.filter((c) => String(c.sk) !== commentId);

// ---------- guest fields ----------

export interface GuestDetails {
  name: string;
  email: string;
}

/** The fields the server asks a guest for (`form.fields`, e.g. name + email). */
export const GuestFields: React.FC<{ fields?: string[]; value: GuestDetails; onChange: (v: GuestDetails) => void; className?: string }> = ({ fields = [], value, onChange, className }) => (
  <div className={className || 'mb-4 grid gap-3 sm:grid-cols-2'}>
    {fields.includes('name') && (
      <input
        type="text"
        name="name"
        required
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Your name"
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
    )}
    {fields.includes('email') && (
      <input
        type="email"
        name="email"
        required
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="Your email (not shown)"
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      />
    )}
  </div>
);

/** The guest fields the server asked for are filled in. */
export const guestComplete = (fields: string[] = [], g: GuestDetails) =>
  (!fields.includes('name') || !!g.name.trim()) && (!fields.includes('email') || !!g.email.trim());

/** What a guest sends with a post: only the fields the server asked for. */
export const guestPayload = (form: CommentForm | null | undefined, g: GuestDetails): { name?: string; email?: string } =>
  form?.mayPost === 'guest'
    ? { ...(form.fields?.includes('name') ? { name: g.name } : {}), ...(form.fields?.includes('email') ? { email: g.email } : {}) }
    : {};

// ---------- badges ----------

export const CommentBadges: React.FC<{ comment: Comment }> = ({ comment }) => {
  const v = comment?.view;
  if (!v) return null;
  return (
    <>
      {v.byBusiness && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
          Reply from {v.businessName}
        </span>
      )}
      {v.verifiedPurchase && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-200">
          <BadgeCheck className="h-3.5 w-3.5" />
          Verified purchase
        </span>
      )}
      {v.waiting && v.notice && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">{v.notice}</span>
      )}
      {v.edited && !v.waiting && <span className="text-xs text-gray-500 dark:text-gray-400">Edited</span>}
    </>
  );
};

// ---------- Like · Reply · Edit · Delete · Report + replies ----------

/** Used only when the server's form carries no `reportReasons`. */
const FALLBACK_REPORT_REASONS: { value: CommentReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'other', label: 'Other' },
];

const linkButton = 'text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100';
const smallInput = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';
const primaryButton = 'rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
const secondaryButton = 'rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200';

interface CommentExtrasProps {
  comment: Comment;
  /** What the comment is on (the post / product) — replies go on the same record. */
  owner: ActivityOwner;
  /** The list's server-built form — how the caller may post a reply. */
  form?: CommentForm | null;
  /** Top-level comments carry their replies (one level); replies don't. */
  allowReply?: boolean;
  /** The server answered the delete with removed — the list drops the row. */
  onDeleted?: (commentId: string) => void;
  /** The server saved an edit — the list shows the saved copy. */
  onEdited?: (updated: Comment) => void;
}

type Panel = 'reply' | 'report' | 'delete' | 'edit' | null;

/**
 * The row under a comment — the actions the server allows the caller (`view.can`) — with
 * the inline reply / edit / delete / report forms, and (top-level) its replies underneath.
 */
export const CommentExtras: React.FC<CommentExtrasProps> = ({ comment, owner, form, allowReply = true, onDeleted, onEdited }) => {
  const id = String(comment.sk);
  const view = comment.view;
  const can = view?.can;

  const [likes, setLikes] = useState<number>(Number(view?.likes) || 0);
  const [liked, setLiked] = useState<boolean>(!!view?.liked);
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [replies, setReplies] = useState<Comment[]>([]);
  const [myReplies, setMyReplies] = useState<Comment[]>([]);
  const [replyText, setReplyText] = useState('');
  const [guest, setGuest] = useState<GuestDetails>({ name: '', email: '' });
  const [editText, setEditText] = useState('');
  const [reason, setReason] = useState<CommentReportReason | ''>('');
  const [reportNote, setReportNote] = useState('');
  const [reportedNotice, setReportedNotice] = useState<string | null>(null);

  const replyCount = Number(view?.replyCount) || 0;
  const loadReplies = async () => {
    const r = await activityService.getReplies(id, { sort: 'oldest' });
    setReplies(Array.isArray(r?.data) ? r.data : []);
  };
  useEffect(() => {
    if (allowReply && id && replyCount > 0) loadReplies();
  }, [id, allowReply, replyCount]);

  const open = (p: Panel) => {
    setPanel((cur) => (cur === p ? null : p));
    setError(null);
  };

  const toggleLike = async () => {
    setError(null);
    const r = await activityService.toggleLike({ datatype: 'comment', id }, liked ? 'remove' : 'add');
    if (!r?.summary) {
      setError('Your like could not be saved. Try again.');
      return;
    }
    setLikes(Number(r.summary.likes) || 0);
    setLiked(!!r.summary.user?.liked);
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || (form?.mayPost === 'guest' && !guestComplete(form.fields, guest))) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const saved = await postComment(owner, { message: replyText.trim(), parentComment: id, ...guestPayload(form, guest) });
      setReplyText('');
      setPanel(null);
      if (saved?.notice) setNote(saved.notice);
      if (saved?.comment) setMyReplies((m) => [...m, saved.comment]);
      await loadReplies();
    } catch (err: any) {
      setError(err?.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim()) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const saved = await activityService.updateComment(id, { message: editText.trim() });
      setPanel(null);
      if (saved?.notice) setNote(saved.notice);
      if (saved?.comment) onEdited?.(saved.comment);
    } catch (err: any) {
      setError(getResponseErrorMessage(err, 'Your changes could not be saved. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await activityService.deleteComment(id);
      setPanel(null);
      if (r?.removed) onDeleted?.(id);
    } catch (err: any) {
      setError(getResponseErrorMessage(err, 'Your comment could not be deleted. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const r = await activityService.reportComment(id, reason, reportNote);
      setPanel(null);
      setReportedNotice(r?.notice || null);
    } catch (err: any) {
      setError(getResponseErrorMessage(err, 'Your report could not be sent. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  // The caller's just-posted replies sit after the listed ones until the list carries them.
  const shownReplies = [...replies, ...myReplies.filter((m) => !replies.some((c) => String(c.sk) === String(m.sk)))];
  const dropReply = (replyId: string) => {
    setReplies((l) => removeComment(l, replyId));
    setMyReplies((l) => removeComment(l, replyId));
  };
  const swapReply = (updated: Comment) => {
    setReplies((l) => replaceComment(l, updated));
    setMyReplies((l) => (l.some((c) => String(c.sk) === String(updated.sk)) ? replaceComment(l, updated) : [...l, updated]));
  };

  const hasActions = !!(can?.like || likes > 0 || (allowReply && can?.reply) || can?.edit || can?.delete || can?.report || reportedNotice);

  return (
    <div className="mt-3">
      {hasActions && (
        <div className="flex flex-wrap items-center gap-4">
          {can?.like ? (
            <button type="button" onClick={toggleLike} className={`${linkButton} inline-flex items-center gap-1 ${liked ? 'text-blue-600 dark:text-blue-400' : ''}`} aria-pressed={liked}>
              <ThumbsUp className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              {liked ? 'Liked' : 'Like'}
              {likes > 0 && <span>({likes})</span>}
            </button>
          ) : likes > 0 ? (
            <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <ThumbsUp className="h-4 w-4" />
              {likes}
            </span>
          ) : null}
          {allowReply && can?.reply && (
            <button type="button" onClick={() => open('reply')} className={linkButton}>
              Reply
            </button>
          )}
          {can?.edit && (
            <button type="button" onClick={() => { setEditText(comment?.data?.message || ''); open('edit'); }} className={linkButton}>
              Edit
            </button>
          )}
          {can?.delete && (
            <button type="button" onClick={() => open('delete')} className={linkButton}>
              Delete
            </button>
          )}
          {reportedNotice ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">{reportedNotice}</span>
          ) : can?.report ? (
            <button type="button" onClick={() => open('report')} className={linkButton}>
              Report
            </button>
          ) : null}
        </div>
      )}
      {note && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{note}</p>}
      {error && !panel && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {panel === 'edit' && (
        <form onSubmit={saveEdit} className="mt-3">
          <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} required className={`${smallInput} mb-3`} />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !editText.trim()} className={primaryButton}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setPanel(null)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === 'delete' && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-3 text-sm text-gray-900 dark:text-gray-100">Delete your comment? It will no longer show here.</p>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={confirmDelete} disabled={busy} className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={() => setPanel(null)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {panel === 'report' && (
        <form onSubmit={sendReport} className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">What's wrong with this comment?</p>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
            {(form?.reportReasons?.length ? form.reportReasons : FALLBACK_REPORT_REASONS).map((r) => (
              <label key={r.value} className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                <input type="radio" name={`report-${id}`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
          <textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} rows={2} placeholder="Add a note (optional)" className={`${smallInput} mb-3`} />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={!reason || busy} className={primaryButton}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" onClick={() => setPanel(null)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === 'reply' &&
        (form?.mayPost === 'sign_in' ? (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {form.signInMessage && <span className="mr-1">{form.signInMessage}</span>}
            <a href={signInHref()} className="font-medium text-blue-600 hover:underline">Sign in</a>
          </p>
        ) : (
          <form onSubmit={sendReply} className="mt-3">
            {form?.mayPost === 'guest' && <GuestFields fields={form.fields} value={guest} onChange={setGuest} className="mb-3 grid gap-3 sm:grid-cols-2" />}
            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Write your reply…" required className={`${smallInput} mb-3`} />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !replyText.trim() || (form?.mayPost === 'guest' && !guestComplete(form.fields, guest))} className={primaryButton}>
                {busy ? 'Posting…' : 'Post reply'}
              </button>
              <button type="button" onClick={() => setPanel(null)} className={secondaryButton}>
                Cancel
              </button>
            </div>
          </form>
        ))}

      {allowReply && shownReplies.length > 0 && (
        <div className="mt-4 space-y-4 border-l-2 border-gray-100 pl-4 dark:border-gray-700">
          {shownReplies.map((r) => (
            <div key={String(r.sk)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.view?.author}</span>
                <CommentBadges comment={r} />
                {r.createdate && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(r.createdate), { addSuffix: true })}</span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{r.data?.message}</p>
              <CommentExtras comment={r} owner={owner} form={form} allowReply={false} onDeleted={dropReply} onEdited={swapReply} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
