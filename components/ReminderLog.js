// components/ReminderLog.jsx
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function ReminderLog() {
  const [snap, loading, error] = useCollection(
    query(
      collection(db, 'reminderLogs'),
      orderBy('sentAt', 'desc'),
      limit(50)
    )
  );

  if (loading) return <p>Loading reminder logs…</p>;
  if (error)   return <p className="text-red-500">Error: {error.message}</p>;

  return (
    <div className="overflow-x-auto bg-white shadow rounded p-4">
      <h2 className="text-xl font-semibold mb-4">Reminder Log (last 50)</h2>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['Sent At','Name','Mobile','Days Δ','Status','Message'].map(col => (
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
          {snap.docs.map(doc => {
            const log = doc.data();
            const sentAt = log.sentAt?.toDate().toLocaleString() || '-';
            return (
              <tr key={doc.id}>
                <td className="px-3 py-2 whitespace-nowrap">{sentAt}</td>
                <td className="px-3 py-2 whitespace-nowrap">{log.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{log.mobile}</td>
                <td className="px-3 py-2 whitespace-nowrap">{log.diffDays}</td>
                <td className="px-3 py-2 whitespace-nowrap">{log.status}</td>
                <td className="px-3 py-2">{log.message}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {snap.empty && <p className="mt-4 text-center text-gray-500">No reminder logs yet.</p>}
    </div>
  );
}
