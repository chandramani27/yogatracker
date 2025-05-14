// components/Footer.jsx
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="sticky bottom-0 w-full bg-white py-3 shadow-inner"
    >
      <motion.div
        className="flex flex-col md:flex-row items-center justify-center space-y-1 md:space-y-0 md:space-x-2 px-4 text-center text-gray-700 text-sm md:text-base"
        animate={{ y: [0, -3, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      >
        <span>
          Developed by <strong>Chandramani Kumar</strong> &amp; Designed by <strong>Priyanka Singh</strong>
        </span>
        <motion.div
          className="mt-1 md:mt-0"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
        >
          <Heart className="w-5 h-5 text-red-500" />
        </motion.div>
      </motion.div>
    </motion.footer>
  );
}
