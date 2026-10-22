'use client';

// from base-app/src/components/storefront/OrderConfirmation.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { showRentalDate, rentalUnit } from '@/modules/store/components/rental/dates';
import { useParams, useRouter } from 'next/navigation';
import { OrderReceipt } from './OrderReceipt';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/store/components/ui/card';
import { Button } from '@/modules/store/components/ui/button';
import { Badge } from '@/modules/store/components/ui/badge';
import { Separator } from '@/modules/store/components/ui/separator';
import { LineItemOptions } from './LineItemOptions';
import type { LineItemDesign, LineItemOption } from './utils/custom-attributes';
import { CheckCircle, Package, MapPin, CreditCard, Download, ArrowLeft, Loader2, Calendar, Truck } from 'lucide-react';

// SDK AddressSchema: name, street1, street2, city, state, zip, country, phone, company, email
interface AddressData {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  company?: string;
  email?: string;
}

// Pickup location for rental items
interface PickupLocation {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  hours?: string;
  phone?: string;
}

interface OrderProduct {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  // Chosen attribute values - preset picks plus customer-supplied text/files
  options?: LineItemOption[];
  design?: LineItemDesign;
  attributes?: Record<string, any>;
  itemType?: 'product' | 'rental';
  // Rental fields at item level (matches SDK sf-cart schema)
  startDate?: string;
  endDate?: string;
  unitPrice?: number;
  amount?: number;
  lineTotal?: number;
  deposit?: number;
  rentalPeriod?: string;
  duration?: number;
  fees?: Array<{ name: string; amount: number }>;
  // Pickup location for rentals
  pickupLocation?: PickupLocation;
  // Fulfillment settings for rentals
  fulfillment?: {
    type: 'pickup' | 'delivery';
    address?: AddressData;
    instructions?: string;
  };
  return?: {
    type: 'dropoff' | 'pickup';
    address?: AddressData;
    instructions?: string;
  };
}

interface OrderData {
  sk: string;
  number: string;
  status: string;
  name: string;
  email: string;
  amount: number;
  tax: number;
  shippingCost: number;
  currency: string;
  paymentGateway: string;
  paymentRef?: string;
  createdAt: string;
  productItems?: OrderProduct[];
  rentalItems?: OrderProduct[];
  shippingAddress: AddressData;
  billingAddress: AddressData;
  deliveryAddress?: AddressData;
  pickupAddress?: AddressData;
  // Totals from server
  productSubtotal?: number;
  productTotal?: number;
  productTax?: number;
  productShipping?: number;
  rentalSubtotal?: number;
  rentalTotal?: number;
  rentalDeposit?: number;
  deposit?: number;
  rentalTax?: number;
  rentalDeliveryFee?: number;
  // Shipping
  freeShipping?: boolean;
  originalShipping?: number;
  // Discounts
  discount?: number;
  discountCode?: string;
  discounts?: Array<{
    code?: string;
    name: string;
    amount: number;
    type: string;
  }>;
  shippingInfo?: Array<{
    carrier: string;
    tracker: string;
    trackingUrl?: string;
    rate: string;
    cost: number;
  }>;
}

interface OrderConfirmationProps {
  site?: any;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ site }) => {
  const params = useParams();
  const router = useRouter();
  const orderEmail = (params.slug as string[])?.[2] || (params.orderEmail as string);
  const orderNumber = (params.slug as string[])?.[3] || (params.orderNumber as string);

  const storePage = site?.data?.storefront?.storePage;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderNumber) {
        setError('Order number not found');
        setLoading(false);
        return;
      }
      try {
        const orderData = await storefrontAPI.getOrderByEmail(orderEmail, orderNumber);
        if (orderData) {
          setOrder(orderData);
        } else {
          setError('Order not found');
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderNumber, orderEmail]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new':
      case 'paid':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = dateString ? new Date(dateString) : new Date();
    const validDate = isNaN(date.getTime()) ? new Date() : date;
    return validDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Preset picks appear in the legacy `attributes` map AND in `options[]`.
  // When both are present show only the customer-supplied options (uploaded
  // artwork, typed instructions) so nothing is listed twice.
  const displayOptions = (item: OrderProduct) =>
    item.attributes && Object.keys(item.attributes).length > 0 ? item.options?.filter((option) => option.type) : item.options;

  const formatDateRange = (start?: string, end?: string) => {
    if (!start || !end) return '';
    return `${showRentalDate(start)} - ${showRentalDate(end)}`;
  };

  const downloadInvoice = async () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-red-800 mb-2">Order Not Found</h1>
            <p className="text-red-600 mb-4">{error || 'The order you are looking for could not be found.'}</p>
            {storePage && (
              <Button onClick={() => router.push(`/${storePage}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Continue Shopping
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Get items and totals directly from order (SDK sf-order schema)
  const productItems = order.productItems || [];
  const rentalItems = order.rentalItems || [];
  const hasProducts = productItems.length > 0;
  const hasRentals = rentalItems.length > 0;

  // Totals from server - no calculations
  const productSubtotal = order.productSubtotal ?? 0;
  const productTotal = order.productTotal ?? 0;
  const productTax = order.productTax ?? 0;
  const productShipping = order.productShipping ?? 0;
  const rentalSubtotal = order.rentalSubtotal ?? 0;
  const rentalTotal = order.rentalTotal ?? 0;
  const rentalDeposit = order.rentalDeposit ?? order.deposit ?? 0;
  const rentalTax = order.rentalTax ?? 0;
  const rentalDeliveryFee = order.rentalDeliveryFee ?? 0;
  const total = order.amount ?? 0;

  return <OrderReceipt order={order} storePage={storePage} onDownloadInvoice={downloadInvoice} />;
};
