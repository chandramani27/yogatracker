// components/MemberForm.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { addDoc, collection, doc } from 'firebase/firestore';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { db } from '../firebaseConfig';

export default function MemberForm() {
  // load settings
  const settingsRef = doc(db, 'settings', 'default');
  const [settings] = useDocumentData(settingsRef);

  // collapse state
  const [isOpen, setIsOpen] = useState(false);
  // form fields
  const [f, setF] = useState({
    name:'', mobile:'', batch:'', category:'',
    fees:'', period:'', renewalDate:'',
    paidBy:'', email:'', leadSource:'', source:'',
    dueDate:''
  });

  // update dueDate
  useEffect(() => {
    const { renewalDate, period } = f;
    if (renewalDate && period) {
      const d = new Date(renewalDate);
      const [val, unit] = period.split(' ');
      const n = parseInt(val,10);
      if (unit.startsWith('month')) d.setMonth(d.getMonth()+n);
      else if (unit.startsWith('day')) d.setDate(d.getDate()+n);
      setF(f => ({ ...f, dueDate: d.toISOString().slice(0,10) }));
    }
  }, [f.renewalDate, f.period]);

  const handle = key => e => setF(f => ({ ...f, [key]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    const data = {
      ...f,
      fees: Number(f.fees),
      status:'Not Due',
      reminderStatus:'',
      freeze:false,
      transferTo:'',
      updatedMobile:''
    };
    await addDoc(collection(db,'members'), data);
    // reset
    setF({
      name:'', mobile:'', batch:'', category:'',
      fees:'', period:'', renewalDate:'',
      paidBy:'', email:'', leadSource:'', source:'',
      dueDate:''
    });
    setIsOpen(false);
  };

  if (!settings) return null;

  return (
    <div className="mb-8">
      {/* Header */}
      <div
        onClick={() => setIsOpen(o => !o)}
        className="cursor-pointer select-none bg-gradient-to-r from-purple-600 to-indigo-600
                   text-white p-4 rounded-lg flex justify-between items-center shadow-lg"
      >
        <h2 className="text-lg font-medium">Add New Member</h2>
        {isOpen ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
      </div>

      {/* Collapse Panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <form
              onSubmit={submit}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white
                         p-6 rounded-b-lg shadow-inner border-t-2 border-purple-600"
            >
              {/* Text Inputs */}
              {[
                { label:'Name', key:'name', type:'text', required:true },
                { label:'Mobile', key:'mobile', type:'tel', required:true },
                { label:'Renewal Date', key:'renewalDate', type:'date', required:true },
                { label:'Fees Paid', key:'fees', type:'number' },
                { label:'Paid by Relative', key:'paidBy', type:'tel' },
                { label:'Email', key:'email', type:'email' }
              ].map(({ label, key, type, required })=>(
                <label key={key} className="block">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <input
                    type={type}
                    value={f[key]}
                    onChange={handle(key)}
                    required={!!required}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded
                               focus:outline-none focus:ring-2 focus:ring-indigo-400
                               transition duration-200"
                  />
                </label>
              ))}

              {/* Dynamic Selects */}
              {[
                { label:'Subscription Period', opts:settings.periodOptions, key:'period' },
                { label:'Batch Time',           opts:settings.batchOptions, key:'batch' },
                { label:'Category',             opts:settings.categoryOptions, key:'category' },
                { label:'Lead Source',          opts:settings.leadSourceOptions, key:'leadSource' },
                { label:'Center Source',        opts:settings.sourceOptions, key:'source' }
              ].map(({ label, opts, key })=>(
                <label key={key} className="block">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <select
                    value={f[key]}
                    onChange={handle(key)}
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded
                               bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400
                               transition duration-200"
                  >
                    <option value="">Select…</option>
                    {opts.map(o=>(
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ))}

              {/* Due Date */}
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Due Date</span>
                <input
                  type="date"
                  value={f.dueDate}
                  readOnly
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded bg-gray-100
                             transition duration-200"
                />
              </label>

              {/* Submit */}
              <div className="col-span-full flex justify-end">
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500
                             text-white font-semibold rounded-lg shadow-md
                             hover:from-indigo-600 hover:to-purple-600
                             transition duration-200"
                >
                  Add Member
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
