import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { SupervisorDashboard } from './components/SupervisorDashboard.tsx';
import { UserRole, InventorySession, InventoryItem, InventoryEntry, Site } from './types.ts';
import { Button } from './components/Button.tsx';
import { Users, LayoutDashboard, CheckCircle, ArrowRight, ClipboardList, Building2, Calendar } from 'lucide-react';

// Helper to sort items by code naturally (e.g. 11BG1 before 11BG2, 2 before 10)
const sortItems = (items: InventoryItem[]) => {
  return [...items].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
};

// Initial Seed Data
const INITIAL_ITEMS: InventoryItem[] = [
  { id: '1', code: '101', brand: 'المهيدب', name: 'أرز بسمتي', unit: 'كجم', minQuantity: 10, maxQuantity: 100 },
  { id: '2', code: '102', brand: 'الأسرة', name: 'سكر ناعم', unit: 'كجم', minQuantity: 5, maxQuantity: 50 },
  { id: '3', code: '103', brand: 'ليبتون', name: 'شاي تلقيمة', unit: 'كرتون' },
  { id: '4', code: '201', brand: 'المراعي', name: 'حليب طويل الأجل', unit: 'كرتون', minQuantity: 20, maxQuantity: 200 },
  { id: '5', code: '202', brand: 'لورباك', name: 'زبدة غير مملحة', unit: 'حبة' },
  { id: '6', code: '301', brand: 'دو', name: 'دجاج مجمد 1000جم', unit: 'كرتون' },
  { id: '7', code: '302', brand: 'محلي', name: 'لحم حاشي', unit: 'كجم' },
  { id: '8', code: '401', brand: 'محلي', name: 'طماطم محلي', unit: 'صندوق' },
  { id: '9', code: '402', brand: 'محلي', name: 'بصل أحمر', unit: 'كجم' },
  { id: '10', code: '501', brand: 'فيري', name: 'سائل غسيل صحون', unit: 'لتر' },
];

const INITIAL_SITES: Site[] = [
  { id: 'site1', name: 'مشروع البحر الأحمر - المنطقة أ' },
  { id: 'site2', name: 'مشروع نيوم - سكن العمال' }
];

const INITIAL_SESSIONS: InventorySession[] = [
  {
    id: 's1',
    siteId: 'site1',
    siteName: 'مشروع البحر الأحمر - المنطقة أ',
    startDate: '2023-10-27',
    endDate: '2023-11-03',
    status: 'submitted',
    entries: {
        '1': { itemId: '1', quantity: 50 },
        '4': { itemId: '4', quantity: 120 },
    },
    items: sortItems(INITIAL_ITEMS) // Backwards compatibility for seed data
  }
];

