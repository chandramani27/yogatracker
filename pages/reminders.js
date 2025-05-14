// pages/reminders.js
import Head from 'next/head';
import Navbar from '../components/Navbar';
import ReminderLog from '../components/ReminderLog';

export default function RemindersPage() {
  return (
    <>
      <Head><title>Reminders – Yoga Admin</title></Head>
      <Navbar />
      <main className="p-6">
        <ReminderLog />
      </main>
    </>
  );
}
