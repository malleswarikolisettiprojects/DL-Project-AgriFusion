import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Download,
  Droplets,
  Edit3,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Layers,
  MapPin,
  Plus,
  RotateCcw,
  Sparkles,
  Sprout,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  deleteDailyFieldAction,
  getAllFieldActionDates,
  getCategoryBadge,
  getDailyFieldActions,
  saveDailyFieldAction,
  toggleFieldActionCompletion,
} from '../lib/dailyFieldStorage';
import type { DailyFieldAction, FieldActionCategory, UserFarmProfile } from '../types';

export interface DailyFieldLogSectionProps {
  profile: UserFarmProfile;
  language?: 'en' | 'te';
  initialDate?: string;
}

const CATEGORY_OPTIONS: Array<{ id: FieldActionCategory; labelEn: string }> = [
  { id: 'irrigation', labelEn: 'Irrigation & Pumping' },
  { id: 'fertilizer', labelEn: 'Fertilizer & Nutrition' },
  { id: 'pest_disease', labelEn: 'Pest & Disease Spray' },
  { id: 'sowing_tillage', labelEn: 'Tillage & Sowing' },
  { id: 'weeding', labelEn: 'Weeding & Hoeing' },
  { id: 'harvesting', labelEn: 'Harvest & Post-Harvest' },
  { id: 'mandi_sale', labelEn: 'Mandi & Crop Sale' },
  { id: 'machinery_labor', labelEn: 'Machinery & Labor' },
  { id: 'other', labelEn: 'General Field Work' },
];

