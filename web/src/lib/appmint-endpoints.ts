// @ts-nocheck — vendored AppEngine connector (ported from base-app, kept as-is)
export type APIEndpointName = keyof typeof appmintEndpoints;
export const getAppEnginePath = (appConfig: any) => {
  return `${appConfig.appengine.host}`;
};

export const appmintEndpoints = {
  batch_log_data: {
    name: 'batch_log_data',
    method: 'post',
    path: 'batch/log/data',
  },
  get: {
    name: 'get',
    method: 'get',
    path: 'repository/get',
  },
  get_collection: {
    name: 'get_collection',
    method: 'get',
    path: 'repository/collection',
  },
  get_collections: {
    name: 'get_collections',
    method: 'get',
    path: 'repository/collections',
  },
  isunique: {
    name: 'isunique',
    method: 'get',
    path: 'repository/isunique',
  },
  find_by_attribute: {
    name: 'find_by_attribute',
    method: 'get',
    path: 'repository/find-by-attribute',
  },
  get_site: {
    name: 'get_site',
    method: 'get',
    path: 'site/get-site',
  },
  get_site_by_hostname: {
    name: 'get_site_by_hostname',
    method: 'get',
    path: 'site/get-site-by-hostname',
  },
  get_page: {
    name: 'get_page',
    method: 'get',
    path: 'site/page',
  },
  get_page_section: {
    name: 'get_page_section',
    method: 'get',
    path: 'site/page-section',
  },
  query: {
    name: 'query',
    method: 'get',
    path: 'repository/query',
  },
  user_orgs: {
    name: 'user_orgs',
    method: 'get',
    path: 'repository/org/user',
  },
  user_org_delete: {
    name: 'user_org_delete',
    method: 'delete',
    path: 'repository/org/user',
  },
  search_raw: {
    name: 'search_raw',
    method: 'post',
    path: 'search/search',
  },
  search_stat_count: {
    name: 'search_stat_count',
    method: 'get',
    path: 'search/stat/count',
  },
  search_stat_histogram: {
    name: 'search_stat_histogram',
    method: 'get',
    path: 'search/stat/histogram',
  },
  search: {
    name: 'search',
    method: 'get',
    path: 'repository/search',
  },
  search_post: {
    name: 'search_post',
    method: 'post',
    path: 'repository/search',
  },
  search_asset: {
    name: 'search_asset',
    method: 'post',
    path: 'repository/search-asset',
  },
  find: {
    name: 'find',
    method: 'post',
    path: 'repository/find',
  },
  find_asset: {
    name: 'find_asset',
    method: 'post',
    path: 'repository/find-asset',
  },
  create: {
    name: 'create',
    method: 'put',
    path: 'repository/create',
  },
  update: {
    name: 'update',
    method: 'post',
    path: 'repository/update',
  },
  get_activities: {
    name: 'get_activities',
    method: 'get',
    path: 'repository/activities/get',
  },
  logout: {
    name: 'logout',
    method: 'get',
    path: 'profile/logout',
  },
  login: {
    name: 'login',
    method: 'post',
    path: 'profile/customer/signin',
  },
  customer_profile: {
    name: 'customer_profile',
    method: 'get',
    path: 'profile/customer/profile',
  },
  customer_exist: {
    name: 'customer_exist',
    method: 'get',
    path: 'profile/customer/exist',
  },
  customer_social_login: {
    name: 'customer_social_login',
    method: 'post',
    path: 'profile/customer/social-login',
  },
  dashboard_auth: {
    name: 'dashboard_auth',
    method: 'get',
    path: 'profile/customer/dashboard/auth',
  },
  login_magic_link: {
    name: 'login_magic_link',
    method: 'get',
    path: 'profile/magic-link',
  },
  login_magic_link_redirect: {
    name: 'login_magic_link_redirect',
    method: 'post',
    path: 'profile/magic-link/redirect',
  },
  login_facebook: {
    name: 'login_facebook',
    method: 'get',
    path: 'profile/facebook',
  },
  login_google: {
    name: 'login_google',
    method: 'get',
    path: 'profile/google',
  },
  login_code: {
    name: 'login_code',
    method: 'get',
    path: 'profile/code',
  },
  refresh_token: {
    name: 'refresh_token',
    method: 'post',
    path: 'profile/customer/refresh',
  },
  register: {
    name: 'register',
    method: 'post',
    path: 'profile/customer/signup',
  },
  forget_password: {
    name: 'forgot_password',
    method: 'get',
    path: 'profile/customer/password/forgot',
  },
  reset_password: {
    name: 'reset_password',
    method: 'post',
    path: 'profile/customer/password/reset',
  },
  validate_password_token: {
    name: 'validate_password_token',
    method: 'post',
    path: 'profile/customer/password/validate-token',
  },
  profile_update: {
    name: 'profile_update',
    method: 'post',
    path: 'profile/customer/update',
  },
  client_data: {
    name: 'client_data',
    method: 'get',
    path: 'client-data/all',
  },
  appkey: {
    name: 'appkey',
    method: 'post',
    path: 'profile/app/key',
  },
  delete: {
    name: 'delete',
    method: 'del',
    path: 'repository/delete',
  },
  delete_bulk: {
    name: 'delete_bulk',
    method: 'post',
    path: 'repository/delete',
  },
  profile: {
    name: 'profile',
    method: 'post',
    path: 'profile',
  },
  file_delete: {
    name: 'file_delete',
    method: 'post',
    path: 'repository/customer/file/delete',
  },
  file_upload: {
    name: 'file_upload',
    method: 'post',
    path: 'repository/customer/file/upload',
  },
  file_flatlist: {
    name: 'file_flatlist',
    method: 'post',
    path: 'repository/customer/file/flatlist',
  },
  products: {
    name: 'products',
    method: 'get',
    path: 'storefront/products',
  },
  product: {
    name: 'product',
    method: 'get',
    path: 'storefront/product',
  },
  product_category: {
    name: 'products_category',
    method: 'get',
    path: 'storefront/product/category',
  },
  product_search: {
    name: 'product_search',
    method: 'post',
    path: 'storefront/search',
  },
  product_find: {
    name: 'product_find',
    method: 'post',
    path: 'storefront/find',
  },
  product_brands: {
    name: 'product_brands',
    method: 'get',
    path: 'storefront/brands',
  },
  product_collections: {
    name: 'product_collections',
    method: 'get',
    path: 'storefront/collections',
  },
  product_categories: {
    name: 'product_categories',
    method: 'get',
    path: 'storefront/categories',
  },
  order_id: {
    name: 'order_id',
    method: 'get',
    path: 'storefront/order/get',
  },
  order_email: {
    name: 'order_email',
    method: 'get',
    path: 'storefront/order/email',
  },
  orders: {
    name: 'orders',
    method: 'get',
    path: 'storefront/orders/get',
  },
  checkout_payment_gateways: {
    name: 'checkout_payment_gateways',
    method: 'get',
    path: 'storefront/payment_gateways',
  },
  subscriptions_get: {
    name: 'subscriptions_get',
    method: 'get',
    path: 'storefront/subscriptions/get',
  },
  upstream_call: {
    name: 'upstream_call',
    method: 'post',
    path: 'upstream/call',
  },
  upstream_get_config: {
    name: 'upstream_get_config',
    method: 'get',
    path: 'upstream/get-config',
  },
  crm_ticket_get: {
    name: 'crm_ticket_get',
    method: 'get',
    path: 'crm/tickets/get',
  },
  crm_ticket_delete: {
    name: 'crm_ticket_delete',
    method: 'delete',
    path: 'crm/tickets/delete',
  },
  crm_ticket_create: {
    name: 'crm_ticket_create',
    method: 'post',
    path: 'crm/tickets/create',
  },
  crm_ticket_update: {
    name: 'crm_ticket_update',
    method: 'post',
    path: 'crm/tickets/update',
  },
  crm_inbox_message: {
    name: 'crm_inbox_message',
    method: 'get',
    path: 'crm/inbox/message',
  },
  crm_inbox_messages: {
    name: 'crm_inbox_messages',
    method: 'get',
    path: 'crm/inbox/messages',
  },
  crm_inbox_conversation_messages: {
    name: 'crm_inbox_conversation_messages',
    method: 'get',
    path: 'crm/inbox/conversation/messages',
  },
  crm_inbox_conversations: {
    name: 'crm_inbox_conversations',
    method: 'get',
    path: 'crm/inbox/conversations',
  },
  crm_inbox_delete: {
    name: 'crm_inbox_delete',
    method: 'delete',
    path: 'crm/inbox/delete',
  },
  crm_inbox_update: {
    name: 'crm_inbox_update',
    method: 'post',
    path: 'crm/inbox/update',
  },
  crm_service_request_queue_join: {
    name: 'crm_service_request_queue_join',
    method: 'post',
    path: 'crm/service-request-queue/join',
  },
  crm_service_request_update: {
    name: 'crm_service_request_update',
    method: 'post',
    path: 'crm/service-request/update',
  },
  crm_service_request_get: {
    name: 'crm_service_request_get',
    method: 'get',
    path: 'crm/service-request/get',
  },
  crm_contact_form_post: {
    name: 'crm_contact_form_post',
    method: 'post',
    path: 'crm/contact-form/post',
  },
  crm_contact_form_json: {
    name: 'crm_contact_form_json',
    method: 'post',
    path: 'crm/contact-form/json',
  },
  crm_promotion_unsubscribe: {
    name: 'crm_promotion_unsubscribe',
    method: 'post',
    path: 'crm/promotion/unsubscribe',
  },
  crm_events_get: {
    name: 'crm_events_get',
    method: 'get',
    path: 'crm/events/get',
  },
  crm_events_delete: {
    name: 'crm_events_delete',
    method: 'delete',
    path: 'crm/events/delete',
  },
  crm_events_create: {
    name: 'crm_events_create',
    method: 'post',
    path: 'crm/events/create',
  },
  crm_events_update: {
    name: 'crm_events_update',
    method: 'post',
    path: 'crm/events/update',
  },
  crm_flexdata_get: {
    name: 'crm_flexdata_get',
    method: 'get',
    path: 'crm/flexdata/get',
  },
  crm_flexdata_delete: {
    name: 'crm_flexdata_delete',
    method: 'delete',
    path: 'crm/flexdata/delete',
  },
  crm_flexdata_create: {
    name: 'crm_flexdata_create',
    method: 'post',
    path: 'crm/flexdata/create',
  },
  crm_flexdata_update: {
    name: 'crm_flexdata_update',
    method: 'post',
    path: 'crm/flexdata/update',
  },
  crm_comment_delete: {
    name: 'crm_comment_delete',
    method: 'delete',
    path: 'crm/comment/delete',
  },
  crm_comment_create: {
    name: 'crm_comment_create',
    method: 'post',
    path: 'crm/comment/create',
  },
  crm_comment_get: {
    name: 'crm_comment_get',
    method: 'get',
    path: 'crm/comment/get',
  },
  crm_activity_manage: {
    name: 'crm_activity_manage',
    method: 'post',
    path: 'crm/activity/manage',
  },
  crm_activity_by_customer: {
    name: 'crm_activity_by_customer',
    method: 'get',
    path: 'crm/activity/by-customer',
  },
  crm_activity_by_resource: {
    name: 'crm_activity_by_resource',
    method: 'get',
    path: 'crm/activity/by-resource',
  },
  index_site: {
    name: 'index_site',
    method: 'get',
    path: 'tools/index-site',
  },
  web_visit_indirect: {
    name: 'web_visit_indirect',
    method: 'post',
    path: 'tools/web-visit-indirect',
  },
  web_activity: {
    name: 'web_activity',
    method: 'post',
    path: 'tools/web-activity',
  },
  aggregate: {
    name: 'aggregate',
    method: 'post',
    path: 'repository/aggregate',
  },
  dynamic_query: {
    name: 'dynamic_query',
    method: 'post',
    path: 'dynamic-query/query',
  },
  dynamic_update: {
    name: 'dynamic_update',
    method: 'post',
    path: 'dynamic-query/update',
  },
  site_page_data: {
    name: 'site_page_data',
    method: 'get',
    path: 'site/page-data',
  },
  checkout_apply_coupon: {
    name: 'checkout_apply_coupon',
    method: 'post',
    path: 'storefront/discounts/apply',
  },
  get_org: {
    name: 'get_org',
    method: 'get',
    path: 'repository/org',
  },
  get_org_by_email: {
    name: 'get_org_by_email',
    method: 'get',
    path: 'repository/org/user',
  },
  publish: {
    name: 'publish',
    method: 'post',
    path: 'repository/publish',
  },
  unpublish: {
    name: 'unpublish',
    method: 'post',
    path: 'repository/unpublish',
  },
  history: {
    name: 'history',
    method: 'get',
    path: 'repository/history',
  },
  history_restore: {
    name: 'history_restore',
    method: 'post',
    path: 'repository/history/restore',
  },
  trash_restore: {
    name: 'trash_restore',
    method: 'post',
    path: 'repository/trash-restore',
  },
  request_approval: {
    name: 'request_approval',
    method: 'get',
    path: 'repository/request-approval',
  },
  approve: {
    name: 'approve',
    method: 'post',
    path: 'repository/approve',
  },
  reject: {
    name: 'reject',
    method: 'post',
    path: 'repository/reject',
  },
  create_extended: {
    name: 'create_extended',
    method: 'put',
    path: 'repository/create-extended',
  },
  find_any_id: {
    name: 'find_any_id',
    method: 'get',
    path: 'repository/find-any-id',
  },
  find_page_data: {
    name: 'find_page_data',
    method: 'get',
    path: 'repository/find-page-data',
  },
  find_timed_data: {
    name: 'find_timed_data',
    method: 'get',
    path: 'repository/find-timed-data',
  },
  delete_asset: {
    name: 'delete_asset',
    method: 'post',
    path: 'repository/delete-asset',
  },
  update_asset: {
    name: 'update_asset',
    method: 'post',
    path: 'repository/update-asset',
  },

  media_photos: {
    name: 'media_photos',
    method: 'post',
    path: 'repository/media/photos',
  },
  media_videos: {
    name: 'media_videos',
    method: 'post',
    path: 'repository/media/videos',
  },
  bulk_create: {
    name: 'bulk_create',
    method: 'post',
    path: 'repository/bulk-create',
  },
  bulk_create_preview: {
    name: 'bulk_create_preview',
    method: 'get',
    path: 'repository/bulk-create-preview',
  },
  login_shared_site_auth: {
    name: 'login_shared_site_auth',
    method: 'get',
    path: 'profile/user/shared-site-auth',
  },
  facebook: {
    name: 'facebook',
    method: 'post',
    path: 'profile/facebook',
  },
  forgot_password: {
    name: 'forgot_password',
    method: 'post',
    path: 'profile/user/password/forgot',
  },
  register_app: {
    name: 'register_app',
    method: 'post',
    path: 'profile/app/register',
  },
  update_user: {
    name: 'update_user',
    method: 'post',
    path: 'profile/user/update',
  },
  customer_update: {
    name: 'customer_update',
    method: 'post',
    path: 'profile/customer/update',
  },
  customer_signup: {
    name: 'customer_signup',
    method: 'post',
    path: 'profile/customer/signup',
  },
  password_change: {
    name: 'password_change',
    method: 'post',
    path: 'profile/user/password/change',
  },
  password_reset: {
    name: 'password_reset',
    method: 'post',
    path: 'profile/user/password/reset',
  },
  file_create_favicon: {
    name: 'file_create_favicon',
    method: 'post',
    path: 'repository/file/create_favicon',
  },
  file_append: {
    name: 'file_append',
    method: 'post',
    path: 'repository/file/append',
  },
  file_copy: {
    name: 'file_copy',
    method: 'post',
    path: 'repository/file/copy',
  },
  file_exists: {
    name: 'file_exists',
    method: 'post',
    path: 'repository/file/exists',
  },
  file_driver: {
    name: 'file_driver',
    method: 'get',
    path: 'repository/file/driver',
  },
  file_get_asset: {
    name: 'file_get_asset',
    method: 'post',
    path: 'repository/file/get_asset',
  },
  file_get: {
    name: 'file_get',
    method: 'post',
    path: 'repository/file',
  },
  file_buffer: {
    name: 'file_buffer',
    method: 'post',
    path: 'repository/file/buffer',
  },
  file_signedurl: {
    name: 'file_signedurl',
    method: 'post',
    path: 'repository/file/signurl',
  },
  file_make_private: {
    name: 'file_make_private',
    method: 'post',
    path: 'repository/file/make-private',
  },
  file_thumbnails: {
    name: 'file_thumbnails',
    method: 'post',
    path: 'repository/file/thumbnails',
  },
  file_make_public: {
    name: 'file_make_public',
    method: 'post',
    path: 'repository/file/make-public',
  },
  file_stat: {
    name: 'file_stat',
    method: 'post',
    path: 'repository/file/stat',
  },
  file_stream: {
    name: 'file_stream',
    method: 'post',
    path: 'repository/file/stream',
  },
  file_move: {
    name: 'file_move',
    method: 'post',
    path: 'repository/file/move',
  },
  file_url: {
    name: 'file_url',
    method: 'post',
    path: 'repository/file/url',
  },

  file_upload_from_url: {
    name: 'file_upload_from_url',
    method: 'post',
    path: 'repository/file/upload-url',
  },
  file_prepend: {
    name: 'file_prepend',
    method: 'post',
    path: 'repository/file/prepend',
  },
  file_createfolder: {
    name: 'file_createfolder',
    method: 'post',
    path: 'repository/file/createfolder',
  },
  batch_sr_publish_status: {
    name: 'batch_sr_publish_status',
    method: 'get',
    path: 'batch/sr/publish/status',
  },
  batch_sr_update_domain: {
    name: 'batch_sr_update_domain',
    method: 'get',
    path: 'batch/sr/update-domain',
  },
  batch_sr_site_create: {
    name: 'batch_sr_site_create',
    method: 'post',
    path: 'batch/sr/site/create',
  },
  batch_sr_create: {
    name: 'batch_sr_create',
    method: 'post',
    path: 'batch/sr/create',
  },
  batch_sr_get: {
    name: 'batch_sr_get',
    method: 'get',
    path: 'batch/sr/get',
  },
  batch_sr_publish_with_api: {
    name: 'batch_sr_publish_with_api',
    method: 'post',
    path: 'batch/sr/publish-api',
  },
  batch_sr_publish: {
    name: 'batch_sr_publish',
    method: 'post',
    path: 'batch/sr/publish',
  },
  batch_sr_publish_shared: {
    name: 'batch_sr_publish_shared',
    method: 'post',
    path: 'batch/sr/publish-shared',
  },
  batch_sr_build: {
    name: 'batch_sr_build',
    method: 'post',
    path: 'batch/sr/build',
  },
  batch_sr_clean: {
    name: 'batch_sr_clean',
    method: 'get',
    path: 'batch/sr/clean',
  },
  batch_sr_delete: {
    name: 'batch_sr_delete',
    method: 'delete',
    path: 'batch/sr/delete',
  },
  batch_sr_import_pages: {
    name: 'batch_sr_import_pages',
    method: 'post',
    path: 'batch/sr/import-pages',
  },
  batch_sr_templates: {
    name: 'batch_sr_templates',
    method: 'get',
    path: 'batch/sr/templates',
  },
  integration_types: {
    name: 'integration_types',
    method: 'get',
    path: 'upstream/integration-types',
  },
  integration_save: {
    name: 'integration_save',
    method: 'post',
    path: 'upstream/save-integration',
  },
  integration_call: {
    name: 'integration_call',
    method: 'post',
    path: 'upstream/call',
  },
  integration_get_config: {
    name: 'integration_get_config',
    method: 'get',
    path: 'upstream/get-config',
  },
  storefront_get_order: {
    name: 'storefront_get_order',
    method: 'get',
    path: 'storefront/order/email',
  },
  storefront_get_subscriptions: {
    name: 'storefront_get_subscriptions',
    method: 'get',
    path: 'storefront/subscriptions/get',
  },
  storefront_take_payment: {
    name: 'storefront_take_payment',
    method: 'post',
    path: 'storefront/take-payment',
  },
  storefront_checkout_order: {
    name: 'storefront_checkout_order',
    method: 'post',
    path: 'storefront/checkout-cart',
  },
  storefront_send_welcome: {
    name: 'storefront_send_welcome',
    method: 'get',
    path: 'storefront/order/send-welcome',
    pattern: 'storefront/order/send-welcome/:orderNumber',
  },
  storefront_order_refund: {
    name: 'storefront_order_refund',
    method: 'post',
    path: 'storefront/order/refund',
  },
  storefront_update_subscription: {
    name: 'storefront_update_subscription',
    method: 'post',
    path: 'storefront/update-subscription',
  },
  storefront_payment_gateways: {
    name: 'storefront_payment_gateways',
    method: 'get',
    path: 'storefront/payment-gateways',
  },
  storefront_verify_payment: {
    name: 'storefront_verify_payment',
    method: 'get',
    path: 'storefront/verify-payment',
  },
  storefront_stripe_payment_intent: {
    name: 'storefront_stripe_payment_intent',
    method: 'post',
    path: 'storefront/stripe/intent',
  },
  storefront_stripe_subscription_session: {
    name: 'storefront_stripe_subscription_session',
    method: 'post',
    path: 'storefront/stripe/subscription-session',
  },
  storefront_stripe_checkout_session: {
    name: 'storefront_stripe_checkout_session',
    method: 'post',
    path: 'storefront/stripe/checkout-session',
  },
  crm_place_near_by: {
    name: 'crm_place_near_by',
    method: 'get',
    path: 'crm/place/near-by',
  },
  crm_send_template: {
    name: 'crm_send_template',
    method: 'post',
    path: 'crm/send-template',
  },
  crm_reservations_slots: {
    name: 'crm_reservations_slots',
    method: 'post',
    path: 'crm/reservations/slots',
  },
  crm_reservations_get: {
    name: 'crm_reservations_get',
    method: 'get',
    path: 'crm/reservations/get',
  },
  crm_reservations_create: {
    name: 'crm_reservations_create',
    method: 'post',
    path: 'crm/reservations/create',
  },
  crm_reservations_update: {
    name: 'crm_reservations_update',
    method: 'post',
    path: 'crm/reservations/update',
  },
  crm_reservations_delete: {
    name: 'crm_reservations_delete',
    method: 'delete',
    path: 'crm/reservations/delete',
  },
  crm_reservations_join_queue: {
    name: 'crm_reservations_join_queue',
    method: 'post',
    path: 'crm/service-request-queue/join',
  },
  crm_service_point_create: {
    name: 'crm_service_point_create',
    method: 'post',
    path: 'crm/service-point/create',
  },
  crm_service_point_update: {
    name: 'crm_service_point_update',
    method: 'post',
    path: 'crm/service-point/update',
  },
  crm_service_point_get: {
    name: 'crm_service_point_get',
    method: 'get',
    path: 'crm/service-point/get',
  },
  crm_service_point_delete: {
    name: 'crm_service_point_delete',
    method: 'delete',
    path: 'crm/service-point/delete',
  },
  crm_meeting_token: {
    name: 'crm_meeting_token',
    method: 'get',
    path: 'crm/meeting/token',
  },
  crm_meeting_create: {
    name: 'crm_meeting_create',
    method: 'get',
    path: 'crm/meeting/create',
  },
  crm_collection_form_send: {
    name: 'crm_form_send',
    method: 'post',
    path: 'crm/collection-form/send',
  },
  crm_collection_form_submit: {
    name: 'crm_collection_form_submit',
    method: 'post',
    path: 'crm/collection-form/submit',
  },
  crm_signed_document_send: {
    name: 'crm_signed_document_send',
    method: 'post',
    path: 'crm/signed-document/send',
  },
  crm_signed_document_update: {
    name: 'crm_signed_document_update',
    method: 'post',
    path: 'crm/signed-document/update',
  },
  tools_remove_background: {
    name: 'tools_remove_background',
    method: 'post',
    path: 'tools/remove-background',
  },
  tools_tailwind_css: {
    name: 'tools_tailwind_css',
    method: 'get',
    path: 'tools/tailwind-css',
  },
  tools_tailwind_map: {
    name: 'tools_tailwind_map',
    method: 'post',
    path: 'tools/tailwind-map',
  },
  tools_view_component: {
    name: 'tools_view_component',
    method: 'post',
    path: 'tools/view-component',
  },
  tools_create_site_favicon: {
    name: 'tools_create_site_favicon',
    method: 'post',
    path: 'tools/create-site-favicon',
  },
  tools_make_site_template: {
    name: 'tools_make_site_template',
    method: 'post',
    path: 'tools/make-site-template',
  },
  tools_classify_site: {
    name: 'tools_classify_site',
    method: 'post',
    path: 'tools/classify-site',
  },
  tools_create_page_image: {
    name: 'tools_create_page_image',
    method: 'post',
    path: 'tools/create-page-image',
  },
  tools_create_site_index: {
    name: 'tools_create_site_index',
    method: 'post',
    path: 'tools/create-site-index',
  },
  tools_domain_search: {
    name: 'tools_domain_search',
    method: 'get',
    path: 'tools/domain/search',
  },
  tools_domain_buy: {
    name: 'tools_domain_buy',
    method: 'post',
    path: 'tools/domain/buy',
  },
  tools_domain_manage: {
    name: 'tools_domain_manage',
    method: 'post',
    path: 'tools/domain/manage',
  },
  tools_domain_list: {
    name: 'tools_domain_list',
    method: 'get',
    path: 'tools/domain/list',
  },
  tools_download_: {
    name: 'tools_domain_list',
    method: 'get',
    path: 'tools/domain/list',
  },
  tools_presentation_pptx: {
    name: 'tools_presentation_pptx',
    method: 'post',
    path: 'tools/presentation/to-pptx',
  },
  tools_presentation_pdf: {
    name: 'tools_presentation_pdf',
    method: 'post',
    path: 'tools/presentation/to-pdf',
  },
  tools_presentation_publish: {
    name: 'tools_presentation_publish',
    method: 'post',
    path: 'tools/presentation/publish',
  },
  tools_presentation_unpublish: {
    name: 'tools_presentation_unpublish',
    method: 'post',
    path: 'tools/presentation/unpublish',
  },
  ai_list_models: {
    name: 'ai_list_models',
    method: 'get',
    path: 'ai/list-models',
  },
  ai_assistants_create: {
    name: 'ai_assistants_create',
    method: 'post',
    path: 'ai/assistants/create',
  },
  ai_assistants_get: {
    name: 'ai_assistants_get',
    method: 'get',
    path: 'ai/assistants/get',
  },
  ai_assistants_run: {
    name: 'ai_assistants_run',
    method: 'post',
    path: 'ai/assistants/run',
  },
  ai_thread_create: {
    name: 'ai_thread_create',
    method: 'post',
    path: 'ai/thread/create',
  },
  ai_thread_add_message: {
    name: 'ai_thread_add_message',
    method: 'post',
    path: 'ai/thread/add/message',
  },
  ai_thread_get_runs: {
    name: 'ai_thread_get_runs',
    method: 'get',
    path: 'ai/thread/runs',
  },
  ai_thread_get_run_status: {
    name: 'ai_thread_get_run_status',
    method: 'get',
    path: 'ai/thread/run/status',
  },
  ai_thread_get_messages: {
    name: 'ai_thread_get_messages',
    method: 'get',
    path: 'ai/thread/messages',
  },
  ai_assist_create: {
    name: 'ai_assist_create',
    method: 'post',
    path: 'ai/assist/create',
  },
  ai_assist_completion: {
    name: 'ai_assist_completion',
    method: 'post',
    path: 'ai/assist/completion',
  },
  ai_generate: {
    name: 'ai_generate',
    method: 'post',
    path: 'ai/generate',
  },
  ai_classify: {
    name: 'ai_classify',
    method: 'post',
    path: 'ai/classify',
  },
  ai_direct: {
    name: 'ai_direct',
    method: 'post',
    path: 'ai/direct',
  },
  ai_advanced: {
    name: 'ai_advanced',
    method: 'post',
    path: 'ai/advanced',
  },
  chat_sessions: {
    name: 'chat_sessions',
    method: 'get',
    path: 'chat/sessions',
  },
  chat_sessions_delete: {
    name: 'chat_sessions_delete',
    method: 'post',
    path: 'chat/sessions/delete',
  },
  workspace_item_create: {
    name: 'workspace_item_create',
    method: 'post',
    path: `crm/workspace-item`,
  },
  workspace_item_delete: {
    name: 'workspace_item_delete',
    method: 'del',
    path: `crm/workspace-item`,
  },
  // AI Agent endpoints
  ai_agent_process: {
    name: 'ai_agent_process',
    method: 'post',
    path: 'ai/agent/process',
  },
  ai_agent_process_specific: {
    name: 'ai_agent_process_specific',
    method: 'post',
    path: 'ai/agent/:agentId/process',
  },
  ai_agent_chat: {
    name: 'ai_agent_chat',
    method: 'post',
    path: 'ai/agent/chat',
  },
  ai_agent_stream: {
    name: 'ai_agent_stream',
    method: 'post',
    path: 'ai/agent/stream',
  },
  ai_agent_stream_specific: {
    name: 'ai_agent_stream_specific',
    method: 'post',
    path: 'ai/agent/:agentId/stream',
  },
  ai_stream_connect: {
    name: 'ai_stream_connect',
    method: 'get',
    path: 'ai/stream/:streamId',
  },
  // Monitoring endpoints
  monitoring_overview: {
    name: 'monitoring_overview',
    method: 'get',
    path: 'monitoring/overview',
  },
  monitoring_historical: {
    name: 'monitoring_historical',
    method: 'get',
    path: 'monitoring/historical',
  },
  monitoring_health: {
    name: 'monitoring_health',
    method: 'get',
    path: 'monitoring/health',
  },
  monitoring_system_metrics: {
    name: 'monitoring_system_metrics',
    method: 'get',
    path: 'monitoring/system-metrics',
  },
  monitoring_queues: {
    name: 'monitoring_queues',
    method: 'get',
    path: 'monitoring/queues',
  },
  monitoring_queue_details: {
    name: 'monitoring_queue_details',
    method: 'get',
    path: 'monitoring/queues/:queueName',
  },
  monitoring_alerts: {
    name: 'monitoring_alerts',
    method: 'get',
    path: 'monitoring/alerts',
  },
  monitoring_user_activity: {
    name: 'monitoring_user_activity',
    method: 'get',
    path: 'monitoring/user-activity',
  },
  monitoring_company_creation: {
    name: 'monitoring_company_creation',
    method: 'get',
    path: 'monitoring/company-creation',
  },
  monitoring_domain_mappings: {
    name: 'monitoring_domain_mappings',
    method: 'get',
    path: 'monitoring/domain-mappings',
  },
  monitoring_alert_notifications: {
    name: 'monitoring_alert_notifications',
    method: 'get',
    path: 'monitoring/alert-notifications',
  },
  monitoring_usage: {
    name: 'monitoring_usage',
    method: 'get',
    path: 'monitoring/usage',
  },
  monitoring_web_activity: {
    name: 'monitoring_web_activity',
    method: 'get',
    path: 'monitoring/web-activity',
  },

  // Marketing API endpoints
  marketing_campaigns_create: {
    name: 'marketing_campaigns_create',
    method: 'post',
    path: 'crm/marketing/campaigns',
  },
  marketing_campaigns_get: {
    name: 'marketing_campaigns_get',
    method: 'get',
    path: 'crm/marketing/campaigns',
  },
  marketing_campaigns_get_by_id: {
    name: 'marketing_campaigns_get_by_id',
    method: 'get',
    path: 'crm/marketing/campaigns/:id',
  },
  marketing_campaigns_update: {
    name: 'marketing_campaigns_update',
    method: 'put',
    path: 'crm/marketing/campaigns/:id',
  },
  marketing_campaigns_delete: {
    name: 'marketing_campaigns_delete',
    method: 'delete',
    path: 'crm/marketing/campaigns/:id',
  },
  marketing_campaigns_start: {
    name: 'marketing_campaigns_start',
    method: 'post',
    path: 'crm/marketing/campaigns/:id/start',
  },
  marketing_campaigns_pause: {
    name: 'marketing_campaigns_pause',
    method: 'post',
    path: 'crm/marketing/campaigns/:id/pause',
  },
  marketing_campaigns_stop: {
    name: 'marketing_campaigns_stop',
    method: 'post',
    path: 'crm/marketing/campaigns/:id/stop',
  },
  marketing_campaigns_duplicate: {
    name: 'marketing_campaigns_duplicate',
    method: 'post',
    path: 'crm/marketing/campaigns/:id/duplicate',
  },
  marketing_campaigns_analytics: {
    name: 'marketing_campaigns_analytics',
    method: 'get',
    path: 'crm/marketing/campaigns/:id/analytics',
  },
  marketing_campaigns_refresh_metrics: {
    name: 'marketing_campaigns_refresh_metrics',
    method: 'post',
    path: 'crm/marketing/campaigns/:id/refresh-metrics',
  },
  marketing_campaigns_aggregated_metrics: {
    name: 'marketing_campaigns_aggregated_metrics',
    method: 'post',
    path: 'crm/marketing/campaigns/aggregated-metrics',
  },
  marketing_platforms_get: {
    name: 'marketing_platforms_get',
    method: 'get',
    path: 'crm/marketing/platforms',
  },
  marketing_campaign_types_get: {
    name: 'marketing_campaign_types_get',
    method: 'get',
    path: 'crm/marketing/campaign-types',
  },

  // Audience API endpoints
  marketing_audiences_segments_create: {
    name: 'marketing_audiences_segments_create',
    method: 'post',
    path: 'crm/marketing/audiences/segments',
  },
  marketing_audiences_segments_get: {
    name: 'marketing_audiences_segments_get',
    method: 'get',
    path: 'crm/marketing/audiences/segments',
  },
  marketing_audiences_segments_get_by_id: {
    name: 'marketing_audiences_segments_get_by_id',
    method: 'get',
    path: 'crm/marketing/audiences/segments/:id',
  },
  marketing_audiences_segments_update: {
    name: 'marketing_audiences_segments_update',
    method: 'put',
    path: 'crm/marketing/audiences/segments/:id',
  },
  marketing_audiences_segments_delete: {
    name: 'marketing_audiences_segments_delete',
    method: 'delete',
    path: 'crm/marketing/audiences/segments/:id',
  },
  marketing_audiences_custom_create: {
    name: 'marketing_audiences_custom_create',
    method: 'post',
    path: 'crm/marketing/audiences/custom',
  },
  marketing_audiences_custom_get: {
    name: 'marketing_audiences_custom_get',
    method: 'get',
    path: 'crm/marketing/audiences/custom',
  },
  marketing_audiences_insights: {
    name: 'marketing_audiences_insights',
    method: 'get',
    path: 'crm/marketing/audiences/segments/:id/insights',
  },
  marketing_audiences_estimate_reach: {
    name: 'marketing_audiences_estimate_reach',
    method: 'post',
    path: 'crm/marketing/audiences/estimate-reach',
  },
  marketing_audiences_overlap: {
    name: 'marketing_audiences_overlap',
    method: 'get',
    path: 'crm/marketing/audiences/segments/:id1/overlap/:id2',
  },
  marketing_audiences_interests: {
    name: 'marketing_audiences_interests',
    method: 'get',
    path: 'crm/marketing/audiences/interests',
  },
  marketing_audiences_locations: {
    name: 'marketing_audiences_locations',
    method: 'get',
    path: 'crm/marketing/audiences/locations',
  },
  marketing_audiences_custom_types: {
    name: 'marketing_audiences_custom_types',
    method: 'get',
    path: 'crm/marketing/audiences/custom-types',
  },
  marketing_audiences_targeting_options: {
    name: 'marketing_audiences_targeting_options',
    method: 'get',
    path: 'crm/marketing/audiences/targeting-options',
  },
  marketing_social_profiles: {
    name: 'marketing_social_profiles',
    method: 'get',
    path: 'crm/marketing/social-profiles',
  },

  // Leads API endpoints
  leads_create: {
    name: 'leads_create',
    method: 'post',
    path: 'crm/leads',
  },
  leads_get: {
    name: 'leads_get',
    method: 'get',
    path: 'crm/leads',
  },
  leads_get_by_id: {
    name: 'leads_get_by_id',
    method: 'get',
    path: 'crm/leads/:id',
  },
  leads_update: {
    name: 'leads_update',
    method: 'put',
    path: 'crm/leads/:id',
  },
  leads_delete: {
    name: 'leads_delete',
    method: 'delete',
    path: 'crm/leads/:id',
  },
  leads_qualify: {
    name: 'leads_qualify',
    method: 'post',
    path: 'crm/leads/:id/qualify',
  },
  leads_disqualify: {
    name: 'leads_disqualify',
    method: 'post',
    path: 'crm/leads/:id/disqualify',
  },
  leads_convert: {
    name: 'leads_convert',
    method: 'post',
    path: 'crm/leads/:id/convert',
  },
  leads_assign: {
    name: 'leads_assign',
    method: 'post',
    path: 'crm/leads/:id/assign',
  },
  leads_follow_up: {
    name: 'leads_follow_up',
    method: 'post',
    path: 'crm/leads/:id/follow-up',
  },
  leads_analytics: {
    name: 'leads_analytics',
    method: 'get',
    path: 'crm/leads/analytics',
  },

  // Lead Enrichment Endpoints
  leads_enrich: {
    name: 'leads_enrich',
    method: 'post',
    path: 'crm/leads/:id/enrich',
  },
  leads_enrich_batch: {
    name: 'leads_enrich_batch',
    method: 'post',
    path: 'crm/leads/enrich/batch',
  },
  leads_enrichment_status: {
    name: 'leads_enrichment_status',
    method: 'get',
    path: 'crm/leads/:id/enrichment/status',
  },
  leads_auto_enrich: {
    name: 'leads_auto_enrich',
    method: 'post',
    path: 'crm/leads/enrich/auto',
  },
  sync_social_activities: {
    name: 'sync_social_activities',
    method: 'post',
    path: 'sync/social-activities',
  },

  // Client Account Endpoints
  client_dashboard: {
    name: 'client_dashboard',
    method: 'get',
    path: 'client-data/dashboard',
  },
  client_profile: {
    name: 'client_profile',
    method: 'get',
    path: 'client-data/profile',
  },
  client_profile_update: {
    name: 'client_profile_update',
    method: 'put',
    path: 'client-data/profile',
  },
  client_orders: {
    name: 'client_orders',
    method: 'get',
    path: 'client-data/orders',
  },
  client_order: {
    name: 'client_order',
    method: 'get',
    path: 'client-data/orders',
  },
  client_reservations: {
    name: 'client_reservations',
    method: 'get',
    path: 'client-data/reservations',
  },
  client_tickets: {
    name: 'client_tickets',
    method: 'get',
    path: 'client-data/tickets',
  },
  client_ticket_create: {
    name: 'client_ticket_create',
    method: 'post',
    path: 'client-data/tickets',
  },
  client_ticket_update: {
    name: 'client_ticket_update',
    method: 'put',
    path: 'client-data/tickets',
  },
  client_messages: {
    name: 'client_messages',
    method: 'get',
    path: 'client-data/messages',
  },
  client_message_send: {
    name: 'client_message_send',
    method: 'post',
    path: 'client-data/messages',
  },
  client_conversations: {
    name: 'client_conversations',
    method: 'get',
    path: 'client-data/conversations',
  },
  client_notifications: {
    name: 'client_notifications',
    method: 'get',
    path: 'client-data/notifications',
  },
  client_payment_methods: {
    name: 'client_payment_methods',
    method: 'get',
    path: 'client-data/payment-methods',
  },
  client_addresses: {
    name: 'client_addresses',
    method: 'get',
    path: 'client-data/addresses',
  },
  client_address_save: {
    name: 'client_address_save',
    method: 'post',
    path: 'client-data/addresses',
  },
  client_address_delete: {
    name: 'client_address_delete',
    method: 'delete',
    path: 'client-data/addresses',
  },
  client_wishlist: {
    name: 'client_wishlist',
    method: 'get',
    path: 'client-data/wishlist',
  },
  client_transactions: {
    name: 'client_transactions',
    method: 'get',
    path: 'client-data/transactions',
  },
  client_analytics: {
    name: 'client_analytics',
    method: 'get',
    path: 'client-data/analytics',
  },
  client_all_data: {
    name: 'client_all_data',
    method: 'get',
    path: 'client-data/all',
  },
  client_files: {
    name: 'client_files',
    method: 'get',
    path: 'client-data/files',
  },
  client_file_upload: {
    name: 'client_file_upload',
    method: 'post',
    path: 'client-data/files/upload',
  },
  client_file_delete: {
    name: 'client_file_delete',
    method: 'delete',
    path: 'client-data/files',
  },

  // Affiliate Endpoints
  affiliate_join: {
    name: 'affiliate_join',
    method: 'post',
    path: 'client/affiliate/join',
  },
  affiliate_me: {
    name: 'affiliate_me',
    method: 'get',
    path: 'client/affiliate/me',
  },
  affiliate_referrals: {
    name: 'affiliate_referrals',
    method: 'get',
    path: 'client/affiliate/me/referrals',
  },
  affiliate_earnings: {
    name: 'affiliate_earnings',
    method: 'get',
    path: 'client/affiliate/me/earnings',
  },
  affiliate_programs: {
    name: 'affiliate_programs',
    method: 'get',
    path: 'client/affiliate/programs',
  },
  affiliate_resolve: {
    name: 'affiliate_resolve',
    method: 'get',
    path: 'affiliate/public/resolve',
  },
  affiliate_track: {
    name: 'affiliate_track',
    method: 'post',
    path: 'affiliate/public/track',
  },

  // Finance Client Endpoints
  finance_wallet: {
    name: 'finance_wallet',
    method: 'get',
    path: 'client/finance/wallet',
  },
  finance_payouts: {
    name: 'finance_payouts',
    method: 'get',
    path: 'client/finance/payouts',
  },
  finance_payout_request: {
    name: 'finance_payout_request',
    method: 'post',
    path: 'client/finance/payouts/request',
  },
  finance_payout_methods: {
    name: 'finance_payout_methods',
    method: 'get',
    path: 'client/finance/payout-methods',
  },
  finance_payout_method_add: {
    name: 'finance_payout_method_add',
    method: 'post',
    path: 'client/finance/payout-methods',
  },
  finance_payout_method_update: {
    name: 'finance_payout_method_update',
    method: 'put',
    path: 'client/finance/payout-methods',
  },
  finance_payout_method_remove: {
    name: 'finance_payout_method_remove',
    method: 'del',
    path: 'client/finance/payout-methods',
  },
  finance_payout_method_default: {
    name: 'finance_payout_method_default',
    method: 'put',
    path: 'client/finance/payout-methods',
  },

  // Event Client Endpoints
  events_browse: {
    name: 'events_browse',
    method: 'get',
    path: 'client/events',
  },
  events_detail: {
    name: 'events_detail',
    method: 'get',
    path: 'client/events',
  },
  events_ticket_types: {
    name: 'events_ticket_types',
    method: 'get',
    path: 'client/events',
  },
  events_sessions: {
    name: 'events_sessions',
    method: 'get',
    path: 'client/events',
  },
  events_schedule: {
    name: 'events_schedule',
    method: 'get',
    path: 'client/events',
  },
  events_participants: {
    name: 'events_participants',
    method: 'get',
    path: 'client/events',
  },
  events_purchase: {
    name: 'events_purchase',
    method: 'post',
    path: 'client/events/tickets/purchase',
  },
  events_confirm_order: {
    name: 'events_confirm_order',
    method: 'post',
    path: 'client/events/tickets/confirm-order',
  },
  events_my_tickets: {
    name: 'events_my_tickets',
    method: 'get',
    path: 'client/events/tickets/mine',
  },
  events_booking: {
    name: 'events_booking',
    method: 'get',
    path: 'client/events/booking',
  },
  events_ticket_detail: {
    name: 'events_ticket_detail',
    method: 'get',
    path: 'client/events/tickets',
  },
  events_ticket_qr: {
    name: 'events_ticket_qr',
    method: 'get',
    path: 'client/events/tickets',
  },
  events_ticket_transfer: {
    name: 'events_ticket_transfer',
    method: 'post',
    path: 'client/events/tickets',
  },
  events_ticket_perks: {
    name: 'events_ticket_perks',
    method: 'get',
    path: 'client/events/tickets',
  },
  events_participation_mine: {
    name: 'events_participation_mine',
    method: 'get',
    path: 'client/events/participation/mine',
  },
  events_participation_respond: {
    name: 'events_participation_respond',
    method: 'put',
    path: 'client/events/participation',
  },

  // Security Challenge Endpoints (2FA / New Device Verification)
  security_challenge_verify: {
    name: 'security_challenge_verify',
    method: 'post',
    path: 'profile/security/challenge/verify',
  },
  security_challenge_send: {
    name: 'security_challenge_send',
    method: 'post',
    path: 'profile/security/challenge/send',
  },
};

