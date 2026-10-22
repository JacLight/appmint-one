// from base-app/src/components/my-account/types.ts — ported verbatim; only import paths rewired.
export interface User {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string; // Legacy field
  image?: {
    url?: string;
    [key: string]: any;
  };
  dateJoined?: string;
  verified?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  twoFactorEnabled?: boolean;
  [key: string]: any; // Allow any additional fields from the customer schema
}

// SDK AddressSchema: name, street1, street2, city, state, zip, country, phone, email, company
export interface Address {
  id: string;
  label?: string;
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  company?: string;
  isDefault?: boolean;
  type?: 'billing' | 'shipping' | 'both';
}

export interface Order {
  id: string;
  orderNumber?: string;
  date?: string;
  status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items?: OrderItem[];
  total?: number;
  shippingAddress?: Address;
  billingAddress?: Address;
  trackingNumber?: string;
  estimatedDelivery?: string;
  data?: any; // BaseModel structure wrapper
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
}

export interface Reservation {
  id: string;
  reservationNumber?: string;
  serviceName?: string;
  serviceType?: string;
  date?: string;
  time?: string;
  duration?: string;
  status?: 'upcoming' | 'confirmed' | 'completed' | 'cancelled';
  location?: {
    name: string;
    address: string;
    phone: string;
  };
  provider?: {
    name: string;
    image?: string;
  };
  price?: number;
  notes?: string;
  canReschedule?: boolean;
  canCancel?: boolean;
  sk?: string;
  data?: any; // BaseModel structure wrapper
}

export interface Ticket {
  id: string;
  ticketNumber?: string;
  subject?: string;
  category?: string;
  status?: 'open' | 'in_progress' | 'waiting_reply' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createdAt?: string;
  updatedAt?: string;
  messages?: TicketMessage[];
  data?: any; // BaseModel structure wrapper
}

export interface TicketMessage {
  id: string;
  content: string;
  author: {
    name: string;
    role: 'customer' | 'support';
    avatar?: string;
  };
  timestamp: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
  }[];
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'bank';
  last4?: string;
  brand?: string;
  expiryDate?: string;
  isDefault: boolean;
  email?: string;
  bankName?: string;
  accountLast4?: string;
}

export interface WishlistItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  inStock: boolean;
  addedDate: string;
}

export interface Notification {
  id: string;
  title?: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  read?: boolean;
  timestamp?: string;
  actionUrl?: string;
  data?: any; // BaseModel structure wrapper
}

export interface Site {
  id: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: string;
  storage: {
    used: number;
    total: number;
  };
  bandwidth: {
    used: number;
    total: number;
  };
  lastUpdated: string;
}

export interface Analytics {
  visitors: {
    total: number;
    change: number;
  };
  pageViews: {
    total: number;
    change: number;
  };
  revenue: {
    total: number;
    change: number;
  };
  orders: {
    total: number;
    change: number;
  };
  chartData: {
    labels: string[];
    visitors: number[];
    revenue: number[];
  };
}

/** An account a customer can order on — an agency, department or wholesale account. */
export interface SharedAccount {
  id: string;
  name?: string;
  role?: 'manager' | 'buyer' | string;
}

/** An invitation to join one, not yet taken up. */
export interface SharedAccountInvite {
  token: string;
  accountId: string;
  accountName?: string;
  role?: 'manager' | 'buyer' | string;
  invitedByName?: string;
}

/** Someone on a shared account, as its manager sees them. */
export interface SharedAccountMember {
  associationId: string;
  customerId?: string;
  name?: string;
  email?: string;
  role?: 'manager' | 'buyer' | string;
  status?: 'active' | 'suspended' | string;
  /** Their customer record has gone; the row is kept so it can be removed. */
  missing?: boolean;
}

export interface MyAccountData {
  user?: User; // Optional for backwards compatibility
  customer?: User; // The actual field from the API
  addresses?: Address[];
  orders?: Order[];
  reservations?: Reservation[];
  tickets?: Ticket[];
  paymentMethods?: PaymentMethod[];
  wishlist?: WishlistItem[];
  notifications?: Notification[];
  sites?: Site[];
  analytics?: Analytics;
  benefits?: {
    customerId?: string;
    customerGroups?: string[];
    directBenefits?: string[];
    benefits?: Array<{
      name: string;
      title?: string;
      description?: string;
      perks?: any;
      color?: string;
      icon?: string;
      showBadge?: boolean;
      badgeText?: string;
      source?: 'group' | 'direct';
    }>;
    enrollments?: {
      pending?: any[];
      active?: any[];
      rejected?: any[];
    };
    availableBenefits?: Array<{
      name: string;
      title?: string;
      description?: string;
      perks?: any;
      requiresApproval?: boolean;
      applicationForm?: string;
      applicationFormData?: any;
    }>;
  };
  [key: string]: any; // Allow any additional fields from the API
}
