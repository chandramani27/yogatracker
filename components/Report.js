import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { motion } from 'framer-motion';

export default function Report() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'members'), snap => {
      setMembers(snap.docs.map(d => d.data()));
    });
  }, []);

  // Compute revenue by category
  const revenueByCat = members.reduce((acc,m) => {
    const c = m.category;
    acc[c] = (acc[c] || 0) + Number(m.fees);
    return acc;
  }, {});

  const totalNew = members.filter(m => {
    // assume new if renewalDate == original
    return m.originalDate === m.renewalDate;
  }).length;
  const totalRenewal = members.length - totalNew;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
        <ul>
          {Object.entries(revenueByCat).map(([cat,rev]) => (
            <li key={cat} className="flex justify-between py-1 border-b"> <span>{cat}</span> <span>₹{rev}</span> </li>
          ))}
        </ul>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow grid grid-cols-2 gap-4">
        <div className="text-center p-4 border rounded"> <h4 className="text-2xl">{totalNew}</h4> <p>New Enrollments</p> </div>
        <div className="text-center p-4 border rounded"> <h4 className="text-2xl">{totalRenewal}</h4> <p>Renewals</p> </div>
      </div>
    </motion.div>
  );
}
