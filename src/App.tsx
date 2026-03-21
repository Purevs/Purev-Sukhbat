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
  Printer,
  Shield,
  LogOut
} from 'lucide-react';
import { AuthGuard } from './components/AuthGuard';
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
import { db, auth, storage } from './firebase';
import { 
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, 
  query, where, onSnapshot, orderBy, serverTimestamp, setDoc, limit, startAfter 
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

// Utility for tailwind classes
const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'list' | 'add' | 'detail' | 'scan' | 'landing' | 'reports' | 'admin' | 'forgotPin' | 'forgotPassword' | 'pending'>('pending');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [landingTab, setLandingTab] = useState<'login' | 'register' | null>(null);
  const [pendingOtp, setPendingOtp] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'confirmation'>('email');

  // Inactivity logout
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (user) {
          signOut(auth).then(() => {
            console.log('Logged out due to inactivity');
            setView('landing');
          });
        }
      }, 20 * 60 * 1000); // 20 minutes
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('onAuthStateChanged: firebaseUser=', firebaseUser);
      if (firebaseUser) {
        // Fetch user document from Firestore
        try {
          // 1. Try to fetch by UID
          let userDocRef = doc(db, 'users', firebaseUser.uid);
          let userDoc = await getDoc(userDocRef);

          // 2. If not found, try to find by email
          if (!userDoc.exists() && firebaseUser.email) {
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              userDocRef = snapshot.docs[0].ref;
              userDoc = await getDoc(userDocRef);
            }
          }

          // 3. If still not found, create new document
          if (!userDoc.exists()) {
            console.log('onAuthStateChanged: Creating new user document for UID:', firebaseUser.uid);
            try {
              await setDoc(userDocRef, {
                email: firebaseUser.email,
                name: firebaseUser.displayName || 'Шинэ хэрэглэгч',
                created_at: serverTimestamp(),
                is_approved: false,
                role: 'user'
              });
              console.log('onAuthStateChanged: Successfully created user document');
            } catch (e) {
              console.error('onAuthStateChanged: Error creating user document:', e);
            }
            userDoc = await getDoc(userDocRef);
          }

          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('userData:', userData);
            setUser({ id: userDoc.id, ...userData } as User);
            if (userData.is_approved) {
              setView('list');
            } else {
              setView('pending');
            }
          } else {
            console.log('onAuthStateChanged: Document does not exist for UID:', firebaseUser.uid);
            setUser(null);
            setView('landing');
          }
        } catch (error) {
          console.error('onAuthStateChanged: Error fetching userDoc=', error);
          setUser(null);
          setView('landing');
        }
      } else {
        setUser(null);
        setView('landing');
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);
  const [emailInput, setEmailInput] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [registrationType, setRegistrationType] = useState<'cow' | 'calf'>('cow');
  const [cowGender, setCowGender] = useState('female');
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmailInput(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  const [cows, setCows] = useState<Cow[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [cowDetail, setCowDetail] = useState<CowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cowTypeFilter, setCowTypeFilter] = useState<'cow' | 'calf'>('cow');
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [reportRange, setReportRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportData, setReportData] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    breed: '',
    ageRange: 'all', // all, young (0-2), adult (3-7), senior (8+)
    calvingRange: 'all', // all, none (0), few (1-3), many (4+)
    gender: 'all', // all, female, male
    milkingStatus: 'all', // all, milking, dry
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (user && !user.is_approved) {
      setView('pending');
    }
  }, [user]);

  const [onPinSuccess, setOnPinSuccess] = useState<{ action: () => void } | null>(null);
  const [forgotPinStep, setForgotPinStep] = useState<'email' | 'otp' | 'newPin'>('email');
  const [forgotPinEmail, setForgotPinEmail] = useState('');
  const [forgotPinOtp, setForgotPinOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [forgotPinError, setForgotPinError] = useState('');
  const [lightboxData, setLightboxData] = useState<{ images: string[], index: number } | null>(null);
  const [editYield, setEditYield] = useState<MilkYield | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [historyModal, setHistoryModal] = useState<MilkYield | null>(null);

  const verifyPin = () => {
    console.log('verifyPin: pinInput=', pinInput, 'user?.pin_code=', user?.pin_code);
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

  const handleEditMilk = async () => {
    if (!editYield || !selectedCowId) return;

    try {
      const yieldRef = doc(db, 'users', user!.id.toString(), 'cows', selectedCowId, 'milkYields', editYield.id);
      
      const historyEntry = {
        oldAmount: editYield.amount,
        newAmount: editAmount,
        timestamp: new Date(),
        changedBy: user!.id
      };

      // Update milk yield and append history
      console.log('Updating milk yield:', yieldRef.path, 'to', editAmount);
      await updateDoc(yieldRef, {
        amount: editAmount,
        history: [...(editYield.history || []), historyEntry]
      });

      fetchCowDetail(selectedCowId);
      setEditYield(null);
    } catch (err) {
      console.error('Failed to edit milk yield:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCows();
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

      // 1. Fetch all cows
      const cowsSnapshot = await getDocs(collection(db, 'users', user.id.toString(), 'cows'));
      const cowTypes = new Map(cowsSnapshot.docs.map(doc => [doc.id, doc.data().type]));
      const cowIds = cowsSnapshot.docs.map(doc => doc.id);

      // 2. Fetch milk yields for each cow
      let allYields: MilkYield[] = [];
      for (const cowId of cowIds) {
        if (cowTypes.get(cowId) === 'calf') continue;
        const yieldsSnapshot = await getDocs(
          query(
            collection(db, 'users', user.id.toString(), 'cows', cowId, 'milkYields'),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
          )
        );
        const yields = yieldsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as MilkYield));
        allYields = [...allYields, ...yields];
      }

      setReportData(allYields);
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
      if (userId) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() } as unknown as User);
        } else {
          setView('landing');
        }
      } else {
        setView('landing');
      }
    } catch (err) {
      console.error('Failed to check user:', err);
      setView('landing');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const emailInput = document.getElementsByName('email')[0] as HTMLInputElement;
    const email = emailInput.value;
    if (!email) {
      setAuthError('Имэйл хаягаа оруулна уу.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      // Generate OTP
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Save OTP
      await addDoc(collection(db, 'otps'), {
        email,
        code,
        expires_at: new Date(Date.now() + 10 * 60000).toISOString()
      });
      
      // Trigger email
      await addDoc(collection(db, 'mail'), {
        to: email,
        message: {
          subject: 'Таны баталгаажуулах код',
          text: `Таны баталгаажуулах код: ${code}`
        }
      });
      
      setOtpSent(true);
      setPendingOtp(code);
      setAuthError('Код таны имэйл рүү илгээгдлээ.');
    } catch (err) {
      console.error('Failed to send OTP:', err);
      setAuthError('Алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setAuthLoading(false);
    }
  };

  // sendOtp function removed as backend API is no longer available.

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    console.log('handleAuth called');
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      if (landingTab === 'login') {
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        
        if (rememberEmail) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle setting user and view
      } else {
        const full_name = formData.get('full_name') as string;
        const phone = formData.get('phone') as string;
        const pin = formData.get('pin') as string;
        const farm_name = formData.get('farm_name') as string;
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = {
          full_name,
          phone,
          pin,
          farm_name,
          email,
          created_at: serverTimestamp(),
          is_approved: false,
          role: 'user'
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        // onAuthStateChanged will handle setting user and view
      }
    } catch (err: any) {
      console.error('Authentication failed:', err);
      setAuthError(err.message || 'Алдаа гарлаа. Дахин оролдоно уу.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setting user to null and view to 'landing'
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const fetchCows = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', user.id.toString(), 'cows'), 
        orderBy('created_at', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const cows = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Cow));
      setCows(cows);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
    } catch (err) {
      console.error('Failed to fetch cows:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreCows = async () => {
    if (!user || !lastVisible) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'users', user.id.toString(), 'cows'), 
        orderBy('created_at', 'desc'),
        startAfter(lastVisible),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      const newCows = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Cow));
      setCows(prev => [...prev, ...newCows]);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
    } catch (err) {
      console.error('Failed to fetch more cows:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchCowDetail = async (cowId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const cowDoc = await getDoc(doc(db, 'users', user.id.toString(), 'cows', cowId));
      if (cowDoc.exists()) {
        const cowData = { id: cowDoc.id, ...cowDoc.data() } as CowDetail;
        
        // Fetch milk yields
        const yieldsSnapshot = await getDocs(collection(db, 'users', user.id.toString(), 'cows', cowId, 'milkYields'));
        cowData.yields = yieldsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MilkYield));
        
        setCowDetail(cowData);
      }
    } catch (err) {
      console.error('Failed to fetch cow detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPreviews: string[] = [];
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === files.length) {
            setImagePreview(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const handleSubmitCow = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      console.log('User is null, cannot submit cow');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const data: any = Object.fromEntries(formData.entries());
    
    data.type = registrationType;
    data.user_id = user.id.toString();
    
    if (data.gender === 'male' || registrationType === 'calf') {
      data.milkingStatus = null;
    } else if (!data.milkingStatus) {
      data.milkingStatus = 'milking';
    }
    
    // Add image data if exists
    const imageUrls: string[] = [];
    if (imagePreview.length > 0) {
      for (const preview of imagePreview) {
        if (preview.startsWith('http')) {
          imageUrls.push(preview);
        } else {
          const imageRef = ref(storage, `cows/${user.id}/${Date.now()}_${Math.random()}.jpg`);
          await uploadString(imageRef, preview as any, 'data_url');
          const url = await getDownloadURL(imageRef);
          imageUrls.push(url);
        }
      }
      data.image_urls = imageUrls;
    } else {
      data.image_urls = [];
    }
    
    try {
      console.log('Submitting cow:', data, 'isEditing:', isEditing, 'user.id:', user.id, 'cowDetail:', cowDetail);
      const performSubmit = async () => {
        if (isEditing && cowDetail) {
          console.log('Updating cow:', cowDetail.id);
          await updateDoc(doc(db, 'users', user.id.toString(), 'cows', cowDetail.id), data);
          fetchCowDetail(cowDetail.id);
          setView('detail');
        } else {
          console.log('Adding new cow');
          data.created_at = serverTimestamp();
          await addDoc(collection(db, 'users', user.id.toString(), 'cows'), data);
          fetchCows();
          setView('list');
        }
        setIsEditing(false);
        setImagePreview([]);
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
      // Check if yield already exists for this date and session
      const q = query(
        collection(db, 'users', user!.id.toString(), 'cows', selectedCowId!, 'milkYields'),
        where('date', '==', date),
        where('session', '==', session)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Update existing record
        const docRef = querySnapshot.docs[0].ref;
        const existingData = querySnapshot.docs[0].data();
        
        const historyEntry = {
          oldAmount: existingData.amount,
          newAmount: amount,
          timestamp: new Date(),
          changedBy: user!.id
        };

        await updateDoc(docRef, {
          amount,
          history: [...(existingData.history || []), historyEntry]
        });
      } else {
        // Add new record
        await addDoc(collection(db, 'users', user!.id.toString(), 'cows', selectedCowId!, 'milkYields'), {
          amount,
          date,
          session,
          created_at: serverTimestamp()
        });
      }
      
      await fetchCowDetail(selectedCowId!);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      console.error('Failed to add milk yield:', err);
    }
  };

  const handleDeleteCow = async (id: number) => {
    if (!confirm('Та энэ үнээг устгахдаа итгэлтэй байна уу?')) return;
    
    const performDelete = async () => {
      try {
        await deleteDoc(doc(db, 'users', user!.id.toString(), 'cows', id.toString()));
        fetchCows();
        setView('list');
      } catch (err) {
        console.error('Failed to delete cow:', err);
      }
    };

    setOnPinSuccess({ action: performDelete });
    setShowPinModal(true);
  };

  const removeImage = async (imageUrl: string) => {
    if (!cowDetail || !user) return;
    
    if (!confirm('Та энэ зургийг устгахдаа итгэлтэй байна уу?')) return;

    const newImageUrls = cowDetail.image_urls.filter(url => url !== imageUrl);
    
    try {
      await updateDoc(doc(db, 'users', user.id.toString(), 'cows', cowDetail.id), {
        image_urls: newImageUrls
      });
      setCowDetail({ ...cowDetail, image_urls: newImageUrls });
      
      if (newImageUrls.length === 0) {
        setLightboxData(null);
      } else {
        setLightboxData(prev => prev ? { ...prev, images: newImageUrls, index: Math.min(prev.index, newImageUrls.length - 1) } : null);
      }
    } catch (err) {
      console.error('Failed to remove image:', err);
      alert('Зураг устгахад алдаа гарлаа.');
    }
  };

  const filteredCows = cows.filter(cow => {
    const matchesSearch = (cow.tag_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (cow.breed || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = cow.type === cowTypeFilter;
    
    const matchesBreed = !filters.breed || cow.breed === filters.breed;
    const matchesGender = filters.gender === 'all' || (cow.gender || 'female') === filters.gender;
    const matchesMilkingStatus = filters.milkingStatus === 'all' || (cow.milkingStatus || 'milking') === filters.milkingStatus;
    
    let matchesAge = true;
    if (filters.ageRange === 'young') matchesAge = cow.age !== null && cow.age <= 2;
    else if (filters.ageRange === 'adult') matchesAge = cow.age !== null && cow.age >= 3 && cow.age <= 7;
    else if (filters.ageRange === 'senior') matchesAge = cow.age !== null && cow.age >= 8;

    let matchesCalving = true;
    if (filters.calvingRange === 'none') matchesCalving = cow.calvings === 0;
    else if (filters.calvingRange === 'few') matchesCalving = cow.calvings !== null && cow.calvings >= 1 && cow.calvings <= 3;
    else if (filters.calvingRange === 'many') matchesCalving = cow.calvings !== null && cow.calvings >= 4;

    return matchesSearch && matchesType && matchesBreed && matchesGender && matchesMilkingStatus && matchesAge && matchesCalving;
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

  const AdminView = () => {
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [allUsers, setAllUsers] = useState<(User & { cowCount: number })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchData = async () => {
        setLoading(true);
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
          const userData = { id: userDoc.id, ...userDoc.data() } as unknown as User;
          const cowsSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'cows'));
          return { ...userData, cowCount: cowsSnapshot.size };
        }));
        setAllUsers(usersData);
        setPendingUsers(usersData.filter(u => !u.is_approved));
        setLoading(false);
      };
      fetchData();
    }, []);

    const approveUser = async (userId: string) => {
      await updateDoc(doc(db, 'users', userId), { is_approved: true });
      setPendingUsers(pendingUsers.filter(u => u.id !== userId));
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, is_approved: true } : u));
    };

    if (loading) return <div className="p-4">Уншиж байна...</div>;

    return (
      <div className="p-4 space-y-6">
        <h2 className="text-xl font-bold">Админ самбар</h2>
        
        <section>
          <h3 className="text-lg font-bold mb-2">Хэрэглэгч батлах</h3>
          {pendingUsers.map(u => (
            <div key={u.id} className="p-4 bg-white rounded-xl shadow-sm mb-2 flex justify-between items-center">
              <div>
                <p className="font-bold">{u.name}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
              <button onClick={() => approveUser(u.id)} className="bg-[#5A5A40] text-white px-4 py-2 rounded-xl">Батлах</button>
            </div>
          ))}
        </section>

        <section>
          <h3 className="text-lg font-bold mb-2">Бүх хэрэглэгчид</h3>
          {allUsers.map(u => (
            <div key={u.id} className="p-4 bg-white rounded-xl shadow-sm mb-2 flex justify-between items-center">
              <div>
                <p className="font-bold">{u.name}</p>
                <p className="text-sm text-gray-500">Ферм: {u.farm_name}</p>
                <p className="text-sm text-gray-500">Үхрийн тоо: {u.cowCount}</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs ${u.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {u.is_approved ? 'Батлагдсан' : 'Хүлээгдэж буй'}
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  };

  const heatAlerts = getHeatAlerts();
  const birthAlerts = getBirthAlerts();
  const totalAlerts = heatAlerts.length + birthAlerts.length;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#141414]/10 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'list' && view !== 'register' && view !== 'userSelect' && view !== 'landing' && (
              <button 
                onClick={() => {
                  setView('list');
                  setImagePreview([]);
                }}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-xl font-bold tracking-tight">
              {view === 'landing' ? '' :
               view === 'list' ? (user?.farm_name || 'Фермийн Бүртгэл') : 
               view === 'add' ? 'Шинэ бүртгэл' : 
               view === 'detail' ? 'Мэдээлэл' : 'QR Код'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'admin' && view !== 'admin' && (
              <button onClick={() => setView('admin')} className="p-2 bg-[#5A5A40] text-white rounded-full">
                Админ
              </button>
            )}
            {view === 'list' && (
              <>
                {user?.email === 'purevs@gmail.com' && (
                  <button 
                    onClick={() => setView('admin')}
                    className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                    title="Админ"
                  >
                    <Shield size={20} />
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors font-bold text-sm"
                  title="Гарах"
                >
                  <LogOut size={18} />
                  Гарах
                </button>
              </>
            )}
            {view === 'reports' && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={downloadCSV}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                  title="CSV татах"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={handlePrint}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                  title="Хэвлэх"
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={fetchReportData}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/40"
                  title="Шинэчлэх"
                >
                  <TrendingUp size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 pb-24">
        {view === 'admin' && <AuthGuard><AdminView /></AuthGuard>}
        {view === 'pending' && (
          <div className="p-8 text-center bg-white rounded-[40px] shadow-xl border border-[#141414]/5">
            <h2 className="text-xl font-bold mb-2">Таны бүртгэл хараахан батлагдаагүй байна.</h2>
            <p className="text-gray-500">Админ таны бүртгэлийг хянаж байна. Түр хүлээнэ үү.</p>
          </div>
        )}
        {view === 'forgotPin' && (
          <motion.div
            key="forgotPin"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-[40px] shadow-xl border border-[#141414]/5 space-y-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">PIN код сэргээх</h2>
              <button onClick={() => setView('landing')} className="text-sm text-black/40 hover:text-black">Буцах</button>
            </div>
            
            {forgotPinError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                {forgotPinError}
              </div>
            )}

            {forgotPinStep === 'email' && (
              <div className="space-y-4">
                <input type="email" value={forgotPinEmail} onChange={(e) => setForgotPinEmail(e.target.value)} className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none" placeholder="Имэйл хаяг" />
                <button onClick={async () => {
                  // Verify email exists
                  const q = query(collection(db, 'users'), where('email', '==', forgotPinEmail));
                  const snapshot = await getDocs(q);
                  if (snapshot.empty) {
                    setForgotPinError('Энэ имэйлээр бүртгэлтэй хэрэглэгч олдсонгүй.');
                    return;
                  }
                  // Send OTP
                  const code = Math.floor(1000 + Math.random() * 9000).toString();
                  await addDoc(collection(db, 'otps'), { email: forgotPinEmail, code, expires_at: new Date(Date.now() + 10 * 60000).toISOString() });
                  await addDoc(collection(db, 'mail'), { to: forgotPinEmail, message: { subject: 'PIN код сэргээх', text: `Таны код: ${code}` } });
                  setPendingOtp(code);
                  setForgotPinStep('otp');
                  setForgotPinError('Код илгээгдлээ.');
                }} className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold">Код авах</button>
              </div>
            )}
            
            {forgotPinStep === 'otp' && (
              <div className="space-y-4">
                <input value={forgotPinOtp} onChange={(e) => setForgotPinOtp(e.target.value)} className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none" placeholder="Баталгаажуулах код" />
                <button onClick={() => {
                  if (forgotPinOtp === pendingOtp) {
                    setForgotPinStep('newPin');
                    setForgotPinError('');
                  } else {
                    setForgotPinError('Код буруу байна.');
                  }
                }} className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold">Баталгаажуулах</button>
              </div>
            )}
            
            {forgotPinStep === 'newPin' && (
              <div className="space-y-4">
                <input type="password" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value)} className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none" placeholder="Шинэ PIN код" />
                <button onClick={async () => {
                  if (newPin.length !== 4) {
                    setForgotPinError('PIN код 4 оронтой байх ёстой.');
                    return;
                  }
                  const q = query(collection(db, 'users'), where('email', '==', forgotPinEmail));
                  const snapshot = await getDocs(q);
                  await updateDoc(snapshot.docs[0].ref, { pin_code: newPin });
                  setForgotPinStep('confirmation');
                  setForgotPinError('');
                }} className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold">Хадгалах</button>
              </div>
            )}
            
            {forgotPinStep === 'confirmation' && (
              <div className="space-y-4 text-center">
                <p className="text-lg font-bold">PIN код амжилттай солигдлоо.</p>
                <button onClick={() => {
                  setForgotPinStep('email');
                  setForgotPinEmail('');
                  setForgotPinOtp('');
                  setNewPin('');
                  setView('landing');
                }} className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold">Нэвтрэх хуудас руу буцах</button>
              </div>
            )}
          </motion.div>
        )}
        {view === 'forgotPassword' && (
          <motion.div
            key="forgotPassword"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-[40px] shadow-xl border border-[#141414]/5 space-y-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Нууц үг сэргээх</h2>
              <button onClick={() => setView('landing')} className="text-sm text-black/40 hover:text-black">Буцах</button>
            </div>
            
            {forgotPasswordError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                {forgotPasswordError}
              </div>
            )}

            {forgotPasswordStep === 'email' && (
              <div className="space-y-4">
                <input type="email" value={forgotPasswordEmail} onChange={(e) => setForgotPasswordEmail(e.target.value)} className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none" placeholder="Имэйл хаяг" />
                <button onClick={async () => {
                  // Verify email exists
                  const q = query(collection(db, 'users'), where('email', '==', forgotPasswordEmail));
                  const snapshot = await getDocs(q);
                  if (snapshot.empty) {
                    setForgotPasswordError('Энэ имэйлээр бүртгэлтэй хэрэглэгч олдсонгүй.');
                    return;
                  }
                  // In a real app, we would send a password reset email via Firebase Auth
                  // For now, we simulate this by sending a link to the user's email
                  await addDoc(collection(db, 'mail'), { to: forgotPasswordEmail, message: { subject: 'Нууц үг сэргээх', text: `Нууц үгээ сэргээх холбоос: ${window.location.origin}/reset-password` } });
                  setForgotPasswordStep('confirmation');
                  setForgotPasswordError('Нууц үг сэргээх холбоос таны имэйл рүү илгээгдлээ.');
                }} className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold">Илгээх</button>
              </div>
            )}
            
            {forgotPasswordStep === 'confirmation' && (
              <div className="space-y-4 text-center">
                <p className="text-lg font-bold">Нууц үг сэргээх холбоос илгээгдлээ.</p>
                <button onClick={() => {
                  setForgotPasswordStep('email');
                  setForgotPasswordEmail('');
                  setView('landing');
                }} className="w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold">Нэвтрэх хуудас руу буцах</button>
              </div>
            )}
          </motion.div>
        )}
        {view === 'landing' && (
          <h1 className="text-xl font-bold tracking-tight mb-4">Тавтай морилно уу</h1>
        )}
        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-[40px] shadow-xl border border-[#141414]/5 text-center space-y-8"
            >
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-[#F5F5F0] rounded-3xl flex items-center justify-center text-[#5A5A40]">
                  <Home size={40} />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight">Фермийн Бүртгэл</h2>
                <p className="text-black/50 text-sm">Фермийнхээ мэдээллийг хялбархан хянана уу.</p>
              </div>

              {landingTab === null ? (
                <div className="space-y-4">
                  {user && (
                    <button 
                      onClick={() => setView(user.is_approved ? 'list' : 'pending')}
                      className="w-full bg-transparent text-[#5A5A40] py-2 font-bold underline mb-4"
                    >
                      Миний ферм рүү орох
                    </button>
                  )}
                  <button 
                    onClick={() => setLandingTab('login')}
                    className="w-full bg-[#5A5A40] text-white py-5 rounded-2xl font-bold text-lg shadow-lg hover:bg-[#4A4A30] transition-all active:scale-[0.98]"
                  >
                    Нэвтрэх
                  </button>
                  <button 
                    onClick={() => setLandingTab('register')}
                    className="w-full bg-white text-[#5A5A40] py-5 rounded-2xl font-bold text-lg shadow-lg border border-[#5A5A40] hover:bg-[#F5F5F0] transition-all active:scale-[0.98]"
                  >
                    Бүртгүүлэх
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">{landingTab === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}</h3>
                    <button onClick={() => setLandingTab(null)} className="text-sm text-black/40 hover:text-black">Буцах</button>
                  </div>
                  {landingTab === 'login' ? (
                    <form onSubmit={handleAuth} className="space-y-4 text-left">
                      {authError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                          <AlertCircle size={16} />
                          {authError}
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Имэйл хаяг</label>
                        <input name="email" type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: bat@example.com" />
                      </div>
                      <div className="flex items-center gap-2 ml-1">
                        <input 
                          type="checkbox" 
                          id="remember" 
                          checked={rememberEmail} 
                          onChange={(e) => setRememberEmail(e.target.checked)}
                          className="rounded text-[#5A5A40] focus:ring-[#5A5A40]"
                        />
                        <label htmlFor="remember" className="text-xs text-black/60">Имэйл хаягийг санах</label>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Нууц үг</label>
                        <input name="password" type="password" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Нууц үг" />
                        <button 
                          type="button" 
                          onClick={() => setView('forgotPassword')}
                          className="text-xs text-[#5A5A40] font-bold mt-2 ml-1 hover:underline"
                        >
                          Нууц үгээ мартсан уу?
                        </button>
                      </div>
                      <button 
                        type="submit" 
                        onClick={() => console.log('Login button clicked')}
                        className="w-full bg-[#5A5A40] text-white py-5 rounded-2xl font-bold text-lg shadow-lg hover:bg-[#4A4A30] transition-all active:scale-[0.98] mt-4"
                      >
                        Нэвтрэх
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleAuth} className="space-y-4 text-left">
                      {authError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                          <AlertCircle size={16} />
                          {authError}
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Овог нэр</label>
                        <input name="full_name" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: Бат Бат" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Гар утасны дугаар</label>
                        <input name="phone" type="tel" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: 99112233" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">PIN код (4 оронтой)</label>
                        <input name="pin" type="password" maxLength={4} required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="****" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Фермийн нэр</label>
                        <input name="farm_name" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: Баян Ферм" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Имэйл хаяг</label>
                        <input name="email" type="email" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Жишээ: bat@example.com" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1 ml-1">Нууц үг</label>
                        <input name="password" type="password" required className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" placeholder="Нууц үг" />
                      </div>
                      <button type="submit" className="w-full bg-[#5A5A40] text-white py-5 rounded-2xl font-bold text-lg shadow-lg hover:bg-[#4A4A30] transition-all active:scale-[0.98] mt-4">
                        Бүртгүүлэх
                      </button>
                    </form>
                  )}
                </div>
              )}
            </motion.div>
          )}
          {view === 'list' && (
            <AuthGuard>
              <motion.div 
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
              {/* Notifications */}
              {(heatAlerts.length > 0 || birthAlerts.length > 0) && (
                <div className="space-y-3">
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

                  {birthAlerts.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-3xl">
                      <div className="flex items-center gap-2 text-blue-800 font-bold mb-3">
                        <Bell size={18} />
                        <span>Төрөх дөхсөн үнээнүүд</span>
                      </div>
                      <div className="space-y-2">
                        {birthAlerts.map(cow => {
                          const dueDate = addDays(new Date(cow.insemination_date!), 283);
                          const daysLeft = differenceInDays(dueDate, new Date());
                          return (
                            <div key={cow.id} className="flex items-center justify-between bg-white/50 p-2 rounded-xl text-sm">
                              <span className="font-bold">#{cow.tag_code} ({cow.breed})</span>
                              <span className="text-blue-700">{daysLeft === 0 ? 'Өнөөдөр төрөх' : `${daysLeft} хоногийн дараа`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dashboard Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-3xl border border-[#141414]/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Үнээ / Тугал</p>
                  <p className="text-2xl font-black">{cows.filter(c => c.type === 'cow').length} / {cows.filter(c => c.type === 'calf').length}</p>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-[#141414]/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Мэдэгдэл</p>
                  <p className={cn("text-2xl font-black", totalAlerts > 0 ? "text-amber-600" : "text-black/20")}>{totalAlerts}</p>
                </div>
              </div>

              {/* Alerts Section */}
              {totalAlerts > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40 px-1">Шуурхай мэдэгдэл</h3>
                  <div className="space-y-2">
                    {heatAlerts.map(cow => (
                      <div key={`heat-${cow.id}`} className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                            <Bell size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">Ороо орох дөхсөн: #{cow.tag_code}</p>
                            <p className="text-xs text-amber-700/60">{cow.breed}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => fetchCowDetail(cow.id)}
                          className="text-xs font-bold text-amber-600 hover:underline"
                        >
                          Харах
                        </button>
                      </div>
                    ))}
                    {birthAlerts.map(cow => (
                      <div key={`birth-${cow.id}`} className="bg-blue-50 border border-blue-200 p-4 rounded-3xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                            <Bell size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">Төрөх дөхсөн: #{cow.tag_code}</p>
                            <p className="text-xs text-blue-700/60">{cow.breed}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => fetchCowDetail(cow.id)}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Харах
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & Scan */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCowTypeFilter('cow')}
                    className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-colors", cowTypeFilter === 'cow' ? "bg-[#5A5A40] text-white" : "bg-white text-black/40")}
                  >
                    Үнээ
                  </button>
                  <button 
                    onClick={() => setCowTypeFilter('calf')}
                    className={cn("flex-1 py-2 rounded-xl text-sm font-bold transition-colors", cowTypeFilter === 'calf' ? "bg-[#5A5A40] text-white" : "bg-white text-black/40")}
                  >
                    Тугал
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" size={18} />
                    <input 
                      type="text" 
                      placeholder="Ээмэгний код эсвэл үүлдэр..."
                      className="w-full pl-10 pr-4 py-3 bg-white border border-[#141414]/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "border border-[#141414]/10 p-3 rounded-2xl transition-colors relative",
                      showFilters ? "bg-[#5A5A40] text-white" : "bg-white hover:bg-black/5"
                    )}
                  >
                    <Filter size={24} />
                    {(filters.breed || filters.ageRange !== 'all' || filters.calvingRange !== 'all') && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                  <button 
                    onClick={() => setView('scan')}
                    className="bg-white border border-[#141414]/10 p-3 rounded-2xl hover:bg-black/5 transition-colors"
                  >
                    <QrCode size={24} />
                  </button>
                </div>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setImagePreview([]);
                    setView('add');
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#5A5A40] text-white py-3 rounded-2xl font-bold hover:bg-[#4A4A30] transition-colors"
                >
                  <Plus size={20} />
                  Шинэ үнээ/тугал нэмэх
                </button>

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
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Хүйс</label>
                          <select 
                            value={filters.gender}
                            onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                            className="w-full p-2 bg-[#F5F5F0] rounded-xl text-xs font-bold border-none focus:ring-1 focus:ring-[#5A5A40]/20"
                          >
                            <option value="all">Бүгд</option>
                            <option value="female">Эм</option>
                            <option value="male">Эр</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Саалийн статус</label>
                          <select 
                            value={filters.milkingStatus}
                            onChange={(e) => setFilters({ ...filters, milkingStatus: e.target.value })}
                            className="w-full p-2 bg-[#F5F5F0] rounded-xl text-xs font-bold border-none focus:ring-1 focus:ring-[#5A5A40]/20"
                          >
                            <option value="all">Бүгд</option>
                            <option value="milking">Саагдаж байгаа</option>
                            <option value="dry">Ширгэсэн</option>
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
                <div className="grid gap-3">
                  <p className="text-sm font-bold text-black/60 mb-2">Нийт: {filteredCows.length} үхэр</p>
                  {filteredCows.map(cow => (
                    <motion.button
                      key={cow.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedCowId(cow.id);
                        setView('detail');
                      }}
                      className="bg-white p-4 rounded-3xl border border-[#141414]/5 flex items-center justify-between shadow-sm transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#F5F5F0] rounded-2xl flex items-center justify-center text-[#5A5A40] overflow-hidden">
                          {cow.image_urls && cow.image_urls.length > 0 ? (
                            <img src={cow.image_urls[0]} alt={cow.tag_code} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
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
                    </motion.button>
                  ))}
                  {cows.length > 0 && !searchQuery && !filters.breed && filters.ageRange === 'all' && filters.calvingRange === 'all' && (
                    <button
                      onClick={fetchMoreCows}
                      disabled={loadingMore}
                      className="w-full py-4 bg-white border border-[#141414]/5 rounded-3xl text-center font-bold text-[#5A5A40] hover:bg-[#F5F5F0] transition-colors mt-4"
                    >
                      {loadingMore ? 'Уншиж байна...' : 'Илүүг харах'}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
            </AuthGuard>
          )}

          {view === 'add' && (
            <AuthGuard>
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
                  disabled={isEditing}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                    registrationType === 'cow' ? "bg-white shadow-sm text-[#5A5A40]" : "text-black/40",
                    isEditing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isEditing ? 'Үхэр засах' : 'Үхэр нэмэх'}
                </button>
                <button 
                  onClick={() => setRegistrationType('calf')}
                  disabled={isEditing}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                    registrationType === 'calf' ? "bg-white shadow-sm text-[#5A5A40]" : "text-black/40",
                    isEditing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isEditing ? 'Тугал засах' : 'Тугал нэмэх'}
                </button>
              </div>

              <form key={isEditing ? `edit-${cowDetail?.id}` : 'add'} onSubmit={handleSubmitCow} className="space-y-6">
                {/* Image Upload */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-32 h-32 bg-[#F5F5F0] rounded-3xl flex items-center justify-center text-[#5A5A40] overflow-hidden border-2 border-dashed border-[#5A5A40]/20">
                    {imagePreview.length > 0 ? (
                      <>
                        <img src={imagePreview[0]} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setImagePreview(prev => prev.filter((_, i) => i !== 0))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <Camera size={32} className="opacity-40" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      onChange={handleImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  {imagePreview.length > 1 && (
                    <div className="grid grid-cols-4 gap-2 w-full">
                      {imagePreview.slice(1).map((preview, index) => (
                        <div key={index + 1} className="relative">
                          <img src={preview} alt="Preview" className="w-full h-16 object-cover rounded-xl" />
                          <button 
                            type="button"
                            onClick={() => setImagePreview(prev => prev.filter((_, i) => i !== index + 1))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs font-bold text-black/40 uppercase tracking-widest">
                    {registrationType === 'cow' ? 'Үхрийн зураг' : 'Тугалын зураг'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Ээмэгний код</label>
                    <input 
                      name="tag_code" 
                      required 
                      defaultValue={isEditing ? cowDetail?.tag_code : ''}
                      className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                      placeholder="Жишээ: 1234" 
                    />
                  </div>

                  {registrationType === 'cow' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Үүлдэр</label>
                          <input 
                            name="breed" 
                            defaultValue={isEditing ? cowDetail?.breed || '' : ''}
                            className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                            placeholder="Жишээ: Алатау" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Хүйс</label>
                          <select 
                            name="gender" 
                            required 
                            defaultValue={isEditing ? cowDetail?.gender || 'female' : 'female'}
                            onChange={(e) => setCowGender(e.target.value)}
                            className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm"
                          >
                            <option value="female">Эм</option>
                            <option value="male">Эр</option>
                          </select>
                        </div>
                        {cowGender === 'female' && (
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Саалийн статус</label>
                            <select 
                              name="milkingStatus" 
                              required 
                              defaultValue={isEditing ? cowDetail?.milkingStatus || 'milking' : 'milking'}
                              className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm"
                            >
                              <option value="milking">Саагдаж байгаа</option>
                              <option value="dry">Ширгэсэн</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Нас</label>
                          <input 
                            name="age" 
                            type="number" 
                            defaultValue={isEditing ? cowDetail?.age : ''}
                            className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                            placeholder="0" 
                          />
                        </div>
                      </div>
                      
                      {cowGender === 'female' && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Хэд тугалсан</label>
                              <input 
                                name="calvings" 
                                type="number" 
                                defaultValue={isEditing ? cowDetail?.calvings : ''}
                                className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                                placeholder="0" 
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Сүүлд тугалсан огноо</label>
                              <input 
                                name="last_calving_date" 
                                type="date" 
                                defaultValue={isEditing ? cowDetail?.last_calving_date || '' : ''}
                                className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Буханд гарсан огноо</label>
                            <input 
                              name="insemination_date" 
                              type="date" 
                              defaultValue={isEditing ? cowDetail?.insemination_date || '' : ''}
                              className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                            />
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Төрсөн огноо</label>
                          <input 
                            name="birth_date" 
                            type="date" 
                            required 
                            defaultValue={isEditing ? cowDetail?.birth_date || '' : ''}
                            className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Үүлдэр</label>
                          <input 
                            name="breed" 
                            defaultValue={isEditing ? cowDetail?.breed || '' : ''}
                            className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                            placeholder="Жишээ: Алатау" 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Хүйс</label>
                          <select 
                            name="gender" 
                            required 
                            defaultValue={isEditing ? cowDetail?.gender || 'female' : 'female'}
                            className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 text-sm"
                          >
                            <option value="female">Охин</option>
                            <option value="male">Эр</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Эхийн код</label>
                          <input 
                            name="mother_tag" 
                            defaultValue={isEditing ? cowDetail?.mother_tag || '' : ''}
                            className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                            placeholder="Эхийн ээмэгний код" 
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black/40 mb-1">Бусад тэмдэглэл</label>
                    <textarea 
                      name="notes" 
                      rows={3} 
                      defaultValue={isEditing ? cowDetail?.notes || '' : ''}
                      className="w-full p-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40]/20" 
                      placeholder="Нэмэлт мэдээлэл..." 
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  {isEditing && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setView('detail');
                        setImagePreview([]);
                      }}
                      className="flex-1 bg-[#F5F5F0] text-black/60 py-4 rounded-2xl font-bold hover:bg-black/5 transition-colors"
                    >
                      Цуцлах
                    </button>
                  )}
                  <button type="submit" className="flex-[2] bg-[#5A5A40] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#4A4A30] transition-colors">
                    <Save size={20} />
                    {isEditing ? 'Өөрчлөх' : 'Бүртгэх'}
                  </button>
                </div>
              </form>
            </motion.div>
            </AuthGuard>
          )}

          {view === 'detail' && cowDetail && (
            <AuthGuard>
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
                      {cowDetail.image_urls && cowDetail.image_urls.length > 0 ? (
                        <img 
                          src={cowDetail.image_urls[0]} 
                          alt={`${cowDetail.tag_code}`} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover cursor-pointer" 
                          onClick={() => setLightboxData({ images: cowDetail.image_urls, index: 0 })} 
                        />
                      ) : (
                        <Milk size={32} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black tracking-tighter">#{cowDetail.tag_code}</h2>
                      <p className="text-[#5A5A40] font-medium">{cowDetail.breed}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setIsEditing(true);
                        setRegistrationType(cowDetail.type as 'cow' | 'calf');
                        setImagePreview(cowDetail.image_urls || []);
                        setView('add');
                      }}
                      className="p-2 text-[#5A5A40] hover:bg-[#F5F5F0] rounded-full transition-colors"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCow(cowDetail.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
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
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Үүлдэр / Хүйс</p>
                          <p className="font-bold">{cowDetail.breed || 'Бүртгэлгүй'} / {cowDetail.gender === 'female' ? 'Охин' : 'Эр'}</p>
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
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Нас / Эхийн код</p>
                          <p className="font-bold">
                            {cowDetail.birth_date ? (() => {
                              const birthDate = new Date(cowDetail.birth_date);
                              const today = new Date();
                              let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
                              let days = today.getDate() - birthDate.getDate();
                              if (days < 0) {
                                months--;
                                const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                                days += lastMonth.getDate();
                              }
                              return `${months} сар ${days} өдөр`;
                            })() : 'Бүртгэлгүй'} / {cowDetail.mother_tag || 'Бүртгэлгүй'}
                          </p>
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

                {cowDetail.type === 'cow' && cowDetail.insemination_date && (
                   <div className="mt-3 p-4 bg-blue-50 rounded-2xl flex items-center gap-3">
                      <Bell className="text-blue-600" size={20} />
                      <div className="text-sm">
                        <p className="font-bold text-blue-900">Төрөх дөхсөн хугацаа (283 хоног):</p>
                        <p className="text-blue-800">
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
                  <div className="mt-6 p-4 bg-[#F5F5F0] rounded-2xl">
                    <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-1">Тэмдэглэл</p>
                    <p className="text-sm">{cowDetail.notes}</p>
                  </div>
                )}

                {cowDetail.type === 'cow' && (
                  <div className="mt-6 grid grid-cols-1 gap-4">
                    <div className="bg-[#5A5A40] text-white p-6 rounded-[32px] shadow-lg flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Нийт саасан сүү</p>
                        <p className="text-3xl font-black">{cowDetail.yields.reduce((sum, y) => sum + y.amount, 0).toFixed(1)} <span className="text-lg font-normal">литр</span></p>
                      </div>
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {cowDetail.type === 'cow' && (
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
                          // Group by date and separate by session
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
                            tick={{ fontSize: 10 }} 
                            tickFormatter={(val) => format(new Date(val), 'MM/dd')}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          />
                          <Line 
                            name="Өглөө"
                            type="monotone" 
                            dataKey="morning" 
                            stroke="#F27D26" 
                            strokeWidth={3} 
                            dot={{ fill: '#F27D26', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line 
                            name="Орой"
                            type="monotone" 
                            dataKey="evening" 
                            stroke="#4A90E2" 
                            strokeWidth={3} 
                            dot={{ fill: '#4A90E2', strokeWidth: 2 }}
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
              )}

              {/* Add Yield Form */}
              {cowDetail.type === 'cow' && (
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
              )}

              {/* History */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#141414]/5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <History size={20} className="text-[#5A5A40]" />
                  Сүүлийн түүх
                </h3>
                <div className="space-y-2">
                  {cowDetail.yields.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map((y, idx) => (
                    <div key={`${y.id}-${idx}`} className="flex justify-between items-center py-3 px-4 bg-[#F5F5F0]/50 rounded-2xl border border-black/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${y.session === 'morning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {y.session === 'morning' ? <TrendingUp size={18} /> : <TrendingUp size={18} className="rotate-180" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{format(new Date(y.date), 'yyyy-MM-dd')}</span>
                          <span className={`text-[10px] font-black uppercase ${y.session === 'morning' ? 'text-orange-600' : 'text-blue-600'}`}>
                            {y.session === 'morning' ? 'Өглөө' : 'Орой'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-lg ${y.session === 'morning' ? 'text-orange-700' : 'text-blue-700'}`}>{y.amount.toFixed(1)} л</span>
                        {y.history && y.history.length > 0 && (
                          <button onClick={() => setHistoryModal(y)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                            <History size={16} />
                          </button>
                        )}
                        <button onClick={() => { setEditYield(y); setEditAmount(y.amount); }} className="p-2 text-[#5A5A40] hover:bg-[#F5F5F0] rounded-full transition-colors">
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {cowDetail.yields.length === 0 && (
                    <p className="text-sm text-black/30 italic">Түүх байхгүй</p>
                  )}
                </div>
              </div>
              {editYield && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm">
                    <h3 className="font-bold mb-4">Сүүний хэмжээ засах</h3>
                    <input type="number" value={editAmount} onChange={(e) => setEditAmount(parseFloat(e.target.value))} className="w-full p-4 bg-[#F5F5F0] rounded-2xl border-none mb-4" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditYield(null)} className="flex-1 p-4 bg-gray-200 rounded-2xl font-bold">Цуцлах</button>
                      <button onClick={handleEditMilk} className="flex-1 p-4 bg-[#5A5A40] text-white rounded-2xl font-bold">Хадгалах</button>
                    </div>
                  </div>
                </div>
              )}
              {historyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm">
                    <h3 className="font-bold mb-4">Түүх</h3>
                    <div className="space-y-2">
                      {historyModal.history?.map((h: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          {h.timestamp ? format(new Date(h.timestamp.toDate()), 'yyyy-MM-dd HH:mm') : 'N/A'}: {h.oldAmount} to {h.newAmount}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setHistoryModal(null)} className="w-full p-4 bg-gray-200 rounded-2xl font-bold mt-4">Хаах</button>
                  </div>
                </div>
              )}
            </motion.div>
            </AuthGuard>
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
              className="space-y-6"
            >
              {/* Range Selector */}
              <div className="flex bg-white p-1 rounded-2xl border border-[#141414]/5">
                {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setReportRange(range)}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                      reportRange === range 
                        ? "bg-[#5A5A40] text-white shadow-sm" 
                        : "text-black/40 hover:bg-black/5"
                    )}
                  >
                    {range === 'daily' ? 'Өнөөдөр' : range === 'weekly' ? '7 хоног' : '30 хоног'}
                  </button>
                ))}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[32px] border border-[#141414]/5 shadow-sm">
                  <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mb-4">
                    <Milk size={20} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Нийт сүү</p>
                  <p className="text-2xl font-black">
                    {reportData.reduce((acc, curr) => acc + curr.amount, 0).toFixed(1)} л
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-[#141414]/5 shadow-sm">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                    <TrendingUp size={20} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">
                    {reportRange === 'daily' ? 'Дундаж /үнээ/' : 'Өдрийн дундаж'}
                  </p>
                  <p className="text-2xl font-black">
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
                    })()} л
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white p-6 rounded-[32px] border border-[#141414]/5 shadow-sm">
                <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                  <BarChart2 size={18} className="text-[#5A5A40]" />
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
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="amount" fill="#5A5A40" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-black/30 text-sm italic">
                      Мэдээлэл байхгүй байна
                    </div>
                  )}
                </div>
              </div>

              {/* Top Performing Cows */}
              <div className="bg-white p-6 rounded-[32px] border border-[#141414]/5 shadow-sm">
                <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                  <TrendingUp size={18} className="text-[#5A5A40]" />
                  Шилдэг саальчин үнээнүүд
                </h3>
                <div className="space-y-4">
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
                    <div key={cow.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center text-xs font-bold text-black/40">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-sm">#{cow.tag}</p>
                          <p className="text-[10px] text-black/40 uppercase font-bold tracking-wider">
                            {cow.type === 'cow' ? 'Үнээ' : 'Тугал'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#5A5A40]">{cow.total.toFixed(1)} л</p>
                        <p className="text-[10px] text-black/40">Нийт гарц</p>
                      </div>
                    </div>
                  ))}
                  {reportData.length === 0 && (
                    <p className="text-center text-sm text-black/30 italic">Мэдээлэл байхгүй</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {lightboxData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxData(null)}>
            <div className="relative max-w-4xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <button 
                className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white z-50"
                onClick={() => setLightboxData(null)}
              >
                <X size={24} />
              </button>
              <button 
                className="absolute top-4 left-4 bg-black/50 p-2 rounded-full text-red-500 z-50"
                onClick={() => removeImage(lightboxData.images[lightboxData.index])}
              >
                <Trash2 size={24} />
              </button>
              <img 
                src={lightboxData.images[lightboxData.index]} 
                alt="Lightbox" 
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain rounded-2xl" 
              />
              {lightboxData.images.length > 1 && (
                <>
                  <button 
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 p-2 rounded-full text-white"
                    onClick={() => setLightboxData(prev => prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : null)}
                  >
                    &lt;
                  </button>
                  <button 
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 p-2 rounded-full text-white"
                    onClick={() => setLightboxData(prev => prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null)}
                  >
                    &gt;
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      {user && user.is_approved && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#141414]/5 pb-safe z-20">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
            <button 
              onClick={() => setView('list')}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                view === 'list' ? "text-[#5A5A40]" : "text-black/20 hover:text-black/40"
              )}
            >
              <Home size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Нүүр</span>
            </button>
            <button 
              onClick={() => setView('scan')}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                view === 'scan' ? "text-[#5A5A40]" : "text-black/20 hover:text-black/40"
              )}
            >
              <QrCode size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Уншуулах</span>
            </button>
            <button 
              onClick={() => setView('reports')}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                view === 'reports' ? "text-[#5A5A40]" : "text-black/20 hover:text-black/40"
              )}
            >
              <FileText size={24} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Тайлан</span>
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
