'use client';

// from base-app/src/build-studio/buttons/product-comments.tsx — ported verbatim; only import paths rewired.

import React, { useState, useEffect } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { activityService, ActivityOwner, Comment, CommentForm } from '@/modules/store/services/activity-service';
import {
  CommentBadges,
  CommentExtras,
  GuestFields,
  GuestDetails,
  guestComplete,
  guestPayload,
  postComment,
  removeComment,
  replaceComment,
  signInHref,
  withMine,
} from '@/modules/store/components/comments/comment-parts';

interface ProductCommentsProps {
  owner?: ActivityOwner;
  productId?: string;
  initialComments?: Comment[];
}

/**
 * Reviews on a product (or comments on a post, same look): stars, title, message, badges,
 * Like · Reply · Edit · Delete · Report and one level of replies. The server decides
 * everything shown: the rows (each with its `view`) and the `form` — open or closed, the
 * form itself, guest fields, the star rating, or a sign-in link.
 */
export const ProductComments: React.FC<ProductCommentsProps> = ({ owner, productId, initialComments = [] }) => {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [mine, setMine] = useState<Comment[]>([]);
  const [form, setForm] = useState<CommentForm | null>(null);
  const [guest, setGuest] = useState<GuestDetails>({ name: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newRating, setNewRating] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    if (owner) {
      loadComments();
    }
  }, [owner]);

  const isGuest = form?.mayPost === 'guest';

  const loadComments = async () => {
    if (!owner) return;
    setIsLoading(true);
    try {
      const result = await activityService.getComments(owner, { parent: null });
      if (result?.data) {
        setComments(result.data);
      }
      setForm(result?.form || null);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !owner || (isGuest && !guestComplete(form?.fields, guest))) return;

    setPosting(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await postComment(owner, {
        message: newComment.trim(),
        title: newTitle.trim() || undefined,
        rating: form?.reviewsWithRating ? newRating || undefined : undefined,
        ...guestPayload(form, guest),
      });
      setNewComment('');
      setNewTitle('');
      setNewRating(0);
      setShowForm(false);
      if (saved?.notice) setNotice(saved.notice);
      if (saved?.comment) setMine((m) => [saved.comment, ...m]);
      await loadComments();
    } catch (err: any) {
      setError(err?.message);
    } finally {
      setPosting(false);
    }
  };

  const drop = (commentId: string) => {
    setComments((l) => removeComment(l, commentId));
    setMine((l) => removeComment(l, commentId));
  };
  const swap = (updated: Comment) => {
    setComments((l) => replaceComment(l, updated));
    setMine((l) => replaceComment(l, updated));
  };

  const shown = withMine(comments, mine);

  if (isLoading && shown.length === 0) {
    return null;
  }

  // Closed with nothing to show and nothing to say: no section at all.
  if (!form || (!form.open && !form.closedMessage && shown.length === 0)) return null;

  return (
    <div className="border-t pt-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">Reviews</h3>
        {!showForm && form.open && form.mayPost !== 'sign_in' && (
          <button
            onClick={() => { setShowForm(true); setNotice(null); }}
            className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-md transition-colors"
          >
            Write a Review
          </button>
        )}
        {!showForm && form.open && form.mayPost === 'sign_in' && (
          <a
            href={signInHref()}
            className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-md transition-colors"
          >
            Sign in to write a review
          </a>
        )}
      </div>

      {notice && <p className="mb-6 text-sm text-gray-700">{notice}</p>}
      {form.open && form.mayPost === 'sign_in' && form.signInMessage && <p className="mb-6 text-sm text-gray-500">{form.signInMessage}</p>}
      {!form.open && form.closedMessage && <p className="mb-6 text-sm text-gray-500">{form.closedMessage}</p>}

      {/* Review Form */}
      {showForm && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-lg font-medium mb-4">Write Your Review</h4>

          {isGuest && <GuestFields fields={form.fields} value={guest} onChange={setGuest} />}

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Review Title (Optional)</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Give your review a title"
            />
          </div>

          {/* Comment */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              placeholder="Share your experience with this product"
            />
          </div>

          {/* Rating */}
          {form.reviewsWithRating && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isHovered = hoverRating >= star;
                const isSelected = newRating >= star;
                const isActive = isHovered || isSelected;

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-all duration-200 hover:scale-125 focus:outline-none"
                  >
                    <IconRenderer
                      icon="Star"
                      className={`w-8 h-8 transition-colors ${
                        isActive
                          ? isHovered
                            ? 'fill-yellow-300 stroke-yellow-400'
                            : 'fill-yellow-400 stroke-yellow-500'
                          : 'fill-gray-200 stroke-gray-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSubmitComment}
              disabled={posting || !newComment.trim() || (isGuest && !guestComplete(form.fields, guest))}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {posting ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNewComment('');
                setNewTitle('');
                setNewRating(0);
                setError(null);
              }}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Comments List */}
      {shown.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {shown.map((comment) => (
            <div key={comment.sk} className="pb-6 border-b last:border-0">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-base font-semibold text-gray-700">
                  {(comment.view?.author || '').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <span className="font-semibold text-gray-900">{comment.view?.author}</span>
                    <CommentBadges comment={comment} />
                    {comment.data?.rating && (
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <IconRenderer
                            key={i}
                            icon="Star"
                            className={`w-4 h-4 ${i < comment.data.rating! ? 'fill-yellow-400 stroke-yellow-400' : 'fill-gray-200 stroke-gray-300'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {comment.createdate && (
                    <time className="text-xs text-gray-500 block mb-2">
                      {new Date(comment.createdate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </time>
                  )}
                  {comment.data?.title && <h4 className="font-semibold text-gray-900 mb-2">{comment.data.title}</h4>}
                  <p className="text-gray-700 text-sm leading-relaxed">{comment.data?.message || comment.data?.content}</p>
                  {owner && <CommentExtras comment={comment} owner={owner} form={form} onDeleted={drop} onEdited={swap} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
