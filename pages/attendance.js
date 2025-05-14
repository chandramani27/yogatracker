import Head from 'next/head';
import Navbar from '../components/Navbar';
import AttendanceTable from '../components/AttendanceTable';

export default function AttendancePage() {
  return (
    <>
      <Head>
        <title>Attendance – Yoga Admin</title>
      </Head>
      <Navbar />
      <main className="p-6 space-y-6">
        <h2 className="text-2xl font-semibold">Upload & Match Attendance</h2>
        <AttendanceTable />
      </main>
    </>
  );
}