export function DailyFieldLogSection({ profile, initialDate }: DailyFieldLogSectionProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Selected Date state - ANY day can be retrieved!
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) return initialDate;
    try {
      const stored = localStorage.getItem('agrifusion_selected_field_date');
      if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
    } catch {}
    return todayStr;
  });

  const handleSelectDate = (d: string) => {
    setSelectedDate(d);
    try {
      localStorage.setItem('agrifusion_selected_field_date', d);
    } catch {}
  };
  const [actionsForDate, setActionsForDate] = useState<DailyFieldAction[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');

  // New action modal / form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<FieldActionCategory>('irrigation');
  const [newIsCompleted, setNewIsCompleted] = useState<boolean>(true);
  const [newTimeOfDay, setNewTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'all_day'>('morning');
  const [newArea, setNewArea] = useState(`${profile?.area_ha || 2.5} Acres`);
  const [newInputs, setNewInputs] = useState('');
  const [newDuration, setNewDuration] = useState<string>('2.0');
  const [newCost, setNewCost] = useState<string>('');
  const [newNotes, setNewNotes] = useState('');
  const [newReasonIfNotCompleted, setNewReasonIfNotCompleted] = useState('');

  // Reason modal when unchecking a completed task
  const [uncompleteTargetId, setUncompleteTargetId] = useState<string | null>(null);
  const [uncompleteReason, setUncompleteReason] = useState<string>('');

  const refreshDayData = (date: string) => {
    const list = getDailyFieldActions(date);
    setActionsForDate(list);
    const dates = getAllFieldActionDates();
    setAvailableDates(dates);
  };

  useEffect(() => {
    refreshDayData(selectedDate);
  }, [selectedDate]);

  // Navigate back/forward by day
  const changeDateByOffset = (offsetDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offsetDays);
    const newYmd = current.toISOString().slice(0, 10);
    handleSelectDate(newYmd);
  };

  const handleToggle = (action: DailyFieldAction) => {
    if (action.isCompleted) {
      // If currently completed, prompt for reason to mark as pending/uncompleted
      setUncompleteTargetId(action.id);
      setUncompleteReason('');
    } else {
      // Mark as completed immediately
      toggleFieldActionCompletion(action.id);
      refreshDayData(selectedDate);
    }
  };

  const confirmMarkUncompleted = () => {
    if (uncompleteTargetId) {
      toggleFieldActionCompletion(uncompleteTargetId, uncompleteReason.trim() || 'Deferred / Pending field review');
      setUncompleteTargetId(null);
      setUncompleteReason('');
      refreshDayData(selectedDate);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this field action record?')) {
      deleteDailyFieldAction(id);
      refreshDayData(selectedDate);
    }
  };

  const handleSaveNewAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newAction: DailyFieldAction = {
      id: `fa-${Date.now()}`,
      date: selectedDate,
      title: newTitle.trim(),
      category: newCategory,
      isCompleted: newIsCompleted,
      timeOfDay: newTimeOfDay,
      areaCovered: newArea.trim() || undefined,
      inputsUsed: newInputs.trim() || undefined,
      durationHours: newDuration ? parseFloat(newDuration) : undefined,
      costInr: newCost ? parseFloat(newCost) : undefined,
      notes: newNotes.trim() || undefined,
      reasonIfNotCompleted: !newIsCompleted ? (newReasonIfNotCompleted.trim() || 'Work postponed or pending resources') : undefined,
      createdAt: new Date().toISOString(),
    };

    saveDailyFieldAction(newAction);
    setIsAddModalOpen(false);

    // Reset form defaults
    setNewTitle('');
    setNewInputs('');
    setNewNotes('');
    setNewCost('');
    setNewReasonIfNotCompleted('');
    setNewIsCompleted(true);

    refreshDayData(selectedDate);
  };

  // Export Daily Ledger
  const handleExportDailyLedger = () => {
    const csvRows = [
      ['Date', 'Time of Day', 'Field Operation Title', 'Category', 'Status', 'Area Covered', 'Inputs Applied', 'Duration (Hrs)', 'Cost (INR)', 'Notes / Deferral Reason'],
      ...actionsForDate.map((a) => [
        a.date,
        a.timeOfDay || '',
        `"${a.title.replace(/"/g, '""')}"`,
        a.category,
        a.isCompleted ? 'COMPLETED' : 'NOT COMPLETED',
        `"${(a.areaCovered || '').replace(/"/g, '""')}"`,
        `"${(a.inputsUsed || '').replace(/"/g, '""')}"`,
        a.durationHours || '',
        a.costInr || '',
        `"${((a.isCompleted ? a.notes : a.reasonIfNotCompleted) || '').replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AgriFusion_Field_Register_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Date metrics calculations
  const totalTasks = actionsForDate.length;
  const completedTasks = actionsForDate.filter((a) => a.isCompleted);
  const pendingTasks = actionsForDate.filter((a) => !a.isCompleted);
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Filtered view
  const visibleActions = actionsForDate.filter((a) => {
    if (filterStatus === 'completed') return a.isCompleted;
    if (filterStatus === 'pending') return !a.isCompleted;
    return true;
  });

  // Human readable date format
  const dateObj = new Date(`${selectedDate}T00:00:00`);
  const dateFormatted = dateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Official Register Banner / Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-r from-[#14532D] via-emerald-900 to-[#14532D] text-white border border-emerald-700 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-emerald-700/80 border border-emerald-500/50 text-emerald-100">
                Official Farm Register • Daily Field Ledger
              </span>
              <span className="text-xs text-emerald-200">
                {profile?.district || 'Visakhapatnam'}, {profile?.state || 'Andhra Pradesh'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold flex items-center gap-2 tracking-tight">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
              <span>Day-Wise Field Operations & Activity Register</span>
            </h3>
            <p className="text-xs text-emerald-100 leading-relaxed max-w-2xl">
              Log, track, and retrieve day-by-day farming tasks. Accurately inspect what was <strong>completed</strong> and what was <strong>not completed</strong> for any selected date in your seasonal cycle.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-stone-950" />
              <span>+ Log Field Action</span>
            </button>
            <button
              type="button"
              onClick={handleExportDailyLedger}
              disabled={actionsForDate.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40"
              title="Export this day's ledger to CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* DATE RETRIEVAL TOOLBAR - "Make sure that any day can be retrieved" */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-stone-100">
          {/* Day Navigation & Calendar Picker */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => changeDateByOffset(-1)}
              className="p-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Native Date Picker to retrieve ANY Day */}
            <div className="relative inline-flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) handleSelectDate(e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-900 cursor-pointer shadow-2xs hover:border-[#14532D] focus:ring-2 focus:ring-[#14532D]/20 transition-all"
                title="Select any date to retrieve day-wise farm history"
              />
            </div>

            <button
              type="button"
              onClick={() => changeDateByOffset(1)}
              className="p-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Quick Jumps */}
            <div className="flex flex-wrap items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={() => handleSelectDate(todayStr)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  selectedDate === todayStr
                    ? 'bg-[#14532D] text-white shadow-2xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  handleSelectDate(y.toISOString().slice(0, 10));
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10)
                    ? 'bg-[#14532D] text-white shadow-2xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                Yesterday
              </button>
              {/* Dynamic Quick Jumps for active dates */}
              {availableDates
                .filter((d) => d !== todayStr && d !== new Date(Date.now() - 86400000).toISOString().slice(0, 10))
                .slice(0, 3)
                .map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleSelectDate(d)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      selectedDate === d
                        ? 'bg-[#14532D] text-white shadow-2xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                    title={`Jump to records for ${d}`}
                  >
                    <span>{d}</span>
                  </button>
                ))}
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 7);
                  handleSelectDate(d.toISOString().slice(0, 10));
                }}
                className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              >
                -7 Days
              </button>
            </div>
          </div>

          {/* Current Date Display */}
          <div className="text-left md:text-right">
            <div className="text-sm font-extrabold text-stone-900 flex items-center md:justify-end gap-1.5">
              <CalendarDays className="w-4 h-4 text-[#14532D]" />
              <span>{dateFormatted}</span>
            </div>
            <p className="text-[11px] text-emerald-800 font-medium">
              {dateObj.toLocaleDateString('en-US', { weekday: 'long' })} • {selectedDate === todayStr ? 'Current Field Day' : 'Archived Field Log'}
            </p>
          </div>
        </div>

        {/* Day Summary Cards: Completed vs Not Completed */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
              Total Operations
            </span>
            <div className="text-xl font-extrabold text-stone-900 mt-0.5">{totalTasks}</div>
            <span className="text-[11px] text-stone-500">Planned for date</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Completed
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-950 mt-0.5">{completedTasks.length}</div>
            <span className="text-[11px] text-emerald-700">{completionPercentage}% fulfillment</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Not Completed
              </span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-amber-950 mt-0.5">{pendingTasks.length}</div>
            <span className="text-[11px] text-amber-700">Deferred / Rain alert</span>
          </div>

          <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 text-sky-900">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Quick Filter
              </span>
              <Filter className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filterStatus === 'all' ? 'bg-sky-700 text-white font-bold' : 'bg-white text-sky-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('completed')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filterStatus === 'completed' ? 'bg-emerald-700 text-white font-bold' : 'bg-white text-emerald-900'
                }`}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  filterStatus === 'pending' ? 'bg-amber-700 text-white font-bold' : 'bg-white text-amber-900'
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FIELD ACTIONS LIST FOR THE RETRIEVED DAY */}
      <div className="space-y-4">
        {visibleActions.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-stone-800">
                No recorded field actions found for {dateFormatted}
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                No farming tasks are logged yet for this specific date. Click below to add irrigation, fertilization, pest spraying, or tillage records for this day.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Log Action for {selectedDate}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* SEPARATE SECTIONS FOR COMPLETED AND NOT COMPLETED FOR MAXIMUM CLARITY */}
            
            {/* 1. COMPLETED ACTIONS SECTION */}
            {(filterStatus === 'all' || filterStatus === 'completed') && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">
                      Completed Field Operations
                    </h4>
                    <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {completedTasks.length}
                    </span>
                  </div>
                </div>

                {completedTasks.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-dashed border-stone-200 text-xs text-stone-500 text-center">
                    No completed tasks logged for this day.
                  </div>
                ) : (
                  completedTasks.map((action) => {
                    const badge = getCategoryBadge(action.category);
                    return (
                      <div
                        key={action.id}
                        className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggle(action)}
                            className="mt-0.5 w-6 h-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
                            title="Click to toggle back to pending/not completed"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badge.colorClass}`}>
                                {badge.label}
                              </span>
                              {action.timeOfDay && (
                                <span className="text-[10px] font-medium text-stone-500 capitalize bg-stone-100 px-1.5 py-0.5 rounded">
                                  {action.timeOfDay.replace('_', ' ')}
                                </span>
                              )}
                              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Completed</span>
                              </span>
                            </div>

                            <h5 className="text-sm font-bold text-stone-900 leading-snug">
                              {action.title}
                            </h5>

                            {/* Details: inputs, area, duration */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 pt-0.5">
                              {action.areaCovered && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                                  <strong>Area:</strong> {action.areaCovered}
                                </span>
                              )}
                              {action.inputsUsed && (
                                <span className="flex items-center gap-1">
                                  <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                                  <strong>Inputs:</strong> {action.inputsUsed}
                                </span>
                              )}
                              {action.durationHours && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                                  <strong>Time:</strong> {action.durationHours} hrs
                                </span>
                              )}
                              {action.costInr && (
                                <span className="flex items-center gap-1">
                                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                                  <strong>Cost:</strong> ₹{action.costInr}
                                </span>
                              )}
                            </div>

                            {action.notes && (
                              <p className="text-xs text-stone-600 bg-stone-50 p-2 rounded-lg border border-stone-100 mt-1 italic">
                                &ldquo;{action.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-stone-100">
                          <button
                            type="button"
                            onClick={() => handleToggle(action)}
                            className="text-[11px] font-semibold text-stone-500 hover:text-amber-700 underline cursor-pointer"
                          >
                            Mark Not Completed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(action.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete action"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 2. NOT COMPLETED / DEFERRED ACTIONS SECTION */}
            {(filterStatus === 'all' || filterStatus === 'pending') && (
              <div className="space-y-2.5 pt-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                      Not Completed / Deferred Operations
                    </h4>
                    <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      {pendingTasks.length}
                    </span>
                  </div>
                </div>

                {pendingTasks.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-dashed border-stone-200 text-xs text-stone-500 text-center">
                    No pending or deferred tasks for this day. All planned operations completed!
                  </div>
                ) : (
                  pendingTasks.map((action) => {
                    const badge = getCategoryBadge(action.category);
                    return (
                      <div
                        key={action.id}
                        className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 shadow-2xs hover:border-amber-300 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggle(action)}
                            className="mt-0.5 w-6 h-6 rounded-lg border-2 border-amber-400 bg-white hover:bg-emerald-50 hover:border-emerald-500 text-stone-400 hover:text-emerald-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
                            title="Click to mark as completed"
                          >
                            <CheckCircle2 className="w-4 h-4 opacity-40 hover:opacity-100" />
                          </button>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badge.colorClass}`}>
                                {badge.label}
                              </span>
                              <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-700" />
                                <span>NOT COMPLETED</span>
                              </span>
                              {action.timeOfDay && (
                                <span className="text-[10px] font-medium text-stone-500 capitalize bg-stone-100 px-1.5 py-0.5 rounded">
                                  {action.timeOfDay.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            <h5 className="text-sm font-bold text-stone-900 leading-snug">
                              {action.title}
                            </h5>

                            {/* Why it was not completed */}
                            {action.reasonIfNotCompleted && (
                              <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-xs text-amber-950 font-medium space-y-0.5">
                                <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-900">
                                  Reason for Deferral / Pending:
                                </span>
                                <p>{action.reasonIfNotCompleted}</p>
                              </div>
                            )}

                            {/* Planned Inputs & Details */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 pt-0.5">
                              {action.areaCovered && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                                  <strong>Planned Area:</strong> {action.areaCovered}
                                </span>
                              )}
                              {action.inputsUsed && (
                                <span className="flex items-center gap-1">
                                  <Sprout className="w-3.5 h-3.5 text-stone-400" />
                                  <strong>Intended Inputs:</strong> {action.inputsUsed}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-amber-100">
                          <button
                            type="button"
                            onClick={() => handleToggle(action)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Completed</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(action.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete action"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUICK ALL-RECORDED-DATES NAVIGATOR */}
      {availableDates.length > 0 && (
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-600">
            <span className="font-bold flex items-center gap-1 text-stone-800">
              <Calendar className="w-3.5 h-3.5 text-[#14532D]" />
              <span>Available Recorded Dates in Vault:</span>
            </span>
            <span className="text-[11px] text-stone-500">{availableDates.length} days on file</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {availableDates.map((dateStr) => {
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#14532D] text-white shadow-2xs font-bold'
                      : 'bg-white hover:bg-stone-200 text-stone-700 border border-stone-200'
                  }`}
                >
                  {dateStr === todayStr ? `Today (${dateStr})` : dateStr}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD NEW FIELD ACTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  New Field Entry • Log Field Action
                </span>
                <h4 className="text-base font-extrabold text-stone-900">
                  Log Field Action for {selectedDate}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAction} className="space-y-4 text-xs">
              {/* Operation Title */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  Field Operation Description <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Irrigated Paddy plot with 5HP motor, Sprayed Neem oil, Applied Urea"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#14532D]/20 focus:border-[#14532D]"
                />
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as FieldActionCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-stone-900 bg-white"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Work Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewIsCompleted(true)}
                      className={`py-2 px-2 rounded-xl font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        newIsCompleted
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Completed</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewIsCompleted(false)}
                      className={`py-2 px-2 rounded-xl font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        !newIsCompleted
                          ? 'bg-amber-500 text-stone-950 border-amber-600 shadow-2xs'
                          : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Pending</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* If NOT Completed: Prompt for Reason */}
              {!newIsCompleted && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                  <label className="block font-bold text-amber-950">
                    Reason why this was NOT completed:
                  </label>
                  <input
                    type="text"
                    value={newReasonIfNotCompleted}
                    onChange={(e) => setNewReasonIfNotCompleted(e.target.value)}
                    placeholder="e.g. Rain forecasted by IMD, Canal shut, Labor unavailable, Supply pending"
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-stone-900 placeholder:text-stone-400"
                  />
                </div>
              )}

              {/* Timing, Area, Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Time of Day</label>
                  <select
                    value={newTimeOfDay}
                    onChange={(e) => setNewTimeOfDay(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-stone-900 bg-white"
                  >
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="all_day">All Day</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Area Covered</label>
                  <input
                    type="text"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="e.g. 2.5 Acres"
                    className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Hours Spent</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="e.g. 3.0"
                    className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-stone-900"
                  />
                </div>
              </div>

              {/* Inputs & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Inputs Applied</label>
                  <input
                    type="text"
                    value={newInputs}
                    onChange={(e) => setNewInputs(e.target.value)}
                    placeholder="e.g. Urea 45kg, Chlorpyrifos 2ml/L, FYM"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Cost incurred (₹)</label>
                  <input
                    type="number"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    placeholder="e.g. 850"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-stone-900"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Field Observations / Notes</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Soil moisture status, weed density, crop development stage..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-stone-900 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#14532D]/90 text-white font-bold cursor-pointer shadow-xs"
                >
                  Save to Field Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASON MODAL WHEN MARKING NOT COMPLETED */}
      {uncompleteTargetId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Mark as Not Completed / Deferred
              </span>
              <h4 className="text-base font-extrabold text-stone-900">
                Why was this operation not completed?
              </h4>
              <p className="text-xs text-stone-500">
                Record the obstacle or deferral reason for official field records.
              </p>
            </div>

            <div>
              <input
                type="text"
                autoFocus
                value={uncompleteReason}
                onChange={(e) => setUncompleteReason(e.target.value)}
                placeholder="e.g. Rain alert from IMD, Canal water delayed, Labor shortage"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUncompleteTargetId(null)}
                className="px-3 py-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMarkUncompleted}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Mark as Not Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
