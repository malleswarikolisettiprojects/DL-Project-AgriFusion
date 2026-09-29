import React, { useEffect, useState } from 'react';
import { ACRE_TO_HA_RATIO, HA_TO_ACRE_RATIO } from '../lib/areaUnits';

interface AreaInputFieldProps {
  label?: string;
  areaHa: number;
  onChange: (newAreaHa: number) => void;
  required?: boolean;
  className?: string;
  helperText?: string;
}

export function AreaInputField({
  label = 'Farm Area',
  areaHa,
  onChange,
  required = false,
  className = '',
  helperText,
}: AreaInputFieldProps) {
  const [unit, setUnit] = useState<'acres' | 'ha'>('acres');
  const [displayValue, setDisplayValue] = useState<string>(() => {
    const initialAcres = (areaHa * HA_TO_ACRE_RATIO).toFixed(2);
    return String(parseFloat(initialAcres) || 2);
  });

  // Keep display in sync if areaHa changes externally
  useEffect(() => {
    if (unit === 'acres') {
      const computed = (areaHa * HA_TO_ACRE_RATIO).toFixed(2);
      const num = parseFloat(computed);
      // Only update if discrepancy is notable to prevent clobbering typing
      if (Math.abs((parseFloat(displayValue) || 0) - num) > 0.05) {
        setDisplayValue(String(num));
      }
    } else {
      if (Math.abs((parseFloat(displayValue) || 0) - areaHa) > 0.05) {
        setDisplayValue(String(areaHa));
      }
    }
  }, [areaHa, unit]);

  const handleInputChange = (valStr: string) => {
    setDisplayValue(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      if (unit === 'acres') {
        const computedHa = Number((parsed * ACRE_TO_HA_RATIO).toFixed(3));
        onChange(computedHa);
      } else {
        onChange(parsed);
      }
    }
  };

  const handleToggleUnit = (newUnit: 'acres' | 'ha') => {
    if (newUnit === unit) return;
    setUnit(newUnit);
    if (newUnit === 'acres') {
      const acresVal = (areaHa * HA_TO_ACRE_RATIO).toFixed(2);
      setDisplayValue(String(parseFloat(acresVal) || 2));
    } else {
      setDisplayValue(String(Number(areaHa.toFixed(2)) || 1));
    }
  };

  const computedAcres = (areaHa * HA_TO_ACRE_RATIO).toFixed(2);
  const computedHa = areaHa.toFixed(2);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-stone-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {/* Unit Toggle Pill */}
        <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-[11px] font-semibold border border-stone-200">
          <button
            type="button"
            onClick={() => handleToggleUnit('acres')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              unit === 'acres'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Acres
          </button>
          <button
            type="button"
            onClick={() => handleToggleUnit('ha')}
            className={`px-2 py-0.5 rounded-md transition-all ${
              unit === 'ha'
                ? 'bg-white text-emerald-800 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Hectares
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="number"
          step="any"
          min="0.01"
          required={required}
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={unit === 'acres' ? 'e.g. 2.5' : 'e.g. 1.0'}
          className="w-full text-xs p-2.5 pr-16 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-stone-900 font-medium"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-600 pointer-events-none uppercase">
          {unit === 'acres' ? 'Acres' : 'Ha'}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-stone-600 px-0.5">
        <span>
          Equivalent: <strong className="text-stone-700">{computedAcres} Acres</strong> ({computedHa} Hectares)
        </span>
        {helperText && <span className="text-stone-600">{helperText}</span>}
      </div>
    </div>
  );
}
