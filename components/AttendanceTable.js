import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { motion } from 'framer-motion';

export default function AttendanceTable() {
  const [csvData, setCsvData] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'members'), snap => {
      setMembers(snap.docs.map(d => d.data()));
    });
  }, []);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        // Match each row
        const matched = results.data.map(r => {
          const email = (r.Email || '').toLowerCase();
          const member = members.find(m => m.email?.toLowerCase() === email || m.mobile === r['Join Time']);
          return {
            topic: r.Topic,
            name: r['Name (original name)'],
            join: r['Join time'],
            leave: r['Leave time'],
            duration: r['Duration (minutes)'],
            matched: member ? member.mobile : '—'
          };
        });
        setCsvData(matched);
      }
    });
  };

  return (
    <div>
      <input type="file" accept=".csv" onChange={handleUpload} />
      <motion.table initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full mt-4 bg-white rounded-2xl shadow overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3">Name</th>
            <th className="p-3">Join</th>
            <th className="p-3">Leave</th>
            <th className="p-3">Duration</th>
            <th className="p-3">Member Mobile</th>
          </tr>
        </thead>
        <tbody>
          {csvData.map((r,i) => (
            <tr key={i} className="border-t">
              <td className="p-3">{r.name}</td>
              <td className="p-3">{r.join}</td>
              <td className="p-3">{r.leave}</td>
              <td className="p-3">{r.duration}</td>
              <td className="p-3">{r.matched}</td>
            </tr>
          ))}
        </tbody>
      </motion.table>
    </div>
  );
}