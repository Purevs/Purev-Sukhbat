import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Firestore-оос хэрэглэгчийн мэдээллийг татаж авах
        try {
          console.log("Fetching user doc for:", currentUser.uid);
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          console.log("User doc exists:", userDoc.exists());
          console.log("User doc data:", userDoc.data());
          const isApproved = userDoc.data()?.is_approved;
          console.log("Is approved:", isApproved);
          setStatus(isApproved ? 'approved' : 'pending');
        } catch (error) {
          console.error("Error fetching user status:", error);
          setStatus('pending');
        }
      } else {
        setUser(null);
        setStatus(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div>Уншиж байна...</div>;

  if (!user) return <div>Та нэвтэрнэ үү.</div>;

  if (status !== 'approved') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Таны бүртгэл хараахан батлагдаагүй байна.</h2>
        <p>Админ таны бүртгэлийг хянаж байна. Түр хүлээнэ үү.</p>
      </div>
    );
  }

  // Хэрэв батлагдсан бол үндсэн апп-аа харуулна
  return <>{children}</>;
};
