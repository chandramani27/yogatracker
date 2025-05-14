// pages/reports.js
import Head from 'next/head';
import Navbar from '../components/Navbar';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useMemo } from 'react';

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function ReportsPage() {
  const [snap] = useCollection(query(collection(db, 'members')));
  const members = snap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];

  const revenueByCategory = useMemo(() => {
    const agg = {};
    members.forEach(m => {
      const cat = m.category || 'Uncategorized';
      const fee = Number(m.fees) || 0;
      agg[cat] = (agg[cat] || 0) + fee;
    });
    return Object.entries(agg).map(([category, revenue]) => ({ category, revenue }));
  }, [members]);

  const monthlyRevenue = useMemo(() => {
    const agg = {};
    members.forEach(m => {
      const d = new Date(m.renewalDate);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const fee = Number(m.fees) || 0;
      agg[key] = (agg[key] || 0) + fee;
    });
    return Object.entries(agg)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [members]);

  const totalRevenue = revenueByCategory.reduce((sum, r) => sum + r.revenue, 0);
  const totalMembers = members.length;
  const avgRevenue   = totalMembers ? (totalRevenue / totalMembers).toFixed(2) : '0.00';

  const categoryLabels = revenueByCategory.map(r => r.category);
  const categoryData   = revenueByCategory.map(r => r.revenue);
  const monthLabels    = monthlyRevenue.map(r => r.month);
  const monthData      = monthlyRevenue.map(r => r.revenue);

  const palette = [
    '#4dc9f6','#f67019','#f53794','#537bc4',
    '#acc236','#166a8f','#00a950','#58595b','#8549ba'
  ];
  const barColors = categoryLabels.map((_, i) => palette[i % palette.length]);

  // common options for both charts
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#333',
          font: { weight: 'bold' }
        }
      },
      tooltip: {
        titleColor: '#333',
        bodyColor: '#333',
        bodyFont: { weight: 'bold' }
      }
    },
    scales: {
      x: {
        ticks: { color: '#333', font: { weight: 'bold' } },
        title: { display: false }
      },
      y: {
        ticks: {
          color: '#333',
          font: { weight: 'bold' },
          callback: val => `₹${val}`
        },
        title: { display: false }
      }
    }
  };

  return (
    <>
      <Head><title>Reports – Yoga Dashboard</title></Head>
      <Navbar />

      <main className="p-6 space-y-8">
        <h1 className="text-2xl font-semibold">Detailed Reports</h1>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white shadow-lg shadow-gray-600 rounded-lg p-4">
            <h2 className="text-gray-600">Total Revenue</h2>
            <p className="mt-2 text-3xl font-bold">₹{totalRevenue}</p>
          </div>
          <div className="bg-white shadow-lg shadow-gray-600 rounded-lg p-4">
            <h2 className="text-gray-600">Total Members</h2>
            <p className="mt-2 text-3xl font-bold">{totalMembers}</p>
          </div>
          <div className="bg-white shadow-lg shadow-gray-600 rounded-lg p-4">
            <h2 className="text-gray-600">Avg. Revenue/Member</h2>
            <p className="mt-2 text-3xl font-bold">₹{avgRevenue}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue by Category */}
          <div className="bg-white shadow-lg shadow-gray-600 rounded-lg p-6">
            <h2 className="text-xl font-medium mb-4">Revenue by Category</h2>
            <div className="relative h-72">
              <Bar
                data={{
                  labels: categoryLabels,
                  datasets: [{
                    label: 'Revenue (₹)',
                    data: categoryData,
                    backgroundColor: barColors,
                    borderColor: barColors.map(c => c + 'CC'),
                    borderWidth: 1
                  }]
                }}
                options={commonOptions}
                height={288}
              />
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-white shadow-lg shadow-gray-600 rounded-lg p-6">
            <h2 className="text-xl font-medium mb-4">Monthly Revenue</h2>
            <div className="relative h-72">
              <Line
                data={{
                  labels: monthLabels,
                  datasets: [{
                    label: 'Revenue (₹)',
                    data: monthData,
                    borderColor: '#f67019',
                    backgroundColor: 'rgba(246,112,25,0.3)',
                    pointBackgroundColor: '#f67019',
                    fill: true,
                    tension: 0.3
                  }]
                }}
                options={commonOptions}
                height={288}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
