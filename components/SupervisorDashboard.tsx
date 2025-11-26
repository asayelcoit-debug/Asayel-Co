import React, { useState, useEffect } from 'react';
import { InventorySession, InventoryItem, InventoryEntry } from '../types.ts';
import { Button } from './Button.tsx';
import { checkInventoryAnomaly } from '../services/geminiService.ts';
import { AlertTriangle, CheckCircle, Save, ArrowLeft, ArrowRight, Send, Loader2, X } from 'lucide-react';

interface Props {
  session: InventorySession;
  items: InventoryItem[];
  onUpdateSession: (updatedSession: InventorySession) => void;
  onExit: () => void;
}

export const SupervisorDashboard: React.FC<Props> = ({ session, items, onUpdateSession, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localEntries, setLocalEntries] = useState<Record<string, InventoryEntry>>(session.entries);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'focus'>('focus');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  useEffect(() => {
    setLocalEntries(session.entries);
  }, [session]);

  const currentItem = items[currentIndex];
  
  if (!currentItem && items.length > 0) {
      setCurrentIndex(0);
      return null;
  }
  if (items.length === 0) {
      return <div className="p-8 text-center">لا يوجد مواد معرفة لهذا الجرد. يرجى التواصل مع الإدارة لإضافة المواد.<Button onClick={onExit} className="mt-4">خروج</Button></div>
  }

  const currentEntry = localEntries[currentItem.id] || { itemId: currentItem.id, quantity: null };

  const handleQuantityChange = (val: string) => {
    const num = val === '' ? null : parseFloat(val);
    
    setLocalEntries(prev => ({
      ...prev,
      [currentItem.id]: {
        ...prev[currentItem.id],
        itemId: currentItem.id,
        quantity: num
      }
    }));
    setWarningMessage(null); 
    setSaveStatus('idle');
  };

  const handleNext = async () => {
    const qty = currentEntry.quantity;
    
    if (qty !== null && qty !== undefined && !warningMessage) {
        let isSuspicious = false;
        let message = '';

        // 1. Logic Check based on Admin defined ranges
        if (currentItem.minQuantity !== undefined && currentItem.maxQuantity !== undefined) {
             if (qty < currentItem.minQuantity || qty > currentItem.maxQuantity) {
                 isSuspicious = true;
                 message = `الكمية المدخلة (${qty}) خارج المدى الطبيعي (${currentItem.minQuantity} - ${currentItem.maxQuantity}). هل أنت متأكد؟`;
             }
        } 
        // 2. Fallback to AI heuristic if no range defined and quantity is large
        else if (qty > 50) {
            setIsChecking(true);
            const check = await checkInventoryAnomaly(currentItem.name, currentItem.unit, qty);
            setIsChecking(false);
            if (check.isSuspicious) {
                isSuspicious = true;
                message = check.message || "الرقم يبدو غير منطقي، هل أنت متأكد؟";
            }
        }

        if (isSuspicious) {
            setWarningMessage(message);
            return; // Stop navigation
        }
    }
    
    setWarningMessage(null);
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setViewMode('list');
    }
  };

  const handlePrev = () => {
    setWarningMessage(null);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    setTimeout(() => {
        onUpdateSession({
          ...session,
          entries: localEntries,
          status: 'active'
        });
        setIsSaving(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const confirmSubmit = () => {
    setShowSubmitConfirm(false);
    setIsSaving(true);
    onUpdateSession({
      ...session,
      entries: localEntries,
      status: 'submitted'
    });
  };

  // --- Render Focus Mode (Q&A Style) ---
  if (viewMode === 'focus') {
    return (
      <div className="max-w-md mx-auto flex flex-col min-h-screen bg-gray-50" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center p-4">
          <button onClick={() => setViewMode('list')} className="text-sm text-primary font-bold underline">
             عرض القائمة الكاملة
          </button>
          <span className="text-gray-500 text-sm font-medium">
            مادة {currentIndex + 1} من {items.length}
          </span>
        </div>

        {/* Main Content Card */}
        <div className="flex-1 flex flex-col px-4 pb-32">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center relative mt-4">
             <div className="absolute top-4 left-4 text-xs text-gray-300 font-mono">#{currentItem.code}</div>
            <span className="inline-block px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500 mb-4">
              {currentItem.brand || 'بدون علامة'}
            </span>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">كم يوجد؟</h2>
            <h3 className="text-2xl text-primary font-bold mb-6">{currentItem.name}</h3>
            
            <div className="relative mb-6">
              <input
                type="number"
                inputMode="decimal"
                value={currentEntry.quantity === null ? '' : currentEntry.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="0"
                className="w-full text-center text-5xl font-bold border-b-2 border-gray-300 focus:border-primary focus:outline-none py-4 text-gray-800 placeholder-gray-200 bg-transparent"
                autoFocus
              />
              <span className="absolute left-0 bottom-6 text-gray-400 font-medium">{currentItem.unit}</span>
            </div>

            {warningMessage && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col items-center gap-2 animate-pulse">
                <div className="flex items-center gap-2 text-amber-700 font-bold">
                  <AlertTriangle size={20} />
                  <span>تنبيه</span>
                </div>
                <p className="text-sm text-amber-800">{warningMessage}</p>
                <button 
                  onClick={() => { setWarningMessage(null); handleNext(); }}
                  className="mt-2 text-xs bg-amber-500 text-white px-4 py-2 rounded shadow-sm hover:bg-amber-600"
                >
                  نعم متأكد، أكمل
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 max-w-md mx-auto">
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
              <ArrowRight size={18} /> السابق
            </Button>
            <Button variant="primary" onClick={handleNext} disabled={isChecking}>
              {isChecking ? <><Loader2 className="animate-spin" /> جاري التحقق</> : (currentIndex === items.length - 1 ? 'مراجعة' : 'التالي')} 
              {!isChecking && currentIndex < items.length - 1 && <ArrowLeft size={18} />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render List Mode (Review) ---
  const filledCount = Object.values(localEntries).filter((e: InventoryEntry) => e.quantity !== null).length;
  const isComplete = filledCount === items.length;

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <div className="p-4 flex items-center justify-between bg-white shadow-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-800">مراجعة الجرد ({filledCount}/{items.length})</h1>
        <Button variant="outline" onClick={() => setViewMode('focus')} className="text-sm h-9 px-3">
          وضع السؤال
        </Button>
      </div>
      
      {/* Date Header */}
       <div className="bg-blue-50 p-3 text-center text-blue-800 text-sm border-b border-blue-100">
          فترة الجرد: <span className="font-bold" dir="ltr">{session.startDate}</span> - <span className="font-bold" dir="ltr">{session.endDate}</span>
       </div>

      <div className="p-4 flex-1 pb-40">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="divide-y divide-gray-100">
            {items.map((item, idx) => {
              const entry = localEntries[item.id];
              const qty = entry?.quantity;
              const hasVal = qty !== null && qty !== undefined;
              
              return (
                <div key={item.id} className={`p-4 flex items-center justify-between ${hasVal ? 'bg-white' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-3">
                     <span className="text-xs text-gray-300 w-8 font-mono">{item.code}</span>
                     <div>
                      <p className="font-bold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.brand}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left min-w-[60px]">
                      <span className={`text-lg font-mono font-bold ${hasVal ? 'text-primary' : 'text-red-400'}`}>
                        {hasVal ? qty : '--'}
                      </span>
                      <span className="text-xs text-gray-400 mr-1 block">{item.unit}</span>
                    </div>
                    <button 
                      onClick={() => { setCurrentIndex(items.indexOf(item)); setViewMode('focus'); }}
                      className="p-2 text-gray-400 hover:text-primary bg-gray-50 rounded-lg"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="text-center mb-8">
            <Button variant="outline" fullWidth onClick={onExit} disabled={isSaving} className="border-gray-300 text-gray-500">
             خروج للقائمة الرئيسية
            </Button>
        </div>
      </div>

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.1)] z-20 max-w-2xl mx-auto">
         <div className="flex flex-col gap-3">
             <Button 
                variant={isComplete ? "primary" : "secondary"} // Greenish vs Amber
                fullWidth 
                onClick={() => setShowSubmitConfirm(true)} 
                disabled={isSaving}
                className={`py-4 text-lg shadow-lg ${isComplete ? 'animate-pulse' : ''}`}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <><Send size={20} /> إرسال للإدارة {isComplete ? '(مكتمل)' : ''}</>}
            </Button>
            
            <Button 
                variant={saveStatus === 'saved' ? 'secondary' : 'outline'} 
                fullWidth 
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="py-3"
            >
              {saveStatus === 'saved' ? <><CheckCircle size={18} /> تم الحفظ</> : <><Save size={18} /> حفظ مسودة</>}
            </Button>
         </div>
      </div>

      {/* Custom Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative animate-in zoom-in-95">
             <button 
                onClick={() => setShowSubmitConfirm(false)}
                className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <Send className="text-amber-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">تأكيد الإرسال</h3>
              <p className="text-gray-500 mb-6">
                هل أنت متأكد من إرسال الجرد للإدارة؟ <br/>
                {!isComplete && <span className="text-red-500 font-bold block mt-2">⚠️ الجرد غير مكتمل!</span>}
                <span className="text-xs text-gray-400 block mt-1">لن تتمكن من التعديل بعد الإرسال إلا بطلب من الإدارة.</span>
              </p>
              <div className="flex gap-3 w-full">
                <Button fullWidth onClick={confirmSubmit} variant="primary">نعم، إرسال</Button>
                <Button fullWidth onClick={() => setShowSubmitConfirm(false)} variant="outline">تراجع</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};