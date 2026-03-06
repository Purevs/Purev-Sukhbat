import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  QrCode, 
  Calendar, 
  TrendingUp, 
  Trash2, 
  ChevronRight, 
  ArrowLeft,
  Save,
  Milk,
  Info,
  History,
  Camera,
  AlertCircle,
  Bell,
  User as UserIcon,
  Home,
  Edit2,
  Filter,
  X,
  FileText,
  BarChart2,
  PieChart,
  Download,
  Printer
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { Cow, CowDetail, MilkYield, User } from './types';

// Utility for tailwind classes
const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'detail' | 'scan' | 'register' | 'userSelect' | 'reports'>('list');
  const [registrationType, setRegistrationType] = useState<'cow' | 'calf'>('cow');
  const [cows, setCows] = useState<Cow[]>([]);
  const [selectedCowId, setSelectedCowId] = useState<number | null>(null);
  const [cowDetail, setCowDetail] = useState<CowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportData, setReportData] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    breed: '',
    ageRange: 'all', // all, young (0-2), adult (3-7), senior (8+)
    calvingRange: 'all', // all, none (0), few (1-3), many (4+)
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [onPinSuccess, setOnPinSuccess] = useState<{ action: () => void } | null>(null);

  const verifyPin = () => {
    if (pinInput === user?.pin_code) {
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      if (onPinSuccess) {
        onPinSuccess.action();
        setOnPinSuccess(null);
      }
    } else {
      setPinError('Буруу PIN код байна.');
      setPinInput('');
    }
  };

  useEffect(() => {
    const savedUserId = localStorage.getItem('farm_user_id');
    checkUser(savedUserId);
  }, []);

  useEffect(() => {
    if (user) {
      fetchCows();
      localStorage.setItem('farm_user_id', user.id.toString());
    }
  }, [user]);

  useEffect(() => {
    if (selectedCowId) {
      fetchCowDetail(selectedCowId);
    }
  }, [selectedCowId]);

  useEffect(() => {
    if (view === 'reports' && user) {
      fetchReportData();
    }
  }, [view, reportRange, user]);

  const fetchReportData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let startDate = '';
      let endDate = format(new Date(), 'yyyy-MM-dd');

      if (reportRange === 'daily') {
        startDate = format(new Date(), 'yyyy-MM-dd');
      } else if (reportRange === 'weekly') {
        startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      } else if (reportRange === 'monthly') {
        startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      }

      const res = await fetch(`/api/reports/milk?userId=${user.id}&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      console.error('Failed to fetch report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (reportData.length === 0) return;
    
    const headers = ['Огноо', 'Ээмэгний дугаар', 'Ээлж', 'Хэмжээ (Л)'];
    const rows = reportData.map(d => [
      d.date,
      d.tag_code,
      d.session === 'morning' ? 'Өглөө' : 'Орой',
      d.amount
    ]);
    
    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `milk_report_${reportRange}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const checkUser = async (userId?: string | null) => {
    setLoading(true);
    try {
      const url = userId ? `/api/users/me?userId=${userId}` : '/api/users/me';
      const res = await fetch(url);
      const data = await res.json();
      if (data) {
        setUser(data);
        setView('list');
      } else {
        const usersRes = await fetch('/api/users');
        const allUsers = await usersRes.json();
        if (allUsers.length > 0) {
          setUsers(allUsers);
          setView('userSelect');
        } else {
          setView('register');
        }
      }
    } catch (err) {
      console.error('Failed to check user:', err);
      setView('register');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newUser = await res.json();
        setUser(newUser);
        setView('list');
      }
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const handleSwitchUser = (selectedUser: User) => {
    setUser(selectedUser);
    setView('list');
  };

  const handleLogout = () => {
    localStorage.removeItem('farm_user_id');
    setUser(null);
    fetchUsers().then(() => setView('userSelect'));
  };

  const fetchCows = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cows?userId=${user.id}`);
      const data = await res.json();
      setCows(data);
    } catch (err) {
      console.error('Failed to fetch cows:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCowDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/cows/${id}`);
      const data = await res.json();
      setCowDetail(data);
    } catch (err) {
      console.error('Failed to fetch cow detail:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitCow = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    data.type = registrationType;
    data.user_id = user.id.toString();

    // Add image data if exists
    if (imagePreview) {
      data.image_data = imagePreview;
    }
    
    try {
      const url = isEditing && cowDetail ? `/api/cows/${cowDetail.id}` : '/api/cows';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const performSubmit = async () => {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          fetchCows();
          if (isEditing && cowDetail) {
            fetchCowDetail(cowDetail.id);
            setView('detail');
          } else {
            setView('list');
          }
          setIsEditing(false);
          setImagePreview(null);
        }
      };

      if (isEditing) {
        setOnPinSuccess({ action: performSubmit });
        setShowPinModal(true);
      } else {
        await performSubmit();
      }
    } catch (err) {
      console.error('Failed to submit cow:', err);
    }
  };

  const handleAddMilk = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCowId) return;
    
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const date = formData.get('date') as string;
    const session = formData.get('session') as string;

    try {
      const res = await fetch('/api/milk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cow_id: selectedCowId, amount, date, session }),
      });
      if (res.ok) {
        fetchCowDetail(selectedCowId);
        (e.target as HTMLFormElement).reset();
      }
    } catch (err) {
      console.error('Failed to add milk yield:', err);
    }
  };

  const handleDeleteCow = async (id: number) => {
    if (!confirm('Та энэ үнээг устгахдаа итгэлтэй байна уу?')) return;
    
    const performDelete = async () => {
      try {
        await fetch(`/api/cows/${id}`, { method: 'DELETE' });
        fetchCows();
        setView('list');
      } catch (err) {
        console.error('Failed to delete cow:', err);
      }
    };

    setOnPinSuccess({ action: performDelete });
    setShowPinModal(true);
  };

  const filteredCows = cows.filter(cow => {
    const matchesSearch = cow.tag_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         cow.breed.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBreed = !filters.breed || cow.breed === filters.breed;
    
    let matchesAge = true;
    if (filters.ageRange === 'young') matchesAge = cow.age !== null && cow.age <= 2;
    else if (filters.ageRange === 'adult') matchesAge = cow.age !== null && cow.age >= 3 && cow.age <= 7;
    else if (filters.ageRange === 'senior') matchesAge = cow.age !== null && cow.age >= 8;

    let matchesCalving = true;
    if (filters.calvingRange === 'none') matchesCalving = cow.calvings === 0;
    else if (filters.calvingRange === 'few') matchesCalving = cow.calvings !== null && cow.calvings >= 1 && cow.calvings <= 3;
    else if (filters.calvingRange === 'many') matchesCalving = cow.calvings !== null && cow.calvings >= 4;

    return matchesSearch && matchesBreed && matchesAge && matchesCalving;
  });

  const uniqueBreeds = Array.from(new Set(cows.map(c => c.breed).filter(Boolean)));

  // Calculate heat cycle alerts
  const getHeatAlerts = () => {
    const today = new Date();
    return cows.filter(cow => {
      if (!cow.last_calving_date) return false;
      const calvingDate = new Date(cow.last_calving_date);
      const daysSinceCalving = differenceInDays(today, calvingDate);
      
      // Typical 21-day cycle
      const daysIntoCycle = daysSinceCalving % 21;
      const daysUntilNextHeat = (21 - daysIntoCycle) % 21;
      
      // Alert if within next 7 days
      return daysUntilNextHeat <= 7;
    });
  };

  const getBirthAlerts = () => {
    const today = new Date();
    return cows.filter(cow => {
      if (!cow.insemination_date) return false;
      const inseminationDate = new Date(cow.insemination_date);
      const dueDate = addDays(inseminationDate, 283);
      const daysUntilDue = differenceInDays(dueDate, today);
      return daysUntilDue >= 0 && daysUntilDue <= 14; // Alert 14 days before due date
    });
  };

  const heatAlerts = getHeatAlerts();
  const birthAlerts = getBirthAlerts();
  const totalAlerts = heatAlerts.length + birthAlerts.length;

  return (
    <div className="min-h-screen bg-olive-50 text-[#1a1a1a] font-sans selection:bg-olive-200">
      {/* Header */}
      <header className="glass sticky top-0 z-30 border-b border-olive-100">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view !== 'list' && view !== 'register' && view !== 'userSelect' && (
              <button 
                onClick={() => {
                  setView('list');
                  setImagePreview(null);
                }}
                className="p-2 hover:bg-olive-100 rounded-2xl transition-all active:scale-90"
              >
                <ArrowLeft size={22} className="text-olive-600" />
              </button>
            )}
            <h1 className="text-2xl font-serif font-bold tracking-tight text-olive-900">
              {view === 'register' ? 'Ферм бүртгүүлэх' :
               view === 'userSelect' ? 'Хэрэглэгч сонгох' :
               view === 'list' ? (user?.farm_name || 'Фермийн Бүртгэл') : 
               view === 'add' ? 'Шинэ бүртгэл' : 
               view === 'detail' ? 'Мэдээлэл' : 
               view === 'reports' ? 'Тайлан' : 'QR Код'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <>
                <button 
                  onClick={handleLogout}
                  className="p-2.5 hover:bg-olive-100 rounded-2xl transition-all text-olive-600/60 active:scale-90"
                  title="Хэрэглэгч солих"
                >
                  <UserIcon size={22} />
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setImagePreview(null);
                    setView('add');
                  }}
                  className="bg-olive-600 text-white p-2.5 rounded-2xl shadow-lg shadow-olive-600/20 hover:bg-olive-700 transition-all active:scale-95"
                >
                  <Plus size={24} />
                </button>
              </>
            )}
            {view === 'reports' && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={downloadCSV}
                  className="p-2.5 hover:bg-olive-100 rounded-2xl transition-all text-olive-600/60 active:scale-90"
                  title="CSV татах"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={handlePrint}
                  className="p-2.5 hover:bg-olive-100 rounded-2xl transition-all text-olive-600/60 active:scale-90"
                  title="Хэвлэх"
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={fetchReportData}
                  className="p-2.5 hover:bg-olive-100 rounded-2xl transition-all text-olive-600/60 active:scale-90"
                  title="Шинэчлэх"
                >
                  <TrendingUp size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 pb-32">
        <AnimatePresence mode="wait">
          {view === 'userSelect' && (
            <motion.div
              key="userSelect"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 mt-8"
            >
              <div className="text-center space-y-3 mb-10">
                <h2 className="text-3xl font-serif font-bold tracking-tight text-olive-900">Хэрэглэгч сонгох</h2>
                <p className="text-olive-600/50 text-sm font-medium">Үргэлжлүүлэх фермээ сонгоно уу.</p>
              </div>
              
              <div className="grid gap-4">
                {users.map(u => (
                  <motion.button
                    key={u.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSwitchUser(u)}
                    className="bg-white p-6 rounded-[32px] card-shadow border border-olive-100/50 flex items-center justify-between group transition-all hover:border-olive-200 text-left"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-olive-50 rounded-[22px] flex items-center justify-center text-olive-600 shadow-inner border border-olive-100">
                        <Home size={28} />
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-xl text-olive-900">{u.farm_name}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-olive-600/40 font-bold uppercase tracking-widest">{u.name}</p>
                          {u.location && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-olive-200" />
                              <p className="text-xs text-olive-600/40 font-medium">{u.location}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-olive-50 flex items-center justify-center text-olive-600 group-hover:bg-olive-600 group-hover:text-white transition-all shadow-sm">
                      <ChevronRight size={20} />
                    </div>
                  </motion.button>
                ))}
                
                <button
                  onClick={() => setView('register')}
                  className="mt-6 p-8 rounded-[40px] border-2 border-dashed border-olive-600/20 flex flex-col items-center justify-center gap-3 text-olive-600 font-bold hover:bg-olive-50 hover:border-olive-600/40 transition-all group"
                >
                  <div className="w-12 h-12 bg-olive-50 rounded-2xl flex items-center justify-center group-hover:bg-olive-600 group-hover:text-white transition-all">
                    <Plus size={24} />
                  </div>
                  <span className="uppercase tracking-widest text-xs">Шинэ ферм бүртгэх</span>
                </button>
              </div>
            </motion.div>
          )}

          {view === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-10 rounded-[48px] card-shadow border border-olive-100/50 text-center space-y-10 mt-12"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10" /> {/* Spacer */}
                <div className="w-24 h-24 bg-olive-50 rounded-[32px] flex items-center justify-center text-olive-600 shadow-inner border border-olive-100">
                  <Home size={48} />
                </div>
                {users.length > 0 ? (
                  <button 
                    onClick={() => setView('userSelect')}
                    className="p-3 hover:bg-olive-50 rounded-full transition-colors text-olive-600/40 active:scale-90"
                  >
                    <ArrowLeft size={24} />
                  </button>
                ) : <div className="w-10 h-10" />}
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-serif font-bold tracking-tight text-olive-900">Тавтай морилно уу!</h2>
                <p className="text-olive-600/50 text-sm font-medium">Фермийнхээ мэдээллийг бүртгэж эхэлнэ үү.</p>
              </div>
              
              <form onSubmit={handleRegister} className="space-y-6 text-left">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Таны нэр</label>
                    <input name="name" required className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" placeholder="Жишээ: Бат" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Фермийн нэр</label>
                    <input name="farm_name" required className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" placeholder="Жишээ: Баян Ферм" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Байршил</label>
                      <input name="location" className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" placeholder="Жишээ: Төв аймаг" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Утас</label>
                      <input name="phone" type="tel" className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" placeholder="9911...." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">И-мэйл (заавал биш)</label>
                    <input name="email" type="email" className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" placeholder="example@mail.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">PIN код (4 оронтой)</label>
                    <input name="pin_code" type="password" maxLength={4} required className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" placeholder="****" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-olive-600 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-olive-600/20 hover:bg-olive-700 transition-all active:scale-[0.98] mt-6">
                  Эхлэх
                </button>
              </form>
            </motion.div>
          )}
          {view === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Dashboard Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[32px] card-shadow border border-olive-100/50">
                  <div className="w-10 h-10 bg-olive-50 rounded-2xl flex items-center justify-center text-olive-600 mb-4">
                    <Milk size={20} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-1">Нийт үнээ</p>
                  <p className="text-3xl font-serif font-bold text-olive-900">{cows.length}</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] card-shadow border border-olive-100/50">
                  <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4">
                    <Bell size={20} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-1">Мэдэгдэл</p>
                  <p className={cn("text-3xl font-serif font-bold", totalAlerts > 0 ? "text-amber-600" : "text-olive-900/20")}>{totalAlerts}</p>
                </div>
              </div>

              {/* Alerts Section */}
              {totalAlerts > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-olive-600/40 px-1">Шуурхай мэдэгдэл</h3>
                  <div className="space-y-3">
                    {heatAlerts.map(cow => (
                      <motion.div 
                        key={`heat-${cow.id}`} 
                        whileHover={{ scale: 1.01 }}
                        className="bg-amber-50/50 border border-amber-100 p-4 rounded-[24px] flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
                            <Bell size={22} />
                          </div>
                          <div>
                            <p className="font-bold text-olive-900">Ороо орох дөхсөн: #{cow.tag_code}</p>
                            <p className="text-xs text-amber-700/60 font-medium">{cow.breed}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => fetchCowDetail(cow.id)}
                          className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-sm group-hover:bg-amber-600 group-hover:text-white transition-all"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </motion.div>
                    ))}
                    {birthAlerts.map(cow => (
                      <motion.div 
                        key={`birth-${cow.id}`} 
                        whileHover={{ scale: 1.01 }}
                        className="bg-blue-50/50 border border-blue-100 p-4 rounded-[24px] flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                            <Bell size={22} />
                          </div>
                          <div>
                            <p className="font-bold text-olive-900">Төрөх дөхсөн: #{cow.tag_code}</p>
                            <p className="text-xs text-blue-700/60 font-medium">{cow.breed}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => fetchCowDetail(cow.id)}
                          className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & Scan */}
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-olive-600/40 group-focus-within:text-olive-600 transition-colors" size={20} />
                    <input 
                      type="text" 
                      placeholder="Ээмэгний код эсвэл үүлдэр..."
                      className="w-full pl-12 pr-4 py-4 bg-white border border-olive-100 rounded-[24px] focus:outline-none focus:ring-4 focus:ring-olive-600/5 focus:border-olive-600/20 transition-all card-shadow"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "p-4 rounded-[24px] transition-all relative card-shadow border",
                      showFilters ? "bg-olive-600 text-white border-olive-600" : "bg-white text-olive-600 border-olive-100 hover:bg-olive-50"
                    )}
                  >
                    <Filter size={24} />
                    {(filters.breed || filters.ageRange !== 'all' || filters.calvingRange !== 'all') && (
                      <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                </div>

                {showFilters && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white p-4 rounded-3xl border border-[#141414]/5 space-y-4 overflow-hidden"
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm uppercase tracking-widest text-black/40">Шүүлтүүр</h3>
                      <button 
                        onClick={() => setFilters({ breed: '', ageRange: 'all', calvingRange: 'all' })}
                        className="text-xs font-bold text-[#5A5A40] hover:underline"
                      >
                        Цэвэрлэх
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Үүлдэр</label>
                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={() => setFilters({ ...filters, breed: '' })}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                              !filters.breed ? "bg-[#5A5A40] text-white" : "bg-[#F5F5F0] text-black/60"
                            )}
                          >
                            Бүгд
                          </button>
                          {uniqueBreeds.map(breed => (
                            <button 
                              key={breed}
                              onClick={() => setFilters({ ...filters, breed: breed! })}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                                filters.breed === breed ? "bg-[#5A5A40] text-white" : "bg-[#F5F5F0] text-black/60"
                              )}
                            >
                              {breed}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Нас</label>
                          <select 
                            value={filters.ageRange}
                            onChange={(e) => setFilters({ ...filters, ageRange: e.target.value })}
                            className="w-full p-2 bg-[#F5F5F0] rounded-xl text-xs font-bold border-none focus:ring-1 focus:ring-[#5A5A40]/20"
                          >
                            <option value="all">Бүх нас</option>
                            <option value="young">Залуу (0-2)</option>
                            <option value="adult">Дунд (3-7)</option>
                            <option value="senior">Хөгшин (8+)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Тугалсан тоо</label>
                          <select 
                            value={filters.calvingRange}
                            onChange={(e) => setFilters({ ...filters, calvingRange: e.target.value })}
                            className="w-full p-2 bg-[#F5F5F0] rounded-xl text-xs font-bold border-none focus:ring-1 focus:ring-[#5A5A40]/20"
                          >
                            <option value="all">Бүгд</option>
                            <option value="none">Тугалж байгаагүй (0)</option>
                            <option value="few">Цөөн (1-3)</option>
                            <option value="many">Олон (4+)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Cow List */}
              {loading ? (
                <div className="py-12 text-center text-black/40">Уншиж байна...</div>
              ) : filteredCows.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-[#141414]/20">
                  <p className="text-black/40">Бүртгэлтэй үнээ олдсонгүй</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredCows.map(cow => (
                    <motion.button 
                      key={cow.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedCowId(cow.id);
                        setView('detail');
                      }}
                      className="w-full bg-white p-5 rounded-[28px] card-shadow border border-olive-100/50 flex items-center justify-between group transition-all hover:border-olive-200 text-left"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-olive-50 rounded-[22px] flex items-center justify-center text-olive-600 shadow-inner border border-olive-100 overflow-hidden">
                          {cow.image_data ? (
                            <img src={cow.image_data} alt={cow.tag_code} className="w-full h-full object-cover" />
                          ) : (
                            <Milk size={28} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-serif font-bold text-xl text-olive-900">#{cow.tag_code}</h3>
                            {cow.type === 'calf' && (
                              <span className="text-[9px] bg-olive-100 text-olive-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-olive-200">
                                Тугал
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-olive-600/50 font-medium">
                            {cow.type === 'cow' ? `${cow.breed} • ${cow.age} настай` : `${cow.gender === 'female' ? 'Охин' : 'Эр'} • ${cow.birth_date}`}
                          </p>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-olive-50 flex items-center justify-center text-olive-600 group-hover:bg-olive-600 group-hover:text-white transition-all shadow-sm">
                        <ChevronRight size={20} />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-8 rounded-[40px] card-shadow border border-olive-100/50"
            >
              {/* Type Toggle */}
              <div className="flex p-1.5 bg-olive-50 rounded-[24px] mb-10 border border-olive-100/50">
                <button 
                  onClick={() => setRegistrationType('cow')}
                  disabled={isEditing}
                  className={cn(
                    "flex-1 py-3.5 rounded-[18px] font-bold text-sm transition-all",
                    registrationType === 'cow' ? "bg-white shadow-md text-olive-600" : "text-olive-600/40",
                    isEditing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isEditing ? 'Үхэр засах' : 'Үхэр нэмэх'}
                </button>
                <button 
                  onClick={() => setRegistrationType('calf')}
                  disabled={isEditing}
                  className={cn(
                    "flex-1 py-3.5 rounded-[18px] font-bold text-sm transition-all",
                    registrationType === 'calf' ? "bg-white shadow-md text-olive-600" : "text-olive-600/40",
                    isEditing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isEditing ? 'Тугал засах' : 'Тугал нэмэх'}
                </button>
              </div>

              <form key={isEditing ? `edit-${cowDetail?.id}` : 'add'} onSubmit={handleSubmitCow} className="space-y-8">
                {/* Image Upload */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-36 h-36 bg-olive-50 rounded-[40px] flex items-center justify-center text-olive-600 overflow-hidden border-2 border-dashed border-olive-600/20 group hover:border-olive-600/40 transition-all cursor-pointer shadow-inner">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={40} className="opacity-30 group-hover:opacity-50 transition-opacity" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-[10px] font-bold text-olive-600/40 uppercase tracking-widest">
                    {registrationType === 'cow' ? 'Үхрийн зураг' : 'Тугалын зураг'}
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Ээмэгний код</label>
                    <input 
                      name="tag_code" 
                      required 
                      defaultValue={isEditing ? cowDetail?.tag_code : ''}
                      className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                      placeholder="Жишээ: 1234" 
                    />
                  </div>

                  {registrationType === 'cow' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Үүлдэр</label>
                          <input 
                            name="breed" 
                            defaultValue={isEditing ? cowDetail?.breed || '' : ''}
                            className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                            placeholder="Жишээ: Алатау" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Нас</label>
                          <input 
                            name="age" 
                            type="number" 
                            defaultValue={isEditing ? cowDetail?.age : ''}
                            className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                            placeholder="0" 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Хэд тугалсан</label>
                          <input 
                            name="calvings" 
                            type="number" 
                            defaultValue={isEditing ? cowDetail?.calvings : ''}
                            className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                            placeholder="0" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Сүүлд тугалсан огноо</label>
                          <input 
                            name="last_calving_date" 
                            type="date" 
                            defaultValue={isEditing ? cowDetail?.last_calving_date || '' : ''}
                            className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Буханд гарсан огноо</label>
                        <input 
                          name="insemination_date" 
                          type="date" 
                          defaultValue={isEditing ? cowDetail?.insemination_date || '' : ''}
                          className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Төрсөн огноо</label>
                          <input 
                            name="birth_date" 
                            type="date" 
                            required 
                            defaultValue={isEditing ? cowDetail?.birth_date || '' : ''}
                            className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Хүйс</label>
                          <select 
                            name="gender" 
                            required 
                            defaultValue={isEditing ? cowDetail?.gender || 'female' : 'female'}
                            className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all text-sm appearance-none"
                          >
                            <option value="female">Охин</option>
                            <option value="male">Эр</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Эхийн код</label>
                        <input 
                          name="mother_tag" 
                          defaultValue={isEditing ? cowDetail?.mother_tag || '' : ''}
                          className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all" 
                          placeholder="Эхийн ээмэгний код" 
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2 ml-1">Бусад тэмдэглэл</label>
                    <textarea 
                      name="notes" 
                      rows={3} 
                      defaultValue={isEditing ? cowDetail?.notes || '' : ''}
                      className="w-full p-4 bg-olive-50 rounded-2xl border-none focus:ring-4 focus:ring-olive-600/5 focus:bg-white transition-all resize-none" 
                      placeholder="Нэмэлт мэдээлэл..." 
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  {isEditing && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setView('detail');
                        setImagePreview(null);
                      }}
                      className="flex-1 bg-olive-50 text-olive-600/60 py-4 rounded-2xl font-bold hover:bg-olive-100 transition-all active:scale-95"
                    >
                      Цуцлах
                    </button>
                  )}
                  <button type="submit" className="flex-[2] bg-olive-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-olive-600/20 hover:bg-olive-700 transition-all active:scale-95">
                    <Save size={20} />
                    {isEditing ? 'Өөрчлөх' : 'Бүртгэх'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {view === 'detail' && cowDetail && (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              {/* Info Card */}
              <div className="bg-white p-8 rounded-[40px] card-shadow border border-olive-100/50">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex gap-6">
                    <div className="w-24 h-24 bg-olive-50 rounded-[32px] flex items-center justify-center text-olive-600 overflow-hidden shadow-inner border border-olive-100">
                      {cowDetail.image_data ? (
                        <img src={cowDetail.image_data} alt={cowDetail.tag_code} className="w-full h-full object-cover" />
                      ) : (
                        <Milk size={40} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-4xl font-serif font-bold tracking-tighter text-olive-900">#{cowDetail.tag_code}</h2>
                      <p className="text-olive-600 font-medium text-lg">{cowDetail.breed}</p>
                      <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-olive-50 text-olive-600 text-[10px] font-bold uppercase tracking-wider border border-olive-100">
                        {cowDetail.type === 'cow' ? 'Үнээ' : 'Тугал'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setIsEditing(true);
                        setRegistrationType(cowDetail.type as 'cow' | 'calf');
                        setImagePreview(cowDetail.image_data);
                        setView('add');
                      }}
                      className="p-3 text-olive-600 hover:bg-olive-50 rounded-2xl transition-all active:scale-90"
                    >
                      <Edit2 size={22} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCow(cowDetail.id)}
                      className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                    >
                      <Trash2 size={22} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-olive-50 rounded-2xl flex items-center justify-center text-olive-600 border border-olive-100">
                      <Info size={22} />
                    </div>
                    <div>
                      {cowDetail.type === 'cow' ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-0.5">Нас / Тугалсан</p>
                          <p className="font-bold text-olive-900">{cowDetail.age} нас / {cowDetail.calvings} удаа</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-0.5">Хүйс / Төрсөн</p>
                          <p className="font-bold text-olive-900">{cowDetail.gender === 'female' ? 'Охин' : 'Эр'} / {cowDetail.birth_date}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-olive-50 rounded-2xl flex items-center justify-center text-olive-600 border border-olive-100">
                      <Calendar size={22} />
                    </div>
                    <div>
                      {cowDetail.type === 'cow' ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-0.5">Сүүлд тугалсан</p>
                          <p className="font-bold text-olive-900">{cowDetail.last_calving_date || 'Бүртгэлгүй'}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-0.5">Эхийн код</p>
                          <p className="font-bold text-olive-900">{cowDetail.mother_tag || 'Бүртгэлгүй'}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {cowDetail.type === 'cow' && cowDetail.last_calving_date && (
                   <div className="mt-8 p-5 bg-amber-50/50 border border-amber-100 rounded-3xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                        <AlertCircle size={22} />
                      </div>
                      <div className="text-sm">
                        <p className="font-bold text-amber-900">Дараагийн ороо орох мөчлөг:</p>
                        <p className="text-amber-800/80 font-medium">
                          {(() => {
                            const calvingDate = new Date(cowDetail.last_calving_date!);
                            const today = new Date();
                            const daysSince = differenceInDays(today, calvingDate);
                            const nextCycleDays = Math.ceil(daysSince / 21) * 21;
                            const nextDate = addDays(calvingDate, nextCycleDays);
                            return format(nextDate, 'yyyy-MM-dd') + ` (${differenceInDays(nextDate, today)} хоногийн дараа)`;
                          })()}
                        </p>
                      </div>
                   </div>
                )}

                {cowDetail.type === 'cow' && cowDetail.insemination_date && (
                   <div className="mt-4 p-5 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                        <Bell size={22} />
                      </div>
                      <div className="text-sm">
                        <p className="font-bold text-blue-900">Төрөх дөхсөн хугацаа (283 хоног):</p>
                        <p className="text-blue-800/80 font-medium">
                          {(() => {
                            const inseminationDate = new Date(cowDetail.insemination_date!);
                            const today = new Date();
                            const dueDate = addDays(inseminationDate, 283);
                            const daysLeft = differenceInDays(dueDate, today);
                            return format(dueDate, 'yyyy-MM-dd') + (daysLeft >= 0 ? ` (${daysLeft} хоногийн дараа)` : ` (${Math.abs(daysLeft)} хоног хэтэрсэн)`);
                          })()}
                        </p>
                      </div>
                   </div>
                )}

                {cowDetail.notes && (
                  <div className="mt-8 p-6 bg-olive-50 rounded-3xl border border-olive-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-2">Тэмдэглэл</p>
                    <p className="text-sm text-olive-900 leading-relaxed">{cowDetail.notes}</p>
                  </div>
                )}

                {/* Total Yield Stat */}
                <div className="mt-8">
                  <div className="bg-olive-600 text-white p-8 rounded-[40px] shadow-xl shadow-olive-600/20 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    <div className="relative z-10">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">Нийт саасан сүү</p>
                      <p className="text-4xl font-serif font-bold">{cowDetail.yields.reduce((sum, y) => sum + y.amount, 0).toFixed(1)} <span className="text-xl font-normal opacity-70">литр</span></p>
                    </div>
                    <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center relative z-10">
                      <TrendingUp size={32} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Milk Yield Chart */}
              <div className="bg-white p-8 rounded-[40px] card-shadow border border-olive-100/50">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-serif font-bold text-xl flex items-center gap-3 text-olive-900">
                    <TrendingUp size={24} className="text-olive-600" />
                    Сүүний гарц (Литр)
                  </h3>
                </div>
                <div className="h-64 w-full">
                  {cowDetail.yields.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(() => {
                        const grouped = cowDetail.yields.reduce((acc: any, curr) => {
                          const date = curr.date;
                          if (!acc[date]) acc[date] = { date, morning: 0, evening: 0 };
                          if (curr.session === 'morning') acc[date].morning += curr.amount;
                          else acc[date].evening += curr.amount;
                          return acc;
                        }, {});
                        return Object.values(grouped).reverse();
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10, fill: '#84844a' }} 
                          tickFormatter={(val) => format(new Date(val), 'MM/dd')}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: '#84844a' }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: '16px' }}
                        />
                        <Line 
                          name="Өглөө"
                          type="monotone" 
                          dataKey="morning" 
                          stroke="#F27D26" 
                          strokeWidth={4} 
                          dot={{ fill: '#F27D26', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                        />
                        <Line 
                          name="Орой"
                          type="monotone" 
                          dataKey="evening" 
                          stroke="#4A90E2" 
                          strokeWidth={4} 
                          dot={{ fill: '#4A90E2', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-olive-600/30 text-sm italic">
                      Мэдээлэл байхгүй байна
                    </div>
                  )}
                </div>
              </div>

              {/* Add Yield Form */}
              <div className="bg-white p-8 rounded-[40px] card-shadow border border-olive-100/50">
                <h3 className="font-serif font-bold text-xl mb-6 flex items-center gap-3 text-olive-900">
                  <Plus size={24} className="text-olive-600" />
                  Саалийн хэмжээ бүртгэх
                </h3>
                <form onSubmit={handleAddMilk} className="space-y-4">
                  <div className="flex gap-3">
                    <input 
                      name="date" 
                      type="date" 
                      required 
                      defaultValue={format(new Date(), 'yyyy-MM-dd')}
                      className="flex-1 p-4 bg-olive-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-olive-600/20 transition-all" 
                    />
                    <select 
                      name="session" 
                      className="w-32 p-4 bg-olive-50 rounded-2xl border-none text-sm font-bold text-olive-900 focus:ring-2 focus:ring-olive-600/20 transition-all appearance-none"
                    >
                      <option value="morning">Өглөө</option>
                      <option value="evening">Орой</option>
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <input 
                      name="amount" 
                      type="number" 
                      step="0.1" 
                      required 
                      placeholder="Литр"
                      className="flex-1 p-4 bg-olive-50 rounded-2xl border-none text-sm focus:ring-2 focus:ring-olive-600/20 transition-all" 
                    />
                    <button type="submit" className="bg-olive-600 text-white px-8 rounded-2xl hover:bg-olive-700 font-bold flex items-center gap-2 shadow-lg shadow-olive-600/20 transition-all active:scale-95">
                      <Save size={20} />
                      Хадгалах
                    </button>
                  </div>
                </form>
              </div>

              {/* History */}
              <div className="bg-white p-8 rounded-[40px] card-shadow border border-olive-100/50">
                <h3 className="font-serif font-bold text-xl mb-6 flex items-center gap-3 text-olive-900">
                  <History size={24} className="text-olive-600" />
                  Сүүлийн түүх
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const grouped = cowDetail.yields.reduce((acc: any[], curr) => {
                      const key = `${curr.date}-${curr.session}`;
                      const existing = acc.find(item => `${item.date}-${item.session}` === key);
                      if (existing) {
                        existing.amount += curr.amount;
                      } else {
                        acc.push({ ...curr });
                      }
                      return acc;
                    }, []);
                    return grouped.slice(0, 10);
                  })().map((y, idx) => (
                    <motion.div 
                      key={`${y.date}-${y.session}-${idx}`} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex justify-between items-center py-4 px-5 bg-olive-50/50 rounded-[24px] border border-olive-100/50 group hover:bg-white hover:border-olive-200 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${y.session === 'morning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {y.session === 'morning' ? <TrendingUp size={22} /> : <TrendingUp size={22} className="rotate-180" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-olive-900">{format(new Date(y.date), 'yyyy-MM-dd')}</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${y.session === 'morning' ? 'text-orange-600' : 'text-blue-600'}`}>
                            {y.session === 'morning' ? 'Өглөө' : 'Орой'}
                          </span>
                        </div>
                      </div>
                      <span className={`font-serif font-bold text-xl ${y.session === 'morning' ? 'text-orange-700' : 'text-blue-700'}`}>{y.amount.toFixed(1)} л</span>
                    </motion.div>
                  ))}
                  {cowDetail.yields.length === 0 && (
                    <p className="text-center text-sm text-olive-600/30 italic py-8">Түүх байхгүй</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'scan' && (
            <motion.div 
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white p-4 rounded-3xl shadow-sm border border-[#141414]/5 overflow-hidden"
            >
              <Scanner onScan={(code) => {
                const found = cows.find(c => c.tag_code === code);
                if (found) {
                  setSelectedCowId(found.id);
                  setView('detail');
                } else {
                  alert(`Үнээ олдсонгүй: ${code}`);
                  setView('list');
                }
              }} />
              <p className="text-center text-sm text-black/40 mt-4">Үхрийн ээмэгний QR кодыг уншуулна уу</p>
            </motion.div>
          )}

          {view === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Range Selector */}
              <div className="flex bg-white p-1.5 rounded-[24px] card-shadow border border-olive-100/50">
                {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setReportRange(range)}
                    className={cn(
                      "flex-1 py-3 text-xs font-bold rounded-[18px] transition-all",
                      reportRange === range 
                        ? "bg-olive-600 text-white shadow-md shadow-olive-600/20" 
                        : "text-olive-600/40 hover:bg-olive-50"
                    )}
                  >
                    {range === 'daily' ? 'Өнөөдөр' : range === 'weekly' ? '7 хоног' : '30 хоног'}
                  </button>
                ))}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[32px] card-shadow border border-olive-100/50">
                  <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mb-4">
                    <Milk size={20} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-1">Нийт сүү</p>
                  <p className="text-3xl font-serif font-bold text-olive-900">
                    {reportData.reduce((acc, curr) => acc + curr.amount, 0).toFixed(1)} <span className="text-sm font-normal opacity-50">л</span>
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[32px] card-shadow border border-olive-100/50">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                    <TrendingUp size={20} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-olive-600/40 mb-1">
                    {reportRange === 'daily' ? 'Дундаж /үнээ/' : 'Өдрийн дундаж'}
                  </p>
                  <p className="text-3xl font-serif font-bold text-olive-900">
                    {(() => {
                      const uniqueCows = new Set(reportData.map(d => d.cow_id)).size;
                      const totalAmount = reportData.reduce((acc, curr) => acc + curr.amount, 0);
                      if (uniqueCows === 0) return '0.0';
                      
                      if (reportRange === 'daily') {
                        return (totalAmount / uniqueCows).toFixed(1);
                      } else {
                        const days = reportRange === 'weekly' ? 7 : 30;
                        return (totalAmount / uniqueCows / days).toFixed(1);
                      }
                    })()} <span className="text-sm font-normal opacity-50">л</span>
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white p-8 rounded-[40px] card-shadow border border-olive-100/50">
                <h3 className="font-serif font-bold text-xl mb-8 flex items-center gap-3 text-olive-900">
                  <BarChart2 size={24} className="text-olive-600" />
                  Сүүний гарцын график
                </h3>
                <div className="h-64 w-full">
                  {reportData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(() => {
                        const grouped = reportData.reduce((acc: any, curr) => {
                          const date = format(new Date(curr.date), 'MM/dd');
                          if (!acc[date]) acc[date] = { date, amount: 0 };
                          acc[date].amount += curr.amount;
                          return acc;
                        }, {});
                        return Object.values(grouped).reverse();
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10, fill: '#84844a' }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: '#84844a' }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: '16px' }}
                          cursor={{ fill: '#f5f5f0' }}
                        />
                        <Bar dataKey="amount" fill="#5a5a40" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-olive-600/30 text-sm italic">
                      Мэдээлэл байхгүй байна
                    </div>
                  )}
                </div>
              </div>

              {/* Top Performing Cows */}
              <div className="bg-white p-8 rounded-[40px] card-shadow border border-olive-100/50">
                <h3 className="font-serif font-bold text-xl mb-8 flex items-center gap-3 text-olive-900">
                  <TrendingUp size={24} className="text-olive-600" />
                  Шилдэг саальчин үнээнүүд
                </h3>
                <div className="space-y-6">
                  {(() => {
                    const cowStats = reportData.reduce((acc: any, curr) => {
                      if (!acc[curr.cow_id]) {
                        acc[curr.cow_id] = { 
                          id: curr.cow_id, 
                          tag: curr.tag_code, 
                          type: curr.type,
                          total: 0,
                          count: 0
                        };
                      }
                      acc[curr.cow_id].total += curr.amount;
                      acc[curr.cow_id].count += 1;
                      return acc;
                    }, {});
                    
                    return Object.values(cowStats)
                      .sort((a: any, b: any) => b.total - a.total)
                      .slice(0, 5);
                  })().map((cow: any, idx) => (
                    <motion.div 
                      key={cow.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-10 h-10 rounded-2xl bg-olive-50 flex items-center justify-center text-sm font-bold text-olive-600 border border-olive-100 shadow-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-olive-900 text-lg">#{cow.tag}</p>
                          <p className="text-[10px] text-olive-600/40 uppercase font-bold tracking-widest">
                            {cow.type === 'cow' ? 'Үнээ' : 'Тугал'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-serif font-bold text-xl text-olive-600">{cow.total.toFixed(1)} л</p>
                        <p className="text-[10px] text-olive-600/40 uppercase font-bold tracking-widest">Нийт гарц</p>
                      </div>
                    </motion.div>
                  ))}
                  {reportData.length === 0 && (
                    <p className="text-center text-sm text-olive-600/30 italic py-8">Мэдээлэл байхгүй</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      {user && (
        <nav className="fixed bottom-6 left-6 right-6 z-40">
          <div className="max-w-2xl mx-auto glass rounded-[32px] border border-white/40 shadow-2xl shadow-olive-900/10 px-8 py-4 flex items-center justify-between">
            <button 
              onClick={() => setView('list')}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all active:scale-90",
                view === 'list' ? "text-olive-600" : "text-olive-600/30 hover:text-olive-600/60"
              )}
            >
              <Home size={26} strokeWidth={view === 'list' ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Нүүр</span>
            </button>
            <button 
              onClick={() => setView('scan')}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all active:scale-90",
                view === 'scan' ? "text-olive-600" : "text-olive-600/30 hover:text-olive-600/60"
              )}
            >
              <QrCode size={26} strokeWidth={view === 'scan' ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Уншуулах</span>
            </button>
            <button 
              onClick={() => setView('reports')}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all active:scale-90",
                view === 'reports' ? "text-olive-600" : "text-olive-600/30 hover:text-olive-600/60"
              )}
            >
              <FileText size={26} strokeWidth={view === 'reports' ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Тайлан</span>
            </button>
          </div>
        </nav>
      )}

      {/* PIN Verification Modal */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs p-8 rounded-[40px] shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-[#F5F5F0] rounded-3xl flex items-center justify-center text-[#5A5A40] mx-auto">
                <Save size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black">PIN код оруулна уу</h3>
                <p className="text-sm text-black/50">Мэдээлэл өөрчлөхийн тулд 4 оронтой PIN кодоо оруулна уу.</p>
              </div>
              
              <div className="space-y-4">
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPinInput(val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pinInput.length === 4) {
                      verifyPin();
                    }
                  }}
                  className="w-full text-center text-3xl tracking-[1em] p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 font-mono"
                  placeholder="****"
                  autoFocus
                />
                {pinError && <p className="text-red-500 text-xs font-bold">{pinError}</p>}
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowPinModal(false);
                      setPinInput('');
                      setPinError('');
                      setOnPinSuccess(null);
                    }}
                    className="flex-1 py-4 rounded-2xl font-bold text-black/40 hover:bg-black/5 transition-all"
                  >
                    Болих
                  </button>
                  <button
                    onClick={verifyPin}
                    className="flex-1 bg-[#5A5A40] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#4A4A30] transition-all"
                  >
                    Батлах
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Scanner({ onScan }: { onScan: (code: string) => void }) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    scannerRef.current.render(
      (decodedText) => {
        if (scannerRef.current) {
          scannerRef.current.clear();
        }
        onScan(decodedText);
      },
      (error) => {
        // console.warn(error);
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e));
      }
    };
  }, []);

  return <div id="reader" className="rounded-2xl overflow-hidden border-none" />;
}