export const API_ENDPOINTS = {
  // Dynamic Query Endpoints
  DYNAMIC_QUERY: '/dynamic-query/query',
  DYNAMIC_UPDATE: '/dynamic-query/update',
  DYNAMIC_DELETE: '/dynamic-query/delete',

  // Data Endpoints
  GET_DATA: '/repository/get',
  QUERY_DATA: '/repository/query',
  CREATE_DATA: '/repository/create',
  UPDATE_DATA: '/repository/update',
  DELETE_DATA: '/repository/delete',

  // Collection Endpoints
  GET_COLLECTION: '/repository/collection',
  GET_COLLECTIONS: '/repository/collections',

  // Authentication Endpoints
  LOGIN: '/profile/customer/signin',
  REGISTER: '/profile/customer/signup',
  REFRESH_TOKEN: '/profile/customer/refresh',
  LOGOUT: '/profile/logout',

  // User Endpoints
  UPDATE_USER: '/profile/customer/update',
  FORGET_PASSWORD: '/profile/customer/password/forgot',
  RESET_PASSWORD: '/profile/customer/password/reset',

  // Utility Endpoints
  IS_UNIQUE: '/repository/isunique',
  SEARCH_DATA: '/repository/search',
  FIND_DATA: '/repository/find',
  FIND_PAGE_DATA: '/repository/find-page-data',
  DATATYPE_CATEGORY: '/repository/category',

  STORE_GET_PRODUCTS: 'storefront/products',
  STORE_GET_DATA: 'storefront/data',
  STORE_GET_PRODUCT: 'storefront/product',
  STORE_GET_CATEGORIES: 'storefront/categories',
  STORE_GET_CART: 'storefront/cart/get',
  STORE_UPDATE_CART: 'storefront/cart/update',
  STORE_CLEAR_CART: 'storefront/cart/clear',

  STORE_GET_ORDERS: 'storefront/orders/get',
  STORE_GET_ORDER_BY_ID: 'storefront/order/get',

  STORE_GET_ORDER_BY_EMAIL: 'storefront/order/email',
  STORE_GET_SUBSCRIPTIONS: 'storefront/subscriptions/get',
  STORE_GET_COLLECTIONS: 'storefront/collections',
  STORE_GET_ATTRIBUTES: 'storefront/attributes',
  STORE_GET_BRANDS: 'storefront/brands',
  STORE_GET_ON_SELLING_PRODUCTS: 'storefront/products/?category=flash',
  STORE_GET_PRODUCT_BY_ID: 'storefront/product',
  STORE_GET_RELATED_PRODUCTS: 'storefront/products/related/:productId',
  STORE_CHECKOUT_STRIPE_PAY_INTENT: 'storefront/stripe/intent',
  STORE_CHECKOUT_STRIPE_SUBSCRIPTION_SESSION: 'storefront/stripe/subscription-session',
  STORE_CHECKOUT_PAYPAL_CONFIG: 'storefront/paypal/config',
  STORE_CHECKOUT_PAYMENT_GATEWAYS: 'storefront/payment-gateways',
  STORE_CHECKOUT_CART: 'storefront/checkout-cart',
  STORE_CHECKOUT_APPLY_COUPON: 'storefront/discounts/apply',
  STORE_UPDATE_SUBSCRIPTION: 'storefront/update-subscription',
  STORE_CHECKOUT_BUY_NOW: 'storefront/checkout-buy-now',

  RESERVATION_SLOTS: `crm/reservations/slots`,
  RESERVATION_DEFINITIONS: `crm/reservations/definitions`,
  RESERVATION_DELETE: `crm/reservations/delete`,
  RESERVATION_UPDATE: `crm/reservations/update`,
  RESERVATION_CREATE: `crm/reservations/create`,
  RESERVATION_GET: `crm/reservations/get`,
  RESERVATION_BY_EMAIL: `crm/reservations/by-email`,

  GENERATE_TAILWIND_CSS: 'tools/tailwind-css',

  FIND_ASSETS: 'repository/find-asset',

  METRICS: `/api/metrics`,
  SITE_SEARCH: (datatype, keyword) => `/api/${appmintEndpoints.search.path}/${datatype || ''}?keyword=${keyword}`,
  LOG_METRICS: `/api/log`,
  SEARCH_STAT_COUNT: `/api/${appmintEndpoints.search_stat_count.path}`,
  SEARCH_STAT_HISTOGRAM: `/api/${appmintEndpoints.search_stat_histogram.path}`,
  DELETE_FILE: `/api/${appmintEndpoints.file_delete.path}`,
  UPLOAD_FILE: `/api/${appmintEndpoints.file_upload.path}`,
  LIST_FILE: `/api/${appmintEndpoints.file_flatlist.path}`,
  LOGIN_EMAIL_PASSWORD: `/api/${appmintEndpoints.login.path}`,
  LOGIN_MAGICLINK: `/api/${appmintEndpoints.login_magic_link.path}`,
  LOGIN_FACEBOOK: `/api/${appmintEndpoints.login_facebook.path}`,
  LOGIN_GOOGLE: `/api/${appmintEndpoints.login_google.path}`,
  LOGIN_DASHBOARD: `/api/${appmintEndpoints.dashboard_auth.path}`,
  VALIDATE_RESET_TOKEN: `/api/profile/customer/password/validate-token`,
  // SERVICE_POINTS: `/api/${appmintEndpoints.crm_service_point_get.path}`,
  SERVICE_REQUEST_QUEUE_JOIN: `/api/${appmintEndpoints.crm_service_request_queue_join.path}`,
  SERVICE_REQUEST_UPDATE: `/api/${appmintEndpoints.crm_service_request_update.path}`,
  SERVICE_REQUEST_GET: `/api/${appmintEndpoints.crm_service_request_get.path}`,
  MESSAGE_DELETE: `/api/${appmintEndpoints.crm_inbox_delete.path}`,
  MESSAGE_GET: `/api/${appmintEndpoints.crm_inbox_message.path}`,
  MESSAGES_GET: `/api/${appmintEndpoints.crm_inbox_messages.path}`,
  CONVERSATIONS_GET: `/api/${appmintEndpoints.crm_inbox_conversations.path}`,
  CONVERSATION_MESSAGES_GET: `/api/${appmintEndpoints.crm_inbox_conversation_messages.path}`,
  MESSAGE_UPDATE: `/api/${appmintEndpoints.crm_inbox_update.path}`,
  UNSUBSCRIBE: `/api/${appmintEndpoints.crm_promotion_unsubscribe.path}`,
  CRM_FORM_SAVE_JSON: `/api/${appmintEndpoints.crm_contact_form_json.path}`,
  CRM_FORM_SAVE_POST: `/api/${appmintEndpoints.crm_contact_form_post.path}`,
  TICKET_COLLECTIONS: `/api/crm/tickets/collections`,
  TICKET_GET_BY_EMAIL: (email, number) => `/api/crm/tickets/get-by-email/${email}/${number}`,
  TICKET_GET: `/api/${appmintEndpoints.crm_ticket_get.path}`,
  TICKET_DELETE: `/api/${appmintEndpoints.crm_ticket_delete.path}`,
  TICKET_UPDATE: `/api/${appmintEndpoints.crm_ticket_update.path}`,
  TICKET_CREATE: `/api/${appmintEndpoints.crm_ticket_create.path}`,
  TICKET_CREATE_POST: `/api/${appmintEndpoints.crm_ticket_create.path}-post`,
  SIGNED_DOCUMENT_GET: (email, documentId) => `/api/crm/signed-document/get/${documentId}/${email}`,
  SIGNED_DOCUMENT_SIGN: (email, documentId) => `/api/crm/signed-document/sign/${documentId}/${email}`,
  COLLECTION_FORM_GET: (number, email) => `/api/crm/collection-form/get/${number}/${email}`,
  COLLECTION_FORM_SUBMIT: (number, email) => `/api/crm/collection-form/submit/${number}/${email}`,
  EVENT_GET: `/api/${appmintEndpoints.crm_events_get.path}`,
  EVENT_DELETE: `/api/${appmintEndpoints.crm_events_delete.path}`,
  EVENT_UPDATE: `/api/${appmintEndpoints.crm_events_update.path}`,
  EVENT_CREATE: `/api/${appmintEndpoints.crm_events_create.path}`,
  FLEXDATA_GET: `/api/${appmintEndpoints.crm_flexdata_get.path}`,
  FLEXDATA_DELETE: `/api/${appmintEndpoints.crm_flexdata_delete.path}`,
  FLEXDATA_UPDATE: `/api/${appmintEndpoints.crm_flexdata_update.path}`,
  FLEXDATA_CREATE: `/api/${appmintEndpoints.crm_flexdata_create.path}`,
  CRM_COMMENT_DELETE: `/api/${appmintEndpoints.crm_comment_delete.path}`,
  CRM_COMMENT_CREATE: `/api/${appmintEndpoints.crm_comment_create.path}`,
  CRM_COMMENT_GET: `/api/${appmintEndpoints.crm_comment_get.path}`,
  CRM_ACTIVITY_MANAGE: `/api/${appmintEndpoints.crm_activity_manage.path}`,
  CRM_ACTIVITY_CUSTOMER_ACTIVITY: `/api/${appmintEndpoints.crm_activity_by_customer.path}`,
  CRM_ACTIVITY_RESOURCE_ACTIVITY: `/api/${appmintEndpoints.crm_activity_by_resource.path}`,
  STATS_SIGNAL: (datatype: string, id: string, signal: string) => `/api/stats/${datatype}/${id}/${signal}`,
  STATS_GET: (datatype: string, id: string) => `/api/stats/${datatype}/${id}`,
  STATS_BY_RESOURCE: (datatype: string, id: string) => `/api/stats/by-resource/${datatype}/${id}`,
  STATS_BY_CUSTOMER: (datatype?: string, id?: string) =>
    datatype && id ? `/api/stats/by-customer/${datatype}/${id}` : `/api/stats/by-customer`,
  NOTES: (datatype: string, id: string) => `/api/notes/${datatype}/${id}`,
  COMMENTS_LIST: (datatype: string, id: string) => `/api/comments/${datatype}/${id}`,
  COMMENTS_CREATE: (datatype: string, id: string) => `/api/comments/${datatype}/${id}`,
  COMMENTS_ONE: (commentId: string) => `/api/comments/single/${commentId}`,
  COMMENTS_UPDATE: (commentId: string) => `/api/comments/${commentId}`,
  COMMENTS_DELETE: (commentId: string) => `/api/comments/${commentId}`,
  COMMENTS_REPLIES: (commentId: string) => `/api/comments/${commentId}/replies`,
  COMMENTS_PIN: (commentId: string) => `/api/comments/${commentId}/pin`,
  COMMENTS_STATUS: (commentId: string) => `/api/comments/${commentId}/status`,
  COMMENTS_REPORT: (commentId: string) => `/api/comments/${commentId}/report`,
  COMMENTS_BY_AUTHOR: (author: string) => `/api/comments/by-author/${author}`,
  WISHLIST_GET: `/api/client-data/wishlist`,
  WISHLIST_CREATE: `/api/client-data/wishlist`,
  WISHLIST_DELETE: (wishlistId: string) => `/api/client-data/wishlist-list/${wishlistId}`,
  WISHLIST_ADD_ITEM: (productId: string) => `/api/client-data/wishlist/${productId}`,
  WISHLIST_REMOVE_ITEM: (productId: string, wishlistId?: string) =>
    wishlistId
      ? `/api/client-data/wishlist/${productId}?wishlistId=${encodeURIComponent(wishlistId)}`
      : `/api/client-data/wishlist/${productId}`,
  GET_PAGE: `/api/${appmintEndpoints.get_page.path}`,
  GET_PAGE_SECTION: `/api/${appmintEndpoints.get_page_section.path}`,
  USER_ORGS: `/api/${appmintEndpoints.user_orgs.path}`,
  USER_ORG_DELETE: `/api/${appmintEndpoints.user_org_delete.path}`,
  STORE_CATEGORIES: `/api/${appmintEndpoints.product_categories.path}`,
  ORDER: '/api/storefront/order/email',
  STORE_SUBSCRIPTION: '/api/storefront/subscriptions/get',
  STORE_COLLECTIONS: '/api/storefront/collections',
  STORE_ATTRIBUTES: '/api/storefront/attributes',
  BRANDS: '/api/storefront/brands',

  ON_SELLING_PRODUCTS: '/api/storefront/products/?category=flash',
  PRODUCT: '/api/storefront/product',
  RELATED_PRODUCTS: '/api/storefront/products/related/:productId',
  CHECKOUT_STRIPE_PAY_INTENT: '/api/storefront/stripe/intent/',
  CHECKOUT_STRIPE_SUBSCRIPTION_SESSION: '/api/storefront/stripe/subscription-session/',
  CHECKOUT_PAYPAL_CONFIG: '/api/storefront/paypal/config/',
  CHECKOUT_PAYMENT_GATEWAYS: '/api/storefront/payment-gateways',
  CHECKOUT_CART: '/api/storefront/checkout-cart/',
  UPDATE_SUBSCRIPTION: '/api/storefront/update-subscription/',
  CHECKOUT_BUY_NOW: '/api/storefront/checkout-buy-now/',
  CART_UPDATE: '/api/storefront/cart/update',
  CART_GET: '/api/storefront/cart/get',
  CART_CLEAR: '/api/storefront/cart/clear',
  PRODUCTS: '/api/storefront/products/',
  CHANGE_PASSWORD: '/api/user/change-password/',

  EMAIL_TEMPLATES: `/api/v1/email/all`,
  WEB_TEMPLATES: `/api/v1/web/all`,
  GRAPHICS: `/api/v1/graphics/all`,
  PHOTOS: `/api/v1/photos/all`,
  ICONS: `/api/v1/icons/all`,
  VIDEOS: `/api/v1/videos/all`,
  AUDIO: `/api/v1/audio/all`,

  BRANDS_ANCIENT: '/api/brands_ancient.json',
  PRODUCTS_2: '/api/products_2.json',
  SHOPS: 'api/shops.json',
  SHOP: '/api/shop.json',
  PRODUCTS_ANCIENT: '/api/products_ancient.json',
  TOP_SELLER_PRODUCTS: '/api/products_top_seller.json',
};
