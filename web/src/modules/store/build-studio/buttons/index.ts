// Stand-in for base-app/src/build-studio/buttons: the site-builder's social buttons
// (rating, like, reaction, share, view tracker) are not part of this app. ProductComments —
// the product reviews — is base-app's own, ported (./product-comments).
export { ProductComments } from './product-comments';
const None = (_props: any) => null;
export const ButtonRating = None, ButtonLike = None, ButtonReaction = None, ButtonSocialShare = None, ViewTracker = None;
