// components/Navbar.jsx
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Users,
  Calendar,
  BarChart2,
  Bell,
  Settings as Cog,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/',           label: 'Dashboard',  icon: <Image src="/meditation.png" alt="Logo" width={24} height={24} /> },
    { href: '/members',    label: 'Members',    icon: <Users className="w-5 h-5"/> },
    { href: '/attendance', label: 'Attendance', icon: <Calendar className="w-5 h-5"/> },
    { href: '/reports',    label: 'Reports',    icon: <BarChart2 className="w-5 h-5"/> },
    { href: '/reminders',  label: 'Reminders',  icon: <Bell className="w-5 h-5"/> },
    { href: '/settings',   label: 'Settings',   icon: <Cog className="w-5 h-5"/> },
  ];

  const toggle = () => setOpen(o => !o);
  const close  = () => setOpen(false);

  return (
    <>
      <nav className="bg-white shadow-md px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/meditation.png" alt="Yoga Logo" width={32} height={32} />
          <span className="text-xl font-semibold">Yoga Dashboard</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-6">
          {links.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition"
            >
              {icon}
              <span>{label}</span>
            </Link>
          ))}
          <Link
            href="/login"
            className="ml-4 px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition"
          >
            Logout
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-gray-700"
          onClick={toggle}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-6 h-6"/> : <Menu className="w-6 h-6"/>}
        </button>
      </nav>

      {/* Mobile Dropdown + Backdrop */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            {/* Dropdown panel */}
            <motion.div
              className="fixed top-0 inset-x-0 bg-white shadow-md z-50 md:hidden"
              initial={{ y: -300 }}
              animate={{ y: 0 }}
              exit={{ y: -300 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <div className="px-6 py-4 flex items-center justify-between border-b">
                <Link href="/" onClick={close} className="flex items-center space-x-2">
                  <Image src="/meditation.png" alt="Logo" width={24} height={24} />
                  <span className="text-lg font-semibold">Yoga Dashboard</span>
                </Link>
                <button onClick={close} aria-label="Close menu">
                  <X className="w-6 h-6 text-gray-800"/>
                </button>
              </div>
              <nav className="px-6 py-4 space-y-4">
                {links.map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition"
                  >
                    {icon}
                    <span>{label}</span>
                  </Link>
                ))}
                <Link
                  href="/login"
                  onClick={close}
                  className="flex items-center space-x-2 mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                >
                  <LogOut className="w-5 h-5"/>
                  <span>Logout</span>
                </Link>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
