// components/MemberTable.jsx
import { useState, useMemo, useRef } from 'react';
import { useCollection, useDocumentData } from 'react-firebase-hooks/firestore';
import {
  collection,
  query,
  orderBy,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function MemberTable() {
  // 1) Data hooks
  const [snap, loadingSnap, errorSnap] = useCollection(
    query(collection(db, 'members'), orderBy('renewalDate', 'desc'))
  );
  const [settings, loadingSettings] = useDocumentData(
    doc(db, 'settings', 'default')
  );

  // 2) UI state
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField]       = useState(null);
  const [sortAsc, setSortAsc]           = useState(true);
  const [selected, setSelected]         = useState([]);
  const [sendingIds, setSendingIds]     = useState([]);
  const [sendingBulk, setSendingBulk]   = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [editData, setEditData]         = useState({});

  // 3) Drag-to-scroll state
  const scrollRef = useRef(null);
  const [isDown, setIsDown]           = useState(false);
  const [startX, setStartX]           = useState(0);
  const [scrollLeft, setScrollLeft]   = useState(0);

  const handleMouseDown  = e => {
    const ref = scrollRef.current;
    setIsDown(true);
    setStartX(e.pageX - ref.offsetLeft);
    setScrollLeft(ref.scrollLeft);
  };
  const handleMouseUp     = () => setIsDown(false);
  const handleMouseLeave  = () => setIsDown(false);
  const handleMouseMove   = e => {
    if (!isDown) return;
    e.preventDefault();
    const ref = scrollRef.current;
    const x = e.pageX - ref.offsetLeft;
    const walk = (x - startX) * 1; // drag-speed
    ref.scrollLeft = scrollLeft - walk;
  };

  // 4) Date helpers
  const parseDate = val => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    if (!isNaN(d)) return d;
    const [a,b,c] = val.split('/').map(n => parseInt(n, 10));
    return a > 12 ? new Date(c, b - 1, a) : new Date(c, a - 1, b);
  };
  const formatDate = d =>
    d instanceof Date
      ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      : '-';

  const calcDueDate = (renewal, period) => {
    const base = parseDate(renewal);
    if (!base || !period) return null;
    const [n, unit] = period.split(' ');
    const dt = new Date(base);
    if (unit.startsWith('month')) dt.setMonth(dt.getMonth() + parseInt(n, 10));
    else if (unit.startsWith('day')) dt.setDate(dt.getDate() + parseInt(n, 10));
    return dt;
  };

  const calcStatus = due => {
    if (!due) return 'N/A';
    const today = new Date();
    today.setHours(0,0,0,0);
    due.setHours(0,0,0,0);
    const diff = Math.floor((due - today)/(1000*60*60*24));
    if (diff > 0) return 'Not Due';
    if (diff === 0) return 'Follow up';
    if (diff >= -2) return 'Overdue';
    return 'On Hold';
  };
  const statusColor = s => ({
    'Not Due':'bg-green-100 text-green-800',
    'Follow up':'bg-yellow-100 text-yellow-800',
    'Overdue':'bg-red-100 text-red-800',
    'On Hold':'bg-gray-200 text-gray-800'
  }[s] || 'bg-gray-100 text-gray-800');

  // 5) Flatten Firestore docs
  const members = (snap?.docs || []).map(d => {
    const m = d.data();
    const due = calcDueDate(m.renewalDate, m.period);
    return {
      id: d.id,
      ...m,
      renewalStr: formatDate(parseDate(m.renewalDate)),
      dueStr:     formatDate(due),
      status:     calcStatus(due),
      diffDays:   due 
        ? Math.floor((due - new Date(new Date().setHours(0,0,0,0))) / (1000*60*60*24))
        : 0
    };
  });

  // 6) Search / filter / sort
  const filtered = useMemo(() => 
    members
      .filter(m =>
        (statusFilter === 'All' || m.status === statusFilter) &&
        [m.name,m.mobile,m.email||'', m.paidBy||'']
          .some(v=>v.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a,b) => {
        if (!sortField) return 0;
        let av = a[sortField], bv = b[sortField];
        if (av instanceof Date) av = av.valueOf();
        if (bv instanceof Date) bv = bv.valueOf();
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
      })
  ,[members, search, statusFilter, sortField, sortAsc]);

  // 7) Loading / error
  if (loadingSnap || loadingSettings)
    return <p className="p-4 text-center">Loading…</p>;
  if (errorSnap)
    return <p className="p-4 text-center text-red-600">Error loading members</p>;

  // 8) Handlers
  const toggleSelectAll = e => 
    setSelected(e.target.checked ? filtered.map(m=>m.id) : []);
  const toggleSelect    = id => 
    setSelected(sel => sel.includes(id) ? sel.filter(x=>x!==id) : [...sel,id]);
  const sortBy          = field => {
    if (sortField === field) setSortAsc(a=>!a);
    else { setSortField(field); setSortAsc(true); }
  };
  const toggleFreeze    = async (id,f) => {
    await updateDoc(doc(db,'members',id),{ freeze: !f });
  };

  // 9) Send reminders
  const sendReminder = async m => {
    setSendingIds(ids=>[...ids,m.id]);
    const tpl = settings.messageTemplates[String(m.diffDays)] || settings.messageTemplates['0'];
    const msg = tpl
      .replace('{name}', m.name)
      .replace('{dueDate}', m.dueStr)
      .replace('{diffDays}', String(m.diffDays));
    const to = (m.paidBy||m.mobile).replace(/\D/g,'');
    let status='Sent', err='';
    try {
      await fetch(`${settings.whatsappApiUrl}?mobile=${to}&msg=${encodeURIComponent(msg)}`);
      await addDoc(collection(db,'reminderLogs'),{
        memberId:m.id, name:m.name, mobile:to,
        diffDays:m.diffDays, message:msg,
        status, sentAt:serverTimestamp()
      });
      alert(`Sent to ${m.name}`);
    } catch(e) {
      status='Failed'; err=e.message;
      await addDoc(collection(db,'reminderLogs'),{
        memberId:m.id, name:m.name, mobile:to,
        diffDays:m.diffDays, message:msg,
        status, error:err, sentAt:serverTimestamp()
      });
      alert(`Failed ${m.name}: ${err}`);
    } finally {
      setSendingIds(ids=>ids.filter(x=>x!==m.id));
    }
  };
  const sendBulk = async () => {
    setSendingBulk(true);
    for (let m of filtered.filter(m=>selected.includes(m.id))) {
      await new Promise(r=>setTimeout(r, settings.messageInterval * 1000));
      await sendReminder(m);
    }
    setSendingBulk(false);
    setSelected([]);
    alert('Bulk send complete');
  };

  // 8) Inline edit
