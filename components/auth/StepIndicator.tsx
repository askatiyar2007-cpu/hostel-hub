'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { num: 1, label: 'Role' },
    { num: 2, label: 'Details' },
    { num: 3, label: 'Verify' },
  ];

  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between max-w-[260px] mx-auto relative">
        {/* Background track */}
        <div className="absolute top-3 left-3 right-3 h-[2px] bg-teal-900/60 -z-0" />

        {/* Active progress bar */}
        <div
          className="absolute top-3 left-3 h-[2px] bg-[#0D9488] transition-all duration-300 ease-out -z-0"
          style={{
            width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : 'calc(100% - 24px)',
          }}
        />

        {steps.map((step) => {
          const isDone = currentStep > step.num;
          const isActive = currentStep === step.num;

          return (
            <div key={step.num} className="relative z-10 flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                  isDone
                    ? 'bg-[#0D9488] text-white shadow-xs'
                    : isActive
                    ? 'bg-[#0D9488] text-white ring-3 ring-[#0D9488]/30 shadow-xs'
                    : 'bg-[#075A56] border border-teal-400/20 text-teal-200/50'
                }`}
              >
                {isDone ? <Check className="h-3 w-3 stroke-[3]" /> : step.num}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1 transition-colors duration-150 ${
                  isActive
                    ? 'text-teal-200 font-bold'
                    : isDone
                    ? 'text-teal-100'
                    : 'text-teal-300/40'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
