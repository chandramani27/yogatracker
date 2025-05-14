import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../components/AuthContext';

export default function Home() {
  const user = useAuth();
  const router = useRouter();
  useEffect(() => { if (user) router.replace('/dashboard'); else router.replace('/login'); }, [user]);
  return null;
}