export default function App() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  
  // State initialization
  const [sites, setSites] = useState<Site[]>(() => {
    const saved = localStorage.getItem('jarda_sites');
    return saved ? JSON.parse(saved) : INITIAL_SITES;
  });

  const [sessions, setSessions] = useState<InventorySession[]>(() => {
    const saved = localStorage.getItem('jarda_sessions');
    let parsedSessions = saved ? JSON.parse(saved) : INITIAL_SESSIONS;
    // Migration: Ensure all sessions have an items array and handle new fields if missing
    return parsedSessions.map((s: any) => ({
      ...s,
      items: sortItems((s.items || INITIAL_ITEMS).map((item: any) => ({
          ...item,
          code: item.code || item.category || '000', // Fallback for migration
          brand: item.brand || '',
      })))
    }));
  });
  
  const [templateItems, setTemplateItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('jarda_items');
    return saved ? JSON.parse(saved) : sortItems(INITIAL_ITEMS);
  });

  // Navigation State for Supervisor
  const [supervisorSelectedSiteId, setSupervisorSelectedSiteId] = useState<string | null>(null);
  const [currentSupervisorSessionId, setCurrentSupervisorSessionId] = useState<string | null>(null);

  // Persistence Effects
  useEffect(() => { localStorage.setItem('jarda_sites', JSON.stringify(sites)); }, [sites]);
  useEffect(() => { localStorage.setItem('jarda_sessions', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem('jarda_items', JSON.stringify(templateItems)); }, [templateItems]);

  // Real-time synchronization
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jarda_sessions' && e.newValue) setSessions(JSON.parse(e.newValue));
      if (e.key === 'jarda_items' && e.newValue) setTemplateItems(JSON.parse(e.newValue));
      if (e.key === 'jarda_sites' && e.newValue) setSites(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // --- Actions ---

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    setSupervisorSelectedSiteId(null);
    setCurrentSupervisorSessionId(null);
  };

  // Site Actions
  const createSite = (name: string) => {
    const newSite: Site = { id: Math.random().toString(36).substr(2, 9), name };
    setSites(prev => [...prev, newSite]);
  };
  
  const renameSite = (id: string, newName: string) => {
    setSites(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
    setSessions(prev => prev.map(s => s.siteId === id ? { ...s, siteName: newName } : s));
  };

  const deleteSite = (id: string) => {
      setSites(prev => prev.filter(s => s.id !== id));
  };

  // Session Actions
  const createSession = (siteId: string, startDate: string, endDate: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;

    // Logic: Copy items from the LAST session of this site, otherwise use template
    const siteSessions = sessions.filter(s => s.siteId === siteId).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const initialItems = siteSessions.length > 0 ? siteSessions[0].items : templateItems;
    
    // Always create a sorted copy of items for the new session
    const sessionItems = sortItems([...initialItems]);

    const newSession: InventorySession = {
      id: Math.random().toString(36).substr(2, 9),
      siteId: site.id,
      siteName: site.name,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      status: 'active',
      entries: {},
      items: sessionItems
    };
    setSessions(prev => [newSession, ...prev]);
  };

  const updateSession = (updated: InventorySession) => {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
  };
  
  const updateSessionItems = (sessionId: string, newItems: InventoryItem[]) => {
    // Ensure items are sorted when updated
    const sortedItems = sortItems([...newItems]);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, items: sortedItems } : s));
  };

  const approveSession = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
  };

  const unapproveSession = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'submitted' } : s));
  };

  const requestModification = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'active' } : s));
  };

  // Template Item Actions
  const addTemplateItem = (item: InventoryItem) => {
    setTemplateItems(prev => sortItems([...prev, item]));
  };

  const deleteTemplateItem = (id: string) => {
    setTemplateItems(prev => prev.filter(i => i.id !== id));
  };

  // --- Rendering ---

  // 1. Login Screen
  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">منصة جرد الإعاشة</h1>
          <p className="text-gray-500 mb-8">يرجى اختيار نوع الحساب للمتابعة</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => handleLogin('admin')}
              className="w-full p-4 border-2 border-transparent hover:border-primary bg-gray-50 hover:bg-white rounded-xl transition-all flex items-center gap-4 group shadow-sm hover:shadow-md"
            >
              <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                 <LayoutDashboard size={24} className="text-blue-700" />
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">مدير النظام</p>
                <p className="text-xs text-gray-500">إدارة المواقع والجرد</p>
              </div>
            </button>

            <button 
              onClick={() => handleLogin('supervisor')}
              className="w-full p-4 border-2 border-transparent hover:border-secondary bg-gray-50 hover:bg-white rounded-xl transition-all flex items-center gap-4 group shadow-sm hover:shadow-md"
            >
              <div className="bg-amber-100 p-3 rounded-lg group-hover:bg-amber-200 transition-colors">
                 <Users size={24} className="text-amber-700" />
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">مشرف ميداني</p>
                <p className="text-xs text-gray-500">تعبئة الجرد الميداني</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Admin View
  if (userRole === 'admin') {
    return (
      <AdminDashboard 
        sites={sites}
        sessions={sessions}
        templateItems={templateItems}
        onCreateSite={createSite}
        onRenameSite={renameSite}
        onDeleteSite={deleteSite}
        onCreateSession={createSession}
        onApproveSession={approveSession}
        onUnapproveSession={unapproveSession}
        onRequestModification={requestModification}
        onAddTemplateItem={addTemplateItem}
        onDeleteTemplateItem={deleteTemplateItem}
        onUpdateSessionItems={updateSessionItems}
        onLogout={() => setUserRole(null)}
      />
    );
  }

  // 3. Supervisor View 
  if (userRole === 'supervisor') {
    
    // Step 3: Filling a Session
    if (currentSupervisorSessionId) {
      const session = sessions.find(s => s.id === currentSupervisorSessionId);
      
      if (!session) {
          setCurrentSupervisorSessionId(null);
          return null;
      }

      if (session.status === 'approved') {
           return (
               <div className="min-h-screen flex items-center justify-center flex-col p-4 text-center bg-gray-50" dir="rtl">
                   <div className="bg-green-100 p-6 rounded-full mb-6">
                      <CheckCircle className="text-green-600 w-16 h-16" />
                   </div>
                   <h2 className="text-2xl font-bold mb-2 text-gray-800">تم اعتماد هذا الجرد</h2>
                   <p className="text-gray-500 mb-8 max-w-xs mx-auto">تم إقفال جرد {session.siteName}.</p>
                   <Button onClick={() => setCurrentSupervisorSessionId(null)}>عودة</Button>
               </div>
           )
      }

      if (session.status === 'submitted') {
          return (
              <div className="min-h-screen flex items-center justify-center flex-col p-4 text-center bg-gray-50" dir="rtl">
                  <div className="bg-amber-100 p-6 rounded-full mb-6">
                     <div className="text-amber-600 text-4xl font-bold">⏳</div>
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-gray-800">تم إرسال الجرد للمراجعة</h2>
                  <p className="text-gray-500 mb-8 max-w-xs mx-auto">الجرد الآن لدى الإدارة.</p>
                  <Button variant="outline" onClick={() => setCurrentSupervisorSessionId(null)}>عودة</Button>
              </div>
          )
     }

      return (
        <SupervisorDashboard 
          session={session} 
          items={session.items || []} 
          onUpdateSession={updateSession}
          onExit={() => setCurrentSupervisorSessionId(null)}
        />
      );
    }

    // Step 2: Session Selection (Inside a Site)
    if (supervisorSelectedSiteId) {
        const site = sites.find(s => s.id === supervisorSelectedSiteId);
        const siteSessions = sessions.filter(s => s.siteId === supervisorSelectedSiteId);
        // Only show active or submitted sessions for supervisor history
        const visibleSessions = siteSessions.filter(s => s.status !== 'approved'); 

        return (
            <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
                <div className="max-w-md mx-auto">
                    <header className="mb-6">
                        <Button variant="outline" onClick={() => setSupervisorSelectedSiteId(null)} className="mb-4 text-xs">
                            <ArrowRight size={14} /> تغيير الموقع
                        </Button>
                        <h1 className="text-2xl font-bold text-gray-900">{site?.name}</h1>
                        <p className="text-gray-500">اختر الجرد المتاح للتعبئة</p>
                    </header>

                    {visibleSessions.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-xl shadow border border-gray-100">
                             <p className="text-gray-400">لا يوجد جرد مفتوح حالياً لهذا الموقع.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {visibleSessions.map(session => {
                                const filledCount = Object.values(session.entries).filter((e: InventoryEntry) => e.quantity !== null).length;
                                // Use session.items for progress calculation
                                const totalItems = session.items?.length || 0;
                                const percentage = totalItems > 0 ? Math.round((filledCount / totalItems) * 100) : 0;
                                
                                return (
                                    <div 
                                      key={session.id} 
                                      onClick={() => setCurrentSupervisorSessionId(session.id)}
                                      className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-primary transition-all flex justify-between items-center"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Calendar size={14} className="text-primary"/>
                                                <span className="font-bold text-gray-800 text-sm" dir="ltr">{session.startDate}</span>
                                            </div>
                                            <div className="text-xs text-gray-500">إلى {session.endDate}</div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            {session.status === 'submitted' ? (
                                                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">قيد المراجعة</span>
                                            ) : (
                                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">مفتوح</span>
                                            )}
                                            
                                            <div className="w-16 h-16 rounded-full border-4 border-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                                {percentage}%
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Step 1: Site Selection
    return (
      <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
        <div className="max-w-md mx-auto">
          <header className="mb-8 flex justify-between items-center">
             <div>
                <h1 className="text-2xl font-bold text-gray-900">أهلاً بك</h1>
                <p className="text-gray-500 text-sm">اختر الموقع للبدء</p>
             </div>
             <Button variant="outline" onClick={() => setUserRole(null)} className="text-sm">خروج</Button>
          </header>

          <div className="space-y-3">
            {sites.length === 0 && <p className="text-center text-gray-400">لا يوجد مواقع مضافة</p>}
            {sites.map(site => (
                <button 
                  key={site.id} 
                  onClick={() => setSupervisorSelectedSiteId(site.id)}
                  className="w-full bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-secondary transition-all flex items-center gap-4 text-right"
                >
                  <div className="bg-gray-100 p-3 rounded-lg text-gray-500">
                      <Building2 size={24} />
                  </div>
                  <span className="font-bold text-lg text-gray-800">{site.name}</span>
                </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}