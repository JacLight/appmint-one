'use client';

// from base-app/src/components/storefront/OrderTracking.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { storefrontAPI, ShipmentTracking, OrderShippingStatus } from '@/modules/store/lib/storefront-api';
import {
  Package,
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/modules/store/components/ui/button';
import { Input } from '@/modules/store/components/ui/input';

interface OrderTrackingProps {
  orderNumber?: string;
  /** The email on the order — the server only shows an order to someone who knows it. */
  email?: string;
  trackingNumber?: string;
  showSearch?: boolean;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'text-slate-500', icon: <Clock className="w-5 h-5" />, label: 'Pending' },
  label_created: { color: 'text-blue-500', icon: <Package className="w-5 h-5" />, label: 'Label Created' },
  shipped: { color: 'text-blue-600', icon: <Package className="w-5 h-5" />, label: 'Shipped' },
  in_transit: { color: 'text-indigo-600', icon: <Truck className="w-5 h-5" />, label: 'In Transit' },
  out_for_delivery: { color: 'text-amber-600', icon: <Truck className="w-5 h-5" />, label: 'Out for Delivery' },
  delivered: { color: 'text-emerald-600', icon: <CheckCircle className="w-5 h-5" />, label: 'Delivered' },
  exception: { color: 'text-red-500', icon: <AlertCircle className="w-5 h-5" />, label: 'Exception' },
  cancelled: { color: 'text-slate-400', icon: <AlertCircle className="w-5 h-5" />, label: 'Cancelled' },
  returned: { color: 'text-orange-500', icon: <Package className="w-5 h-5" />, label: 'Returned' },
};

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  orderNumber: initialOrderNumber,
  email: initialEmail,
  trackingNumber: initialTrackingNumber,
  showSearch = true,
}) => {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber || '');
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber || '');
  const [orderEmail, setOrderEmail] = useState(initialEmail || '');
  const [orderStatus, setOrderStatus] = useState<OrderShippingStatus | null>(null);
  const [shipmentTracking, setShipmentTracking] = useState<ShipmentTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null);

  // Auto-fetch if initial values provided
  useEffect(() => {
    if (initialOrderNumber) {
      fetchOrderStatus(initialOrderNumber, initialEmail);
    } else if (initialTrackingNumber) {
      fetchShipmentTracking(initialTrackingNumber);
    }
  }, [initialOrderNumber, initialTrackingNumber]);

  const fetchOrderStatus = async (orderNum: string, email?: string) => {
    if (!orderNum.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const status = await storefrontAPI.getOrderShippingStatus(orderNum, email);
      setOrderStatus(status);
      setShipmentTracking(null);

      // Auto-expand first shipment
      if (status.shipments.length > 0) {
        setExpandedShipment(status.shipments[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch order status:', err);
      setError('Order not found. Please check the order number and the email used for the order, and try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchShipmentTracking = async (trackNum: string) => {
    if (!trackNum.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const tracking = await storefrontAPI.trackShipment(trackNum);
      setShipmentTracking(tracking);
      setOrderStatus(null);
    } catch (err) {
      console.error('Failed to fetch tracking:', err);
      setError('Tracking information not found. Please check the tracking number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (orderNumber.trim()) {
      fetchOrderStatus(orderNumber, orderEmail);
    } else if (trackingNumber.trim()) {
      fetchShipmentTracking(trackingNumber);
    }
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status.toLowerCase()] || statusConfig.pending;
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      {showSearch && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Track Your Order</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Order Number</label>
              <Input
                placeholder="e.g., ORD-2024-001234"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  setTrackingNumber('');
                }}
                className="w-full"
              />
            </div>
            {orderNumber.trim() && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email used for the order</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={orderEmail}
                  onChange={(e) => setOrderEmail(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
            <div className="text-center text-sm text-slate-500">or</div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tracking Number</label>
              <Input
                placeholder="e.g., 794644790132"
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value);
                  setOrderNumber('');
                }}
                className="w-full"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading || (!orderNumber.trim() && !trackingNumber.trim()) || (!!orderNumber.trim() && !orderEmail.trim())}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                'Track Order'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Order Status */}
      {orderStatus && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Order {orderStatus.orderNumber}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Status: <span className="font-medium capitalize">{orderStatus.overallStatus.replace('_', ' ')}</span>
                </p>
              </div>
              <Button
                variant="outline"
                className="text-sm px-3 py-1.5"
                onClick={() => fetchOrderStatus(orderStatus.orderNumber)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Shipped Items */}
          {orderStatus.shipped.length > 0 && (
            <div className="p-6 border-b border-slate-100">
              <h4 className="font-medium text-slate-900 mb-4">Shipped Items</h4>
              <div className="space-y-4">
                {orderStatus.shipped.map((item, idx) => {
                  const statusInfo = getStatusInfo(item.status);
                  return (
                    <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className={`p-2 rounded-full bg-white ${statusInfo.color}`}>
                        {statusInfo.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-600">{item.carrier}</span>
                        </div>
                        {item.trackingNumber && (
                          <button
                            onClick={() => fetchShipmentTracking(item.trackingNumber)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            Track: {item.trackingNumber}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Shipped {new Date(item.shipDate).toLocaleDateString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Items */}
          {orderStatus.pending.length > 0 && (
            <div className="p-6 border-b border-slate-100">
              <h4 className="font-medium text-slate-900 mb-4">Pending Items</h4>
              <div className="space-y-3">
                {orderStatus.pending.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        {item.pendingQuantity} of {item.orderedQuantity} pending
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipment Details */}
          {orderStatus.shipments.length > 0 && (
            <div className="p-6">
              <h4 className="font-medium text-slate-900 mb-4">Shipment Details</h4>
              <div className="space-y-3">
                {orderStatus.shipments.map((shipment) => (
                  <div key={shipment.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedShipment(expandedShipment === shipment.id ? null : shipment.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-slate-500" />
                        <div className="text-left">
                          <p className="font-medium text-slate-900">{shipment.carrier}</p>
                          <p className="text-sm text-slate-500">{shipment.tracking}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-medium ${getStatusInfo(shipment.status).color}`}>
                          {getStatusInfo(shipment.status).label}
                        </span>
                        {expandedShipment === shipment.id ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </button>
                    {expandedShipment === shipment.id && (
                      <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <button
                          onClick={() => fetchShipmentTracking(shipment.tracking)}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          View detailed tracking
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shipment Tracking Details */}
      {shipmentTracking && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Tracking Details</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {shipmentTracking.carrier} - {shipmentTracking.tracking_code}
                </p>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-2 ${getStatusInfo(shipmentTracking.status).color}`}>
                  {getStatusInfo(shipmentTracking.status).icon}
                  <span className="font-medium">{getStatusInfo(shipmentTracking.status).label}</span>
                </div>
                {shipmentTracking.est_delivery_date && (
                  <p className="text-sm text-slate-500 mt-1">
                    Est. delivery: {new Date(shipmentTracking.est_delivery_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="p-6">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

              <div className="space-y-6">
                {shipmentTracking.tracking_details.map((detail, idx) => {
                  const isFirst = idx === 0;
                  const statusInfo = getStatusInfo(detail.status);

                  return (
                    <div key={idx} className="relative flex gap-4">
                      <div
                        className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center ${
                          isFirst ? 'bg-slate-900' : 'bg-white border-2 border-slate-300'
                        }`}
                      >
                        {isFirst && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className={`font-medium ${isFirst ? 'text-slate-900' : 'text-slate-700'}`}>
                          {detail.message}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                          <span>{new Date(detail.datetime).toLocaleString()}</span>
                          {detail.tracking_location && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {detail.tracking_location.city}, {detail.tracking_location.state}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTracking;
