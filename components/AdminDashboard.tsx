import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { InventorySession, InventoryStatus, InventoryEntry, InventoryItem, Site } from '../types.ts';
import { Button } from './Button.tsx';
import { FileSpreadsheet, Lock, RefreshCcw, Edit2, Plus, Trash2, Settings, X, FileEdit, Unlock, Eye, Calendar, Building2, ArrowRight, Box } from 'lucide-react';

interface Props {
  sites: Site[];
  sessions: InventorySession[];
  templateItems: InventoryItem[];
  onCreateSite: (name: string) => void;
  onRenameSite: (id: string, name: string) => void;
  onDeleteSite: (id: string) => void;
  onCreateSession: (siteId: string, startDate: string, endDate: string) => void;
  onApproveSession: (sessionId: string) => void;
  onUnapproveSession: (sessionId: string) => void;
  onRequestModification: (sessionId: string) => void;
  onAddTemplateItem: (item: InventoryItem) => void;
  onDeleteTemplateItem: (id: string) => void;
  onUpdateSessionItems: (sessionId: string, newItems: InventoryItem[]) => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ 
  sites, sessions, templateItems, 
  onCreateSite, onRenameSite, onDeleteSite,
  onCreateSession, onApproveSession, onUnapproveSession, onRequestModification, 
  onAddTemplateItem, onDeleteTemplateItem, onUpdateSessionItems,
  onLogout 
}) => {
  // Global Template Manager State
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  
  // Specific Session Items Manager State
  const [sessionToManageItems, setSessionToManageItems] = useState<InventorySession | null>(null);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  
  // Modals State
  const [isCreateSiteModalOpen, setIsCreateSiteModalOpen] = useState(false);
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  
  const [siteToRename, setSiteToRename] = useState<Site | null>(null);
  const [sessionToView, setSessionToView] = useState<InventorySession | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [siteToDelete, setSiteToDelete] = useState<string | null>(null);

  // Forms State
  const [newSiteName, setNewSiteName] = useState('');
  const [renameSiteValue, setRenameSiteValue] = useState('');
  
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Next week default
  
  // Item Form State (Used for both Template and Session)
  const initialItemState = { name: '', code: '', brand: '', unit: 'كجم', minQuantity: '', maxQuantity: '' };
  const [newItem, setNewItem] = useState(initialItemState);

  // --- Handlers ---

  const handleCreateSiteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSiteName.trim()) {
      onCreateSite(newSiteName);
      setNewSiteName('');
      setIsCreateSiteModalOpen(false);
    }
  };

  const handleRenameSiteSubmit = () => {
    if (siteToRename && renameSiteValue.trim()) {
      onRenameSite(siteToRename.id, renameSiteValue);
      setSiteToRename(null);
    }
  };

  const handleCreateSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSiteId) {
        onCreateSession(selectedSiteId, startDate, endDate);
        setIsCreateSessionModalOpen(false);
    }
  };

  const handleExport = (session: InventorySession) => {
    const data = session.items.map((item, index) => {
      const entry = session.entries[item.id];
      return {
        "م": index + 1,
        "الكود": item.code,
        "المادة": item.name,
        "العلامة": item.brand,
        "الوحدة": item.unit,
        "الكمية": entry?.quantity ?? 0,
        "ملاحظات": entry?.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 30 }];
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_${session.siteName}_${session.startDate}.xlsx`);
  };

  const handleAddTemplateItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.name && newItem.code) {
      onAddTemplateItem({
        id: Math.random().toString(36).substr(2, 9),
        name: newItem.name,
        code: newItem.code,
        brand: newItem.brand,
        unit: newItem.unit,
        minQuantity: newItem.minQuantity ? Number(newItem.minQuantity) : undefined,
        maxQuantity: newItem.maxQuantity ? Number(newItem.maxQuantity) : undefined,
      });
      setNewItem(initialItemState);
    }
  };

  const handleAddSessionItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionToManageItems && newItem.name && newItem.code) {
       const itemToAdd: InventoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: newItem.name,
        code: newItem.code,
        brand: newItem.brand,
        unit: newItem.unit,
        minQuantity: newItem.minQuantity ? Number(newItem.minQuantity) : undefined,
        maxQuantity: newItem.maxQuantity ? Number(newItem.maxQuantity) : undefined,
      };
      // Sort immediately so the local state reflects the correct order
      const updatedItems = [...sessionToManageItems.items, itemToAdd].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
      onUpdateSessionItems(sessionToManageItems.id, updatedItems);
      // Update local state to reflect change immediately in modal
      setSessionToManageItems({...sessionToManageItems, items: updatedItems});
      setNewItem(initialItemState);
    }
  };

  const handleDeleteSessionItem = (itemId: string) => {
    if(sessionToManageItems) {
        const updatedItems = sessionToManageItems.items.filter(i => i.id !== itemId);
        onUpdateSessionItems(sessionToManageItems.id, updatedItems);
        setSessionToManageItems({...sessionToManageItems, items: updatedItems});
    }
  }

  const getStatusBadge = (status: InventoryStatus) => {
    switch (status) {
      case 'active': return <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-bold">جاري التعبئة</span>;
      case 'submitted': return <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs font-bold">بانتظار الاعتماد</span>;
      case 'approved': return <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-bold">معتمد ومقفل</span>;
    }
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteSessions = sessions.filter(s => s.siteId === selectedSiteId);

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div className="flex items-center gap-3">
             {selectedSiteId && (
                 <button onClick={() => setSelectedSiteId(null)} className="p-2 rounded-full bg-white shadow-sm text-gray-500 hover:text-primary transition-colors">
                     <ArrowRight size={20} />
                 </button>
             )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                  {selectedSiteId ? selectedSite?.name : 'لوحة تحكم الإدارة'}
              </h1>
              <p className="text-gray-500 mt-1">
                  {selectedSiteId ? 'إدارة الجرودات الأسبوعية للموقع' : 'إدارة مواقع الإعاشة'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={() => setShowTemplateManager(!showTemplateManager)}>
              <Settings size={18} /> {showTemplateManager ? 'إخفاء القالب' : 'إدارة قالب المواد'}
            </Button>
            
            {/* Contextual Action Button */}
            {!selectedSiteId ? (
                <Button variant="primary" onClick={() => setIsCreateSiteModalOpen(true)}>
                    <Building2 size={18} /> إضافة موقع
                </Button>
            ) : (
                <Button variant="primary" onClick={() => setIsCreateSessionModalOpen(true)}>
                    <RefreshCcw size={18} /> إنشاء جرد جديد
                </Button>
            )}

            <Button variant="outline" onClick={onLogout} className="border-red-200 text-red-600 hover:bg-red-50">خروج</Button>
          </div>
        </header>

        {/* --- MODALS --- */}

        {/* 1. Create Site Modal */}
        {isCreateSiteModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in zoom-in-95">
              <button onClick={() => setIsCreateSiteModalOpen(false)} className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
              <h2 className="text-xl font-bold text-gray-800 mb-4">إضافة موقع إعاشة جديد</h2>
              <form onSubmit={handleCreateSiteSubmit}>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم الموقع / المشروع</label>
                <input autoFocus type="text" required value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-primary focus:outline-none mb-4 bg-white text-gray-900" placeholder="مثال: مشروع نيوم - الموقع أ"
                />
                <Button type="submit" fullWidth>حفظ</Button>
              </form>
            </div>
          </div>
        )}

        {/* 2. Create Session Modal */}
        {isCreateSessionModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative animate-in zoom-in-95">
                 <button onClick={() => setIsCreateSessionModalOpen(false)} className="absolute left-4 top-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                 <h2 className="text-xl font-bold text-gray-800 mb-4">إنشاء جرد جديد لـ {selectedSite?.name}</h2>
                 <p className="text-sm text-gray-500 mb-4">سيتم نسخ قائمة المواد من آخر جرد لهذا الموقع، أو من القالب العام إذا كان أول جرد.</p>
                 <form onSubmit={handleCreateSessionSubmit}>
                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
                            <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
                            <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-900" />
                        </div>
                    </div>
                    <Button type="submit" fullWidth>إنشاء الجرد</Button>
                 </form>
             </div>
          </div>
        )}

        {/* 3. Rename Site Modal */}
        {siteToRename && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative animate-in zoom-in-95">
              <h3 className="text-lg font-bold text-gray-900 mb-4">تعديل اسم الموقع</h3>
              <input 
                type="text" 
                value={renameSiteValue} 
                onChange={(e) => setRenameSiteValue(e.target.value)} 
                className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-primary mb-6 bg-white text-gray-900"
              />
              <div className="flex gap-2">
                <Button fullWidth onClick={handleRenameSiteSubmit}>حفظ</Button>
                <Button fullWidth variant="outline" onClick={() => setSiteToRename(null)}>إلغاء</Button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Delete Template Item Confirmation */}
        {itemToDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">حذف المادة من القالب</h3>
                <p className="text-gray-500 mb-6">هل أنت متأكد من حذف هذه المادة؟ لن تظهر في الجرودات الجديدة.</p>
                <div className="flex gap-2">
                    <Button fullWidth variant="danger" onClick={() => {onDeleteTemplateItem(itemToDelete); setItemToDelete(null);}}>نعم، حذف</Button>
                    <Button fullWidth variant="outline" onClick={() => setItemToDelete(null)}>إلغاء</Button>
                </div>
             </div>
          </div>
        )}

         {/* 5. Delete Site Confirmation */}
        {siteToDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">حذف الموقع</h3>
                <p className="text-gray-500 mb-6">هل أنت متأكد من حذف الموقع؟ سيتم إخفاؤه من القائمة.</p>
                <div className="flex gap-2">
                    <Button fullWidth variant="danger" onClick={() => {onDeleteSite(siteToDelete); setSiteToDelete(null);}}>نعم، حذف</Button>
                    <Button fullWidth variant="outline" onClick={() => setSiteToDelete(null)}>إلغاء</Button>
                </div>
             </div>
          </div>
        )}

        {/* 6. View Session Details Modal */}
        {sessionToView && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">{sessionToView.siteName}</h2>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                <span className="flex items-center gap-1"><Calendar size={14}/> {sessionToView.startDate} - {sessionToView.endDate}</span>
                                <span>{getStatusBadge(sessionToView.status)}</span>
                            </div>
                        </div>
                        <button onClick={() => setSessionToView(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-sm font-medium text-gray-500">الكود</th>
                                    <th className="px-4 py-3 text-sm font-medium text-gray-500">المادة</th>
                                    <th className="px-4 py-3 text-sm font-medium text-gray-500">العلامة</th>
                                    <th className="px-4 py-3 text-sm font-medium text-gray-500">الكمية</th>
                                    <th className="px-4 py-3 text-sm font-medium text-gray-500">الوحدة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sessionToView.items.map(item => {
                                    const entry = sessionToView.entries[item.id];
                                    const qty = entry?.quantity;
                                    return (
                                        <tr key={item.id} className={qty === null ? 'bg-gray-50/50' : ''}>
                                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">{item.code}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{item.brand}</td>
                                            <td className="px-4 py-3 font-bold text-primary text-lg">{qty ?? '--'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{item.unit}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
                        <Button onClick={() => setSessionToView(null)}>إغلاق</Button>
                    </div>
                </div>
            </div>
        )}

        {/* 7. Session Items Manager Modal */}
        {sessionToManageItems && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">إدارة مواد الجرد</h2>
                    <p className="text-sm text-gray-500 mt-1">تاريخ: {sessionToManageItems.startDate} - {sessionToManageItems.siteName}</p>
                </div>
                <button onClick={() => setSessionToManageItems(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X size={24}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                 {/* Add Item Form */}
                <form onSubmit={handleAddSessionItemSubmit} className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المادة</label>
                            <input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="مثال: زيت نباتي" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الكود</label>
                            <input required value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="مثال: 101" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">العلامة التجارية</label>
                            <input value={newItem.brand} onChange={e => setNewItem({...newItem, brand: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="مثال: المراعي" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
                            <input required value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="كرتون/كجم" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى (للتنبيه)</label>
                            <input type="number" value={newItem.minQuantity} onChange={e => setNewItem({...newItem, minQuantity: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="اختياري" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأعلى (للتنبيه)</label>
                            <input type="number" value={newItem.maxQuantity} onChange={e => setNewItem({...newItem, maxQuantity: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="اختياري" />
                        </div>
                        <Button type="submit" variant="primary" fullWidth><Plus size={18} /> إضافة</Button>
                    </div>
                </form>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-gray-100 text-gray-500 text-sm">
                            <tr>
                                <th className="p-3 rounded-tr-lg">الكود</th>
                                <th className="p-3">المادة</th>
                                <th className="p-3">العلامة</th>
                                <th className="p-3">الوحدة</th>
                                <th className="p-3">المدى (Min-Max)</th>
                                <th className="p-3 rounded-tl-lg">حذف</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sessionToManageItems.items.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-mono text-gray-600">{item.code}</td>
                                    <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                    <td className="p-3 text-gray-600">{item.brand}</td>
                                    <td className="p-3 text-gray-600">{item.unit}</td>
                                    <td className="p-3 text-gray-600 text-sm" dir="ltr">
                                        {item.minQuantity !== undefined ? item.minQuantity : '-'} / {item.maxQuantity !== undefined ? item.maxQuantity : '-'}
                                    </td>
                                    <td className="p-3">
                                        <button onClick={() => handleDeleteSessionItem(item.id)} className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sessionToManageItems.items.length === 0 && (
                        <div className="text-center py-8 text-gray-400 border rounded-b-lg border-t-0">لا يوجد مواد في هذا الجرد</div>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Global Template Manager Section */}
        {showTemplateManager && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8 animate-in slide-in-from-top-4 fade-in duration-300">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2"><Settings size={20}/> القالب العام للمواد</h2>
            <p className="text-sm text-gray-500 mb-4">هذه المواد ستستخدم كقالب عند إنشاء أول جرد لأي موقع جديد.</p>
            
            <form onSubmit={handleAddTemplateItemSubmit} className="mb-6 bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">اسم المادة</label>
                        <input required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="مثال: زيت نباتي" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الكود</label>
                        <input required value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="مثال: 101" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">العلامة التجارية</label>
                        <input value={newItem.brand} onChange={e => setNewItem({...newItem, brand: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="مثال: المراعي" />
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
                        <input required value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="كرتون/كجم" />
                    </div>
                        <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى</label>
                        <input type="number" value={newItem.minQuantity} onChange={e => setNewItem({...newItem, minQuantity: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="اختياري" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأعلى</label>
                        <input type="number" value={newItem.maxQuantity} onChange={e => setNewItem({...newItem, maxQuantity: e.target.value})} className="w-full border rounded p-2 bg-white text-gray-900" placeholder="اختياري" />
                    </div>
                    <Button type="submit" variant="secondary" fullWidth><Plus size={18} /> إضافة للقالب</Button>
                </div>
            </form>

            <div className="overflow-x-auto max-h-80">
                <table className="w-full text-right border-collapse">
                    <thead className="bg-gray-100 text-gray-500 text-sm sticky top-0">
                        <tr>
                            <th className="p-3">الكود</th>
                            <th className="p-3">المادة</th>
                            <th className="p-3">العلامة</th>
                            <th className="p-3">الوحدة</th>
                            <th className="p-3">المدى</th>
                            <th className="p-3">حذف</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {templateItems.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 bg-white">
                                <td className="p-3 font-mono text-gray-600">{item.code}</td>
                                <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                <td className="p-3 text-gray-600">{item.brand}</td>
                                <td className="p-3 text-gray-600">{item.unit}</td>
                                <td className="p-3 text-gray-600 text-sm" dir="ltr">
                                    {item.minQuantity !== undefined ? item.minQuantity : '-'} / {item.maxQuantity !== undefined ? item.maxQuantity : '-'}
                                </td>
                                <td className="p-3">
                                    <button onClick={() => setItemToDelete(item.id)} className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>
        )}

        {/* MAIN VIEW: SITES LIST */}
        {!selectedSiteId && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sites.map(site => {
                    const activeCount = sessions.filter(s => s.siteId === site.id && s.status !== 'approved').length;
                    
                    return (
                        <div key={site.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:border-primary transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-teal-50 group-hover:text-primary transition-colors">
                                    <Building2 size={24} />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => { setSiteToRename(site); setRenameSiteValue(site.name); }} 
                                        className="p-2 text-gray-300 hover:text-blue-600 rounded-full hover:bg-blue-50"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                     <button 
                                        onClick={() => setSiteToDelete(site.id)} 
                                        className="p-2 text-gray-300 hover:text-red-600 rounded-full hover:bg-red-50"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{site.name}</h3>
                            <div className="flex justify-between items-center mt-4">
                                <span className={`text-sm px-2 py-1 rounded ${activeCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {activeCount} جرد نشط
                                </span>
                                <button onClick={() => setSelectedSiteId(site.id)} className="text-primary font-bold flex items-center gap-1 hover:underline">
                                    التفاصيل <ArrowRight size={16} className="rtl:rotate-180" />
                                </button>
                            </div>
                        </div>
                    )
                })}
                 {sites.length === 0 && (
                  <div className="col-span-full text-center py-20 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                    <Building2 size={48} className="mx-auto mb-4 opacity-50" />
                    لا يوجد مواقع مضافة. ابدأ بإضافة موقع جديد.
                  </div>
                )}
            </div>
        )}

        {/* DETAILED VIEW: SESSIONS LIST FOR A SITE */}
        {selectedSiteId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20 animate-in fade-in slide-in-from-bottom-4">
            <div className="overflow-x-auto">
                <table className="w-full text-right min-w-[900px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                    <th className="px-6 py-4 text-gray-500 font-medium">الفترة</th>
                    <th className="px-6 py-4 text-gray-500 font-medium">الحالة</th>
                    <th className="px-6 py-4 text-gray-500 font-medium">نسبة الإنجاز</th>
                    <th className="px-6 py-4 text-gray-500 font-medium w-1/3">الإجراءات</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {siteSessions.length === 0 && (
                    <tr>
                        <td colSpan={5} className="text-center py-10 text-gray-400">لا يوجد عمليات جرد لهذا الموقع</td>
                    </tr>
                    )}
                    {siteSessions.map(session => {
                    const filledCount = Object.values(session.entries).filter((e: InventoryEntry) => e.quantity !== null).length;
                    const totalItems = session.items.length || 1;
                    const percentage = Math.round((filledCount / totalItems) * 100);

                    return (
                        <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-800 font-bold text-sm">
                            <span className="flex items-center gap-2">
                                <Calendar size={16} className="text-gray-400" />
                                <span dir="ltr">{session.startDate}</span>
                                <span className="text-gray-300">/</span>
                                <span dir="ltr">{session.endDate}</span>
                            </span>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(session.status)}</td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2.5">
                                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                            </div>
                            <span className="text-xs text-gray-500">{percentage}%</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                             <Button 
                                variant="outline" 
                                onClick={() => setSessionToView(session)}
                                className="text-xs px-3 py-1 h-8 text-gray-600 border-gray-300 hover:bg-gray-50"
                                title="عرض"
                            >
                                <Eye size={14} /> عرض
                            </Button>
                            
                             <Button 
                                variant="outline" 
                                onClick={() => setSessionToManageItems(session)}
                                className="text-xs px-3 py-1 h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                title="إدارة المواد لهذا الجرد"
                            >
                                <Box size={14} /> المواد
                            </Button>

                            {session.status === 'submitted' && (
                                <>
                                <Button 
                                    variant="primary" 
                                    onClick={() => onApproveSession(session.id)}
                                    className="text-xs px-3 py-1 h-8 bg-green-600 hover:bg-green-700 text-white border-none"
                                    title="اعتماد وإقفال"
                                >
                                    <Lock size={14} /> اعتماد
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => onRequestModification(session.id)}
                                    className="text-xs px-3 py-1 h-8 text-amber-600 border-amber-200 hover:bg-amber-50"
                                    title="إعادة للمشرف للتعديل"
                                >
                                    <FileEdit size={14} /> تعديل
                                </Button>
                                </>
                            )}

                            {session.status === 'approved' && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => onUnapproveSession(session.id)}
                                    className="text-xs px-3 py-1 h-8 text-gray-500 border-gray-300 hover:bg-gray-100"
                                    title="تراجع عن الاعتماد"
                                >
                                    <Unlock size={14} /> تراجع
                                </Button>
                            )}
                            
                            {(session.status === 'approved' || session.status === 'submitted') && (
                                <Button 
                                variant="outline" 
                                onClick={() => handleExport(session)}
                                className="text-xs px-3 py-1 h-8 border-green-600 text-green-700 hover:bg-green-50"
                                title="تصدير ملف اكسل"
                                >
                                <FileSpreadsheet size={14} /> تصدير
                                </Button>
                            )}

                            {session.status === 'active' && (
                                <span className="text-xs text-gray-400 italic">بانتظار المشرف</span>
                            )}
                            </div>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
            </div>
        )}

      </div>
    </div>
  );
};