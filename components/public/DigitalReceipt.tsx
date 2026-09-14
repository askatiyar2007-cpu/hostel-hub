'use client';

import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function DigitalReceipt() {
  const [rentCount, setRentCount] = useState(0);
  const [electricityCount, setElectricityCount] = useState(0);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const billingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!billingRef.current) return;
    const RENT_TARGET = 5000;
    const ELECTRICITY_TARGET = 840;
    const MAINTENANCE_TARGET = 300;
    const TOTAL_TARGET = 6140;
    let animated = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated) {
            animated = true;
            observer.unobserve(entry.target);
            const duration = 1400; // ms
            const start = performance.now();
            const step = (now: number) => {
              const elapsed = now - start;
              const progress = Math.min(elapsed / duration, 1);
              // Cubic ease-out
              const eased = 1 - Math.pow(1 - progress, 3);
              setRentCount(Math.round(RENT_TARGET * eased));
              setElectricityCount(Math.round(ELECTRICITY_TARGET * eased));
              setMaintenanceCount(Math.round(MAINTENANCE_TARGET * eased));
              setTotalCount(Math.round(TOTAL_TARGET * eased));
              if (progress < 1) {
                requestAnimationFrame(step);
              }
            };
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(billingRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={billingRef} className="relative w-full max-w-md mx-auto">
      {/* Ambient shadow glow */}
      <div className="absolute -inset-2 bg-gradient-to-r from-teal-500/15 via-emerald-500/10 to-teal-500/15 rounded-3xl blur-xl" />

      {/* Main Thermal Receipt Container */}
      <div className="relative bg-white rounded-3xl shadow-2xl shadow-teal-950/10 border border-slate-200/90 overflow-hidden font-sans">
        {/* Decorative Top Serration Bar */}
        <div className="h-3 w-full bg-slate-100 flex justify-around items-center px-2 overflow-hidden border-b border-slate-200/60">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 bg-[#FAFCFB] rotate-45 transform -translate-y-1.5" />
          ))}
        </div>

        {/* Receipt Header */}
        <div className="p-6 sm:p-8 pb-4">
          <div className="flex items-start justify-between border-b border-dashed border-slate-200 pb-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0F766E] bg-teal-50 px-2.5 py-1 rounded-md">
                Official Statement
              </span>
              <h4 className="text-xl font-bold text-slate-900 font-display mt-2">
                Hostel<span className="text-[#0F766E]">Hub</span> Stay Invoice
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Inv #HH-2026-8942 • Monthly Resident Cycle</p>
            </div>

            {/* Authentic "PAID" Seal Stamp */}
            <div className="flex flex-col items-center justify-center border-2 border-emerald-600 bg-emerald-50/80 px-3 py-1.5 rounded-xl rotate-3 shadow-xs">
              <div className="flex items-center gap-1 text-emerald-700 font-black text-xs tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5" />
                PAID
              </div>
              <span className="text-[9px] text-emerald-800/80 font-medium">DIRECT AUTO-PAY</span>
            </div>
          </div>

          {/* Breakdown Items */}
          <div className="py-5 space-y-4 text-sm">
            {/* Rent */}
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">Rent</p>
                <p className="text-[11px] text-slate-600">Single Occupancy • Room 204</p>
              </div>
              <span className="font-mono text-base font-bold text-slate-900">
                ₹{rentCount.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Electricity */}
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">Electricity</p>
                <p className="text-[11px] text-slate-600">Sub-meter verified • 84 units</p>
              </div>
              <span className="font-mono text-base font-bold text-slate-900">
                ₹{electricityCount.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Maintenance */}
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">Maintenance</p>
                <p className="text-[11px] text-slate-600">Mesh Wi-Fi, Water & Cleaning</p>
              </div>
              <span className="font-mono text-base font-bold text-slate-900">
                ₹{maintenanceCount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Perforated Divider */}
          <div className="relative py-2">
            <div className="border-t-2 border-dashed border-slate-200" />
            <div className="absolute -left-10 top-0.5 w-4 h-4 bg-[#FAFCFB] rounded-full" />
            <div className="absolute -right-10 top-0.5 w-4 h-4 bg-[#FAFCFB] rounded-full" />
          </div>

          {/* Total Amount */}
          <div className="pt-3 pb-2 flex justify-between items-center bg-teal-50/70 -mx-6 sm:-mx-8 px-6 sm:px-8 py-4 my-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total</span>
              <p className="text-[11px] text-slate-500">Zero hidden fees • All-inclusive</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[#0F766E] tracking-tight">
                ₹{totalCount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Receipt Footer Metadata & Barcode */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
              <span>Instant Digital Receipt</span>
            </div>

            {/* Simulated barcode */}
            <div className="flex items-center gap-0.5 h-6">
              {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3].map((w, i) => (
                <div key={i} className="bg-slate-300 h-full rounded-xs" style={{ width: `${w}px` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Decorative Bottom Serration Bar */}
        <div className="h-3 w-full bg-slate-100 flex justify-around items-center px-2 overflow-hidden border-t border-slate-200/60">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 bg-[#FAFCFB] rotate-45 transform translate-y-1.5" />
          ))}
        </div>
      </div>
    </div>
  );
}
