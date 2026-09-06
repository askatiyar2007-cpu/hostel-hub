// app/components/Stepper.tsx
import React from 'react';

interface Step {
  label: string;
}

interface StepperProps {
  steps: Step[];
  /** 1‑based index of the active step */
  currentStep: number;
}

export default function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-2 md:space-y-0">
      {steps.map((step, idx) => {
        const stepNumber = idx + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        const circleClasses = isCompleted
          ? 'bg-teal-600 text-white'
          : isActive
          ? 'border-2 border-teal-600 bg-white text-teal-600'
          : 'bg-gray-200 text-gray-600';
        return (
          <div key={idx} className="flex items-center">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${circleClasses} text-xs font-medium`}
            >
              {stepNumber}
            </span>
            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
