'use client';
// from base-app/src/components/my-account/components/StatCard.tsx — ported verbatim; only import paths rewired.
import React from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'gray';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, trend, color = 'purple', onClick }) => {
  const colorClasses = {
    purple: 'from-purple-500 to-purple-600 shadow-purple-200',
    blue: 'from-blue-500 to-blue-600 shadow-blue-200',
    green: 'from-green-500 to-green-600 shadow-green-200',
    orange: 'from-orange-500 to-orange-600 shadow-orange-200',
    red: 'from-red-500 to-red-600 shadow-red-200',
    gray: 'from-gray-500 to-gray-600 shadow-gray-200',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl 
        transition-all duration-300 transform hover:-translate-y-1
        ${onClick ? 'cursor-pointer' : ''}
        group overflow-hidden
      `}
    >
      {/* Background decoration */}
      <div
        className={`
        absolute -top-24 -right-24 w-48 h-48 rounded-full 
        bg-gradient-to-br ${colorClasses[color]} opacity-10 
        group-hover:scale-110 transition-transform duration-500
      `}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`
            p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}
            text-white shadow-lg ${onClick ? 'group-hover:scale-110' : ''} 
            transition-transform duration-300
          `}
          >
            <IconRenderer icon={icon} className="w-6 h-6" />
          </div>

          {trend && (
            <div
              className={`
              flex items-center space-x-1 text-sm font-medium
              ${trend.isPositive ? 'text-green-600' : 'text-red-600'}
            `}
            >
              <span>
                {trend.isPositive ? '+' : '-'}
                {Math.abs(trend.value)}%
              </span>
              <svg className={`w-4 h-4 ${trend.isPositive ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
          )}
        </div>

        <h3 className="text-4xl font-bold text-gray-900 mb-1">{typeof value === 'number' ? value.toLocaleString() : value}</h3>
        <p className="text-gray-600 font-medium">{title}</p>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};