const startEdit        = m => {
  setEditingId(m.id);
  setEditData({
    name:         m.name,
    mobile:       m.mobile,
    renewalDate:  // convert to yyyy-MM-dd for <input type="date">
      parseDate(m.renewalDate).toISOString().slice(0,10),
    period:       m.period,
    batch:        m.batch,
    category:     m.category,
    fees:         m.fees,
    paidBy:       m.paidBy,
    email:        m.email,
    leadSource:   m.leadSource,
    source:       m.source
  });
};
const cancelEdit       = () => {
  setEditingId(null);
  setEditData({});
};
const handleEditChange = (key, val) => {
  setEditData(d=>({ ...d, [key]: val }));
};
const saveEdit         = async id => {
  // recalc dueDate based on edited renewalDate & period
  const due = calcDueDate(editData.renewalDate, editData.period);
  await updateDoc(doc(db,'members',id), {
    name:         editData.name,
    mobile:       editData.mobile,
    renewalDate:  editData.renewalDate,
    period:       editData.period,
    batch:        editData.batch,
    category:     editData.category,
    fees:         Number(editData.fees),
    paidBy:       editData.paidBy,
    email:        editData.email,
    leadSource:   editData.leadSource,
    source:       editData.source,
    dueDate:      due?.toISOString().slice(0,10)
  });
  cancelEdit();
};


  // 11) Render
  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={filtered.length>0 && selected.length===filtered.length}
            onChange={toggleSelectAll}
            className="w-5 h-5"
          />
          <span className="text-sm">Select All</span>
        </div>
        <input
          type="text"
          placeholder="🔍 Search..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={statusFilter}
          onChange={e=>setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-400"
        >
          {['All','Not Due','Follow up','Overdue','On Hold'].map(s=>(
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={sendBulk}
          disabled={!selected.length || sendingBulk}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            selected.length && !sendingBulk
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {sendingBulk ? 'Sending...' : `Send (${selected.length})`}
        </button>
      </div>

      {/* Desktop Table (drag-to-scroll) */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        className={`hidden md:block overflow-x-auto w-full touch-pan-x ${
          isDown ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <table className="min-w-max bg-white shadow rounded-lg">
          <thead className="bg-indigo-50">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  checked={filtered.length>0 && selected.length===filtered.length}
                  onChange={toggleSelectAll}
                  className="w-5 h-5"
                />
              </th>
              {[
                'name','mobile','renewalStr','period','dueStr',
                'status','batch','category','fees','paidBy',
                'email','leadSource','source','reminderStatus','freeze'
              ].map(key=>(
                <th
                  key={key}
                  onClick={()=>sortBy(key)}
                  className="px-3 py-2 text-left text-sm font-semibold text-gray-600 cursor-pointer"
                >
                  {key
                    .replace(/Str$/,'')
                    .replace(/([A-Z])/g,' $1')
                    .replace(/^./,s=>s.toUpperCase())
                  }
                  {sortField===key && ( sortAsc
                    ? <ArrowUp className="inline ml-1 w-4 h-4"/>
                    : <ArrowDown className="inline ml-1 w-4 h-4"/>
                  )}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map(m=>(
                <motion.tr
                  key={m.id}
                  initial={{opacity:0,y:-10}}
                  animate={{opacity:1,y:0}}
                  exit={{opacity:0,y:10}}
                  transition={{duration:0.2}}
                  className="hover:bg-gray-50 even:bg-gray-100"
                >
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={()=>toggleSelect(m.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  {editingId === m.id ? (
  <>
    <td className="p-2"><input
      value={editData.name}
      onChange={e => handleEditChange('name', e.target.value)}
      className="w-full px-2 py-1 border rounded"
    /></td>

    <td className="p-2"><input
      value={editData.mobile}
      onChange={e => handleEditChange('mobile', e.target.value)}
      className="w-full px-2 py-1 border rounded"
    /></td>

    <td className="p-2"><input
      type="date"
      value={editData.renewalDate}
      onChange={e => handleEditChange('renewalDate', e.target.value)}
      className="w-full px-2 py-1 border rounded"
    /></td>

    <td className="p-2">
      <select
        value={editData.period}
        onChange={e => handleEditChange('period', e.target.value)}
        className="w-full px-2 py-1 border rounded"
      >
        <option value="">Select…</option>
        {settings.periodOptions.map(o=>(
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </td>

    {/* read-only dueStr & status */}
    <td className="p-2">{m.dueStr}</td>
    <td className="p-2">{m.status}</td>

    <td className="p-2">
      <select
        value={editData.batch}
        onChange={e => handleEditChange('batch', e.target.value)}
        className="w-full px-2 py-1 border rounded"
      >
        <option value="">Select…</option>
        {settings.batchOptions.map(o=>(
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </td>

    <td className="p-2">
      <select
        value={editData.category}
        onChange={e => handleEditChange('category', e.target.value)}
        className="w-full px-2 py-1 border rounded"
      >
        <option value="">Select…</option>
        {settings.categoryOptions.map(o=>(
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </td>

    <td className="p-2"><input
      type="number"
      value={editData.fees}
      onChange={e => handleEditChange('fees', e.target.value)}
      className="w-full px-2 py-1 border rounded"
    /></td>

    <td className="p-2"><input
      value={editData.paidBy}
      onChange={e => handleEditChange('paidBy', e.target.value)}
      className="w-full px-2 py-1 border rounded"
    /></td>

    <td className="p-2"><input
      type="email"
      value={editData.email}
      onChange={e => handleEditChange('email', e.target.value)}
      className="w-full px-2 py-1 border rounded"
    /></td>

    <td className="p-2">
      <select
        value={editData.leadSource}
        onChange={e => handleEditChange('leadSource', e.target.value)}
        className="w-full px-2 py-1 border rounded"
      >
        <option value="">Select…</option>
        {settings.leadSourceOptions.map(o=>(
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </td>

    <td className="p-2">
      <select
        value={editData.source}
        onChange={e => handleEditChange('source', e.target.value)}
        className="w-full px-2 py-1 border rounded"
      >
        <option value="">Select…</option>
        {settings.sourceOptions.map(o=>(
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </td>

    <td className="p-2">{m.reminderStatus||'-'}</td>
    <td className="p-2">{m.freeze?'Yes':'No'}</td>

    <td className="p-2 space-x-2">
      <button
        onClick={()=>saveEdit(m.id)}
        className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
      >Save</button>
      <button
        onClick={cancelEdit}
        className="px-2 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
      >Cancel</button>
    </td>
  </>
) : (
                    <>
                      <td className="p-2">{m.name}</td>
                      <td className="p-2">{m.mobile}</td>
                      <td className="p-2">{m.renewalStr}</td>
                      <td className="p-2">{m.period}</td>
                      <td className="p-2">{m.dueStr}</td>
                      <td className={`p-2 text-center rounded-full ${statusColor(m.status)}`}>
                        {m.status}
                      </td>
                      <td className="p-2">{m.batch}</td>
                      <td className="p-2">{m.category}</td>
                      <td className="p-2">₹{m.fees}</td>
                      <td className="p-2">{m.paidBy||'-'}</td>
                      <td className="p-2">{m.email||'-'}</td>
                      <td className="p-2">{m.leadSource||'-'}</td>
                      <td className="p-2">{m.source||'-'}</td>
                      <td className="p-2">{m.reminderStatus||'-'}</td>
                      <td className="p-2">{m.freeze?'Yes':'No'}</td>
                      <td className="p-2 space-x-2">
                        <button
                          onClick={()=>startEdit(m)}
                          className="px-2 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500"
                        >
                          Edit
                        </button>
                        <button
                          onClick={()=>toggleFreeze(m.id,m.freeze)}
                          className={`px-2 py-1 rounded ${
                            m.freeze
                              ? 'bg-green-400 text-white hover:bg-green-500'
                              : 'bg-red-400 text-white hover:bg-red-500'
                          }`}
                        >
                          {m.freeze?'Unfreeze':'Freeze'}
                        </button>
                        <button
                          onClick={()=>sendReminder(m)}
                          disabled={sendingIds.includes(m.id)}
                          className={`px-2 py-1 rounded ${
                            sendingIds.includes(m.id)
                              ? 'bg-gray-300 text-gray-600'
                              : 'bg-blue-400 text-white hover:bg-blue-500'
                          }`}
                        >
                          {sendingIds.includes(m.id)?'Sending…':'Send'}
                        </button>
                      </td>
                    </>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-4 text-center text-gray-500">No records found.</p>
        )}
      </div>


      {/* Mobile Cards */}
      <div className="block md:hidden space-y-4">
        {filtered.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity:0, scale:0.95 }}
            animate={{ opacity:1, scale:1 }}
            exit={{ opacity:0, scale:0.95 }}
            transition={{ duration:0.2 }}
            className="bg-white p-4 rounded-lg shadow flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selected.includes(m.id)}
                  onChange={()=>toggleSelect(m.id)}
                  className="w-5 h-5"
                />
                <span className="text-lg font-semibold">{m.name}</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div><dt className="font-medium">Mobile</dt><dd>{m.mobile}</dd></div>
              <div><dt className="font-medium">Renewal</dt><dd>{m.renewalStr}</dd></div>
              <div><dt className="font-medium">Period</dt><dd>{m.period}</dd></div>
              <div><dt className="font-medium">Due</dt><dd>{m.dueStr}</dd></div>
              <div><dt className="font-medium">Status</dt>
                <dd><span className={`px-2 py-1 rounded-full ${statusColor(m.status)}`}>{m.status}</span></dd>
              </div>
              <div><dt className="font-medium">Batch</dt><dd>{m.batch}</dd></div>
              <div><dt className="font-medium">Category</dt><dd>{m.category}</dd></div>
              <div><dt className="font-medium">Fees</dt><dd>₹{m.fees}</dd></div>
              <div><dt className="font-medium">Paid By</dt><dd>{m.paidBy||'-'}</dd></div>
              <div><dt className="font-medium">Email</dt><dd>{m.email||'-'}</dd></div>
              <div><dt className="font-medium">Lead Src</dt><dd>{m.leadSource||'-'}</dd></div>
              <div><dt className="font-medium">Center</dt><dd>{m.source||'-'}</dd></div>
              <div><dt className="font-medium">Reminder</dt><dd>{m.reminderStatus||'-'}</dd></div>
              <div><dt className="font-medium">Freeze</dt><dd>{m.freeze?'Yes':'No'}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={()=>startEdit(m)}
                className="flex-1 px-3 py-2 bg-yellow-400 text-white rounded hover:bg-yellow-500 text-sm"
              >
                Edit
              </button>
              <button
                onClick={()=>toggleFreeze(m.id,m.freeze)}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  m.freeze
                    ? 'bg-green-400 text-white hover:bg-green-500'
                    : 'bg-red-400 text-white hover:bg-red-500'
                }`}
              >
                {m.freeze?'Unfreeze':'Freeze'}
              </button>
              <button
                onClick={()=>sendReminder(m)}
                disabled={sendingIds.includes(m.id)}
                className={`flex-1 px-3 py-2 rounded text-sm ${
                  sendingIds.includes(m.id)
                    ? 'bg-gray-300 text-gray-600'
                    : 'bg-blue-400 text-white hover:bg-blue-500'
                }`}
              >
                {sendingIds.includes(m.id)?'Sending…':'Send'}
              </button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="p-4 text-center text-gray-500">No records found.</p>
        )}
      </div>
    </div>
  );
}
