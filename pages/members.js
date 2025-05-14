import Head from 'next/head';
import Navbar from '../components/Navbar';
import MemberTable from '../components/MemberTable';
import MemberForm from '../components/MemberForm';

export default function MembersPage() {
  return (
    <>
      <Head>
        <title>Members – Yoga Admin</title>
      </Head>
      <Navbar />
      <main className="p-6 space-y-6">
        <h2 className="text-2xl font-semibold">Manage Members</h2>
        <MemberForm />
        <MemberTable />
      </main>
    </>
  );
}
