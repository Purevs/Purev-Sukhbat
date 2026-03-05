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
  Home
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format, differenceInDays, addDays } from 'date-fns';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { Cow, CowDetail, MilkYield, User } from './types';

// Utility for tailwind classes
const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'detail' | 'scan' | 'register' | 'userSelect'>('list');
  const [registrationType, setRegistrationType] = useState<'cow' | 'calf'>('cow');
  const [cows, setCows] = useState<Cow[]>([]);
  const [selectedCowId, setSelectedCowId] = useState<number | null>(null);
  const [cowDetail, setCowDetail] = useState<CowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  const handleAddCow = async (e: React.FormEvent<HTMLFormElement>) => {
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
      const res = await fetch('/api/cows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        fetchCows();
        setView('list');
        setImagePreview(null);
      }
    } catch (err) {
      console.error('Failed to add cow:', err);
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
    try {
      await fetch(`/api/cows/${id}`, { method: 'DELETE' });
      fetchCows();
      setView('list');
    } catch (err) {
      console.error('Failed to delete cow:', err);
    }
  };

  const filteredCows = cows.filter(cow => 
    cow.tag_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cow.breed.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate heat cycle alerts
  const getHeatAlerts = () => {
    const today = new Date();
    return cows.filter(cow => {
      if (!cow.last_calving_date) return false;
      const calvingDate = new Date(cow.last_calving_date);
      const daysSinceCalving = differenceInDays(today, calvingDate);
      
      // Heat cycle starts after calving, usually every 21 days
      // We check if current day is within a window of 20-22 days from any 21-day cycle
      if (daysSinceCalving < 15) return false; // Too soon after calving

      const cycleDay = daysSinceCalving % 21;
      return cycleDay >= 19 || cycleDay <= 2; // Alert 2 days before and after the 21st day
    });
  };

  const heatAlerts = getHeatAlerts();

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#141414]/10 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'list' && view !== 'register' && view !== 'userSelect' && (
              <button 
                onClick={() => {
                  setView('list');
                  setImagePreview(null);
                }}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-xl font-bold tracking-tight">
              {view === 'register' ? 'Ферм бүртгүүлэх' :
               view === 'userSelect' ? 'Хэрэглэгч сонгох' :
               view === 'list' ? (user?.farm_name || 'Фермийн Бүртгэл') : 
               view === 'add' ? 'Шинэ бүртгэл' : 
               view === 'detail' ? 'Мэдээлэл' : 'QR Код'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                  title="Хэрэглэгч солих"
                >
                  <UserIcon size={20} />
                </button>
                <button 
                  onClick={() => setView('add')}
                  className="bg-[#5A5A40] text-white p-2 rounded-full shadow-lg hover:bg-[#4A4A30] transition-colors"
                >
                  <Plus size={24} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {view === 'userSelect' && (
            <motion.div
              key="userSelect"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 mt-8"
            >
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-black tracking-tight">Хэрэглэгч сонгох</h2>
                <p className="text-black/50 text-sm">Үргэлжлүүлэх фермээ сонгоно уу.</p>
              </div>
              
              <div className="grid gap-3">
                {users.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleSwitchUser(u)}
                    className="bg-white p-6 rounded-[32px] border border-[#141414]/5 flex items-center justify-between hover:shadow-md transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#5A5A40]">
                        <Home size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{u.farm_name}</h3>
                        <p className="text-sm text-black/40">{u.name}</p>
                      </div>
                    </div>
                    <ChevronRight className="text-black/20 group-hover:text-[#5A5A40] transition-colors" />
                  </button>
                ))}
                
                <button
                  onClick={() => setView('register')}
                  className="mt-4 p-6 rounded-[32px] border border-dashed border-[#5A5A40]/40 flex items-center justify-center gap-3 text-[#5A5A40] font-bold hover:bg-[#5A5A40]/5 transition-all"
                >
                  <Plus size={20} />
                  Шинэ ферм бүртгэх
                </button>
              </div>
            </motion.div>
          )}

          {view === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-[40px] shadow-xl border border-[#141414]/5 text-center space-y-8 mt-12"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10" /> {/* Spacer */}
                <div className="w-20 h-20 bg-[#F5F5F0] rounded-3xl flex items-center justify-center text-[#5A5A40]">
                  <Home size={40} />
                </div>
                {users.length > 0 ? (
                  <button 
                    onClick={() => setView('userSelect')}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : <div className="w-10 h-10" />}
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Тавтай морилно уу!</h2>
                <p className="text-black/50 text-sm">Фермийнхээ мэдээллийг бүртгэж эхэлнэ үү.</p>
              </div>
              
              <form onSubmit={handleRegister} className="space-y-4 text-left">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Таны нэр</label>
                  <input name="name" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: Бат" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Фермийн нэр</label>
                  <input name="farm_name" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: Баян Ферм" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">И-мэйл (заавал биш)</label>
                  <input name="email" type="email" className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="example@mail.com" />
                </div>
                <button type="submit" className="w-full bg-[#5A5A40] text-white py-5 rounded-2xl font-bold text-lg shadow-lg hover:bg-[#4A4A30] transition-all active:scale-[0.98] mt-4">
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
              className="space-y-4"
            >
              {/* Heat Cycle Alerts */}
              {heatAlerts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl">
                  <div className="flex items-center gap-2 text-amber-800 font-bold mb-3">
                    <Bell size={18} />
                    <span>Ороо орох дөхсөн үнээнүүд</span>
                  </div>
                  <div className="space-y-2">
                    {heatAlerts.map(cow => (
                      <div key={cow.id} className="flex items-center justify-between bg-white/50 p-2 rounded-xl text-sm">
                        <span className="font-bold">#{cow.tag_code} ({cow.breed})</span>
                        <span className="text-amber-700">Ороо орох мөчлөг</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dashboard Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-3xl border border-[#141414]/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Нийт үнээ</p>
                  <p className="text-2xl font-black">{cows.length}</p>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-[#141414]/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Мэдэгдэл</p>
                  <p className="text-2xl font-black text-amber-600">{heatAlerts.length}</p>
                </div>
              </div>

              {/* Search & Scan */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={18} />
                  <input 
                    type="text" 
                    placeholder="Ээмэгний код эсвэл үүлдэр..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-[#141414]/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setView('scan')}
                  className="bg-white border border-[#141414]/10 p-3 rounded-2xl hover:bg-black/5 transition-colors"
                >
                  <QrCode size={24} />
                </button>
              </div>

              {/* Cow List */}
              {loading ? (
                <div className="py-12 text-center text-black/40">Уншиж байна...</div>
              ) : filteredCows.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-[#141414]/20">
                  <p className="text-black/40">Бүртгэлтэй үнээ олдсонгүй</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredCows.map(cow => (
                    <button
                      key={cow.id}
                      onClick={() => {
                        setSelectedCowId(cow.id);
                        setView('detail');
                      }}
                      className="bg-white p-4 rounded-3xl border border-[#141414]/5 flex items-center justify-between hover:shadow-md transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#5A5A40] overflow-hidden">
                          {cow.image_data ? (
                            <img src={cow.image_data} alt={cow.tag_code} className="w-full h-full object-cover" />
                          ) : (
                            <Milk size={24} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">#{cow.tag_code}</h3>
                            {cow.type === 'calf' && (
                              <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Тугал
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-black/50">
                            {cow.type === 'cow' ? `${cow.breed} • ${cow.age} настай` : `${cow.gender === 'female' ? 'Охин' : 'Эр'} • ${cow.birth_date}`}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="text-black/20 group-hover:text-[#5A5A40] transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5"
            >
              {/* Type Toggle */}
              <div className="flex p-1 bg-[#F5F5F0] rounded-2xl mb-8">
                <button 
                  onClick={() => setRegistrationType('cow')}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                    registrationType === 'cow' ? "bg-white shadow-sm text-[#5A5A40]" : "text-black/40"
                  )}
                >
                  Үхэр нэмэх
                </button>
                <button 
                  onClick={() => setRegistrationType('calf')}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                    registrationType === 'calf' ? "bg-white shadow-sm text-[#5A5A40]" : "text-black/40"
                  )}
                >
                  Тугал нэмэх
                </button>
              </div>

              <form onSubmit={handleAddCow} className="space-y-6">
                {/* Image Upload */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-32 h-32 bg-[#F5F5F0] rounded-3xl flex items-center justify-center text-[#5A5A40] overflow-hidden border-2 border-dashed border-[#5A5A40]/20">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={32} className="opacity-40" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs font-bold text-black/40 uppercase tracking-widest">
                    {registrationType === 'cow' ? 'Үхрийн зураг' : 'Тугалын зураг'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Ээмэгний код</label>
                    <input name="tag_code" required className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: 1234" />
                  </div>

                  {registrationType === 'cow' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Үүлдэр</label>
                          <input name="breed" className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: Алатау" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Нас</label>
                          <input name="age" type="number" className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="0" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Хэд тугалсан</label>
                          <input name="calvings" type="number" className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Сүүлд тугалсан огноо</label>
                          <input name="last_calving_date" type="date" className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Буханд гарсан огноо</label>
                        <input name="insemination_date" type="date" className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Төрсөн огноо</label>
                          <input name="birth_date" type="date" required className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Хүйс</label>
                          <select name="gender" required className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm">
                            <option value="female">Охин</option>
                            <option value="male">Эр</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Эхийн код</label>
                        <input name="mother_tag" className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Эхийн ээмэгний код" />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Бусад тэмдэглэл</label>
                    <textarea name="notes" rows={3} className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Нэмэлт мэдээлэл..." />
                  </div>
                </div>
                <button type="submit" className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-colors">
                  <Save size={20} />
                  Бүртгэх
                </button>
              </form>
            </motion.div>
          )}

          {view === 'detail' && cowDetail && (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* Info Card */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#5A5A40] overflow-hidden">
                      {cowDetail.image_data ? (
                        <img src={cowDetail.image_data} alt={cowDetail.tag_code} className="w-full h-full object-cover" />
                      ) : (
                        <Milk size={32} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black tracking-tighter">#{cowDetail.tag_code}</h2>
                      <p className="text-[#5A5A40] font-medium">{cowDetail.breed}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteCow(cowDetail.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40]">
                      <Info size={20} />
                    </div>
                    <div>
                      {cowDetail.type === 'cow' ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Нас / Тугалсан</p>
                          <p className="font-bold">{cowDetail.age} нас / {cowDetail.calvings} удаа</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Хүйс / Төрсөн</p>
                          <p className="font-bold">{cowDetail.gender === 'female' ? 'Охин' : 'Эр'} / {cowDetail.birth_date}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#F5F5F0] rounded-xl flex items-center justify-center text-[#5A5A40]">
                      <Calendar size={20} />
                    </div>
                    <div>
                      {cowDetail.type === 'cow' ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Сүүлд тугалсан</p>
                          <p className="font-bold">{cowDetail.last_calving_date || 'Бүртгэлгүй'}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Эхийн код</p>
                          <p className="font-bold">{cowDetail.mother_tag || 'Бүртгэлгүй'}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {cowDetail.type === 'cow' && cowDetail.last_calving_date && (
                   <div className="mt-4 p-4 bg-amber-50 rounded-2xl flex items-center gap-3">
                      <AlertCircle className="text-amber-600" size={20} />
                      <div className="text-sm">
                        <p className="font-bold text-amber-900">Дараагийн ороо орох мөчлөг:</p>
                        <p className="text-amber-800">
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

                {cowDetail.notes && (
                  <div className="mt-6 p-4 bg-[#F5F5F0] rounded-2xl">
                    <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">Тэмдэглэл</p>
                    <p className="text-sm">{cowDetail.notes}</p>
                  </div>
                )}
              </div>

              {/* Milk Yield Chart */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <TrendingUp size={20} className="text-[#5A5A40]" />
                    Сүүний гарц (Литр)
                  </h3>
                </div>
                <div className="h-48 w-full">
                  {cowDetail.yields.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(() => {
                        // Group by date and sum amounts
                        const grouped = cowDetail.yields.reduce((acc: any, curr) => {
                          const date = curr.date;
                          if (!acc[date]) acc[date] = { date, amount: 0 };
                          acc[date].amount += curr.amount;
                          return acc;
                        }, {});
                        return Object.values(grouped).reverse();
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }} 
                          tickFormatter={(val) => format(new Date(val), 'MM/dd')}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="amount" 
                          stroke="#5A5A40" 
                          strokeWidth={3} 
                          dot={{ fill: '#5A5A40', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-black/30 text-sm italic">
                      Мэдээлэл байхгүй байна
                    </div>
                  )}
                </div>
              </div>

              {/* Add Yield Form */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Plus size={20} className="text-[#5A5A40]" />
                  Саалийн хэмжээ бүртгэх
                </h3>
                <form onSubmit={handleAddMilk} className="space-y-3">
                  <div className="flex gap-2">
                    <input 
                      name="date" 
                      type="date" 
                      required 
                      defaultValue={format(new Date(), 'yyyy-MM-dd')}
                      className="flex-1 p-3 bg-[#F5F5F0] rounded-xl border-none text-sm" 
                    />
                    <select 
                      name="session" 
                      className="w-32 p-3 bg-[#F5F5F0] rounded-xl border-none text-sm font-bold"
                    >
                      <option value="morning">Өглөө</option>
                      <option value="evening">Орой</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      name="amount" 
                      type="number" 
                      step="0.1" 
                      required 
                      placeholder="Литр"
                      className="flex-1 p-3 bg-[#F5F5F0] rounded-xl border-none text-sm" 
                    />
                    <button type="submit" className="bg-[#5A5A40] text-white px-6 rounded-xl hover:bg-[#4A4A30] font-bold flex items-center gap-2">
                      <Save size={18} />
                      Хадгалах
                    </button>
                  </div>
                </form>
              </div>

              {/* History */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <History size={20} className="text-[#5A5A40]" />
                  Сүүлийн түүх
                </h3>
                <div className="space-y-2">
                  {cowDetail.yields.slice(0, 10).map(y => (
                    <div key={y.id} className="flex justify-between items-center py-2 border-b border-black/5 last:border-0">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{format(new Date(y.date), 'yyyy-MM-dd')}</span>
                        <span className="text-[10px] text-black/40 uppercase font-black">{y.session === 'morning' ? 'Өглөө' : 'Орой'}</span>
                      </div>
                      <span className="font-bold text-lg">{y.amount} л</span>
                    </div>
                  ))}
                  {cowDetail.yields.length === 0 && (
                    <p className="text-sm text-black/30 italic">Түүх байхгүй</p>
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
        </AnimatePresence>
      </main>
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
