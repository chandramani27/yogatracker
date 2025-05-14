// pages/dashboard.js
import Head from 'next/head';
import Navbar from '../components/Navbar';
import Link from 'next/link';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useMemo } from 'react';

export default function Dashboard() {
  // 1) Load all members
  const [membersSnap, loadingMembers, errorMembers] = useCollection(
    query(collection(db, 'members'))
  );
  // 2) Load last 5 reminders
  const [logsSnap] = useCollection(
    query(collection(db, 'reminderLogs'), orderBy('sentAt', 'desc'), limit(5))
  );

  // Helper: parse ISO / Timestamp / DD/MM/YYYY
  const parseDate = val => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    if (!isNaN(d)) return d;
    const [p1,p2,p3] = val.split('/').map(n=>parseInt(n,10));
    if (p1>12) return new Date(p3, p2-1, p1);
    return new Date(p3, p1-1, p2);
  };

  // Calculate due date & status
  const calcDueDate = (renewal, period) => {
    const base = parseDate(renewal);
    if (!base || !period) return null;
    const [num, unit] = period.split(' ');
    const n = parseInt(num,10)||0;
    const d = new Date(base);
    if (unit.startsWith('month'))    d.setMonth(d.getMonth()+n);
    else if (unit.startsWith('day')) d.setDate(d.getDate()+n);
    return d;
  };
  const calcStatus = dueDateObj => {
    if (!(dueDateObj instanceof Date)) return 'N/A';
    const today = new Date(); today.setHours(0,0,0,0);
    dueDateObj.setHours(0,0,0,0);
    const diff = Math.floor((dueDateObj - today)/(1000*60*60*24));
    if      (diff > 0)   return 'Not Due';
    else if (diff === 0) return 'Follow up';
    else if (diff >= -2) return 'Overdue';
    else                 return 'On Hold';
  };

  // 3) Compute stats
  const stats = useMemo(() => {
    const counts = { 'Not Due': 0, 'Follow up': 0, Overdue: 0, 'On Hold': 0 };
    if (!membersSnap) return counts;
    membersSnap.docs.forEach(doc => {
      const m = doc.data();
      const due = calcDueDate(m.renewalDate, m.period);
      const s = calcStatus(due);
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [membersSnap]);

  if (loadingMembers) return <p className="p-6">Loading dashboard…</p>;
  if (errorMembers)   return <p className="p-6 text-red-500">Error: {errorMembers.message}</p>;

  return (
    <>
      <Head><title>Dashboard – Yoga Admin</title></Head>
      <Navbar />

      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Not Due',   value: stats['Not Due'],   color: 'blue'  },
            { label: 'Follow up', value: stats['Follow up'], color: 'green' },
            { label: 'Overdue',   value: stats['Overdue'],   color: 'yellow'},
            { label: 'On Hold',   value: stats['On Hold'],   color: 'red'   },
          ].map(card => (
            <div
              key={card.label}
              className={`p-4 bg-white shadow rounded border-l-4 border-${card.color}-500`}
            >
              <h3 className="text-lg font-medium text-gray-700">{card.label}</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap gap-4">
          <Link href="/members" className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            Manage Members
          </Link>
          <Link href="/attendance" className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            Attendance
          </Link>
          <Link href="/reports" className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            Reports
          </Link>
          <Link href="/reminders" className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600">
            Reminder Logs
          </Link>
        </div>

        {/* Recent Reminders */}
        <section>
          <h2 className="text-2xl font-semibold mb-3">Recent Reminders</h2>
          <div className="overflow-x-auto bg-white shadow rounded">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Sent At','Name','Mobile','Days Δ','Status'].map(col => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logsSnap?.docs.map(doc => {
                  const log = doc.data();
                  const sentAt = log.sentAt?.toDate().toLocaleString() || '-';
                  return (
                    <tr key={doc.id}>
                      <td className="px-3 py-2">{sentAt}</td>
                      <td className="px-3 py-2">{log.name}</td>
                      <td className="px-3 py-2">{log.mobile}</td>
                      <td className="px-3 py-2">{log.diffDays}</td>
                      <td className="px-3 py-2">{log.status}</td>
                    </tr>
                  );
                })}
                {logsSnap?.empty && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">
                      No reminders sent yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
