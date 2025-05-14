// components/MemberTable.jsx
import { useState, useMemo } from 'react';
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
  // 1) Hooks & state
  const [snapMembers, loadingMembers, errorMembers] = useCollection(
    query(collection(db, 'members'), orderBy('renewalDate', 'desc'))
  );
  const [settings]      = useDocumentData(doc(db, 'settings', 'default'));
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField]       = useState(null);
  const [sortAsc, setSortAsc]           = useState(true);
  const [selected, setSelected]         = useState([]);
  const [sendingIds, setSendingIds]     = useState([]);
  const [sendingBulk, setSendingBulk]   = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [editData, setEditData]         = useState({});

  // 2) Date helpers & status calc
  const parseDate = val => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    const d = new Date(val);
    if (!isNaN(d)) return d;
    const [a,b,c] = val.split('/').map(n=>parseInt(n,10));
    return a>12 ? new Date(c,b-1,a) : new Date(c,a-1,b);
  };
  const formatDate = d =>
    d instanceof Date
      ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      : '-';
  const calcDueDate = (renewal, period) => {
    const base = parseDate(renewal);
    if (!base || !period) return null;
    const [n,unit] = period.split(' ');
    const dt = new Date(base);
    if (unit.startsWith('month')) dt.setMonth(dt.getMonth()+parseInt(n,10));
    else if (unit.startsWith('day')) dt.setDate(dt.getDate()+parseInt(n,10));
    return dt;
  };
  const calcStatus = due => {
    if (!due) return 'N/A';
    const today = new Date(); today.setHours(0,0,0,0);
    due.setHours(0,0,0,0);
    const diff = Math.floor((due - today)/(1000*60*60*24));
    if (diff>0) return 'Not Due';
    if (diff===0) return 'Follow up';
    if (diff>=-2) return 'Overdue';
    return 'On Hold';
  };
  const statusColor = s => ({
    'Not Due':'bg-green-100 text-green-800',
    'Follow up':'bg-yellow-100 text-yellow-800',
    'Overdue':'bg-red-100 text-red-800',
    'On Hold':'bg-gray-200 text-gray-800'
  }[s]||'bg-gray-100 text-gray-800');

  // 3) Flatten docs → rows
  const members = (snapMembers?.docs||[]).map(d => {
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

  // 4) Search / filter / sort
  const filtered = useMemo(() =>
    members
      .filter(m =>
        (statusFilter==='All' || m.status===statusFilter) &&
        [m.name, m.mobile, m.email||'']
          .some(v => v.toLowerCase().includes(search.toLowerCase()))
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
  , [members, search, statusFilter, sortField, sortAsc]);

  // 5) Loading / error
  if (loadingMembers || !settings)
    return <p className="p-4 text-center">Loading…</p>;
  if (errorMembers)
    return <p className="p-4 text-center text-red-600">Error loading members</p>;

  // 6) Handlers
  const toggleSelectAll = e => setSelected(e.target.checked ? filtered.map(m=>m.id) : []);
  const toggleSelect    = id => setSelected(s=> s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  const sortBy          = field => {
    if (sortField===field) setSortAsc(a=>!a);
    else { setSortField(field); setSortAsc(true); }
  };
  const toggleFreeze = async (id,f)=> {
    await updateDoc(doc(db,'members',id),{ freeze:!f });
  };

  // 7) Reminders & logs
  const sendReminder = async m => {
    setSendingIds(ids=>[...ids,m.id]);
    const tpl = settings.messageTemplates[String(m.diffDays)] || settings.messageTemplates['0'];
    const msg = tpl
      .replace('{name}',m.name)
      .replace('{dueDate}',m.dueStr)
      .replace('{diffDays}',String(m.diffDays));
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
      await new Promise(r=>setTimeout(r, settings.messageInterval*1000));
      // eslint-disable-next-line no-await-in-loop
      await sendReminder(m);
    }
    setSendingBulk(false);
    setSelected([]);
    alert('Bulk send complete');
  };

  // 8) Inline edit
  const startEdit        = m => { setEditingId(m.id); setEditData({...m}); };
  const cancelEdit       = () => { setEditingId(null); setEditData({}); };
  const handleEditChange = (k,v) => setEditData(d=>({...d,[k]:v}));
  const saveEdit         = async id => {
    const due = calcDueDate(editData.renewalDate, editData.period);
    await updateDoc(doc(db,'members',id),{
      ...editData,
      dueDate:due?.toISOString().slice(0,10)
    });
    cancelEdit();
  };

  // 9) Render
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

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full bg-white shadow rounded-lg overflow-hidden">
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
                {key:'name',label:'Name'},
                {key:'mobile',label:'Mobile'},
                {key:'renewalStr',label:'Renewal'},
                {key:'period',label:'Period'},
                {key:'dueStr',label:'Due Date'},
                {key:'status',label:'Status'},
                {key:'batch',label:'Batch'},
                {key:'category',label:'Category'},
                {key:'fees',label:'Fees'},
                {key:'paidBy',label:'Paid By'},
                {key:'email',label:'Email'},
                {key:'leadSource',label:'Lead Source'},
                {key:'source',label:'Source'},
                {key:'reminderStatus',label:'Reminder Status'},
                {key:'freeze',label:'Freeze'}
              ].map(col=>(
                <th
                  key={col.key}
                  onClick={()=>sortBy(col.key)}
                  className="px-3 py-2 text-left text-sm font-semibold text-gray-600 cursor-pointer select-none"
                >
                  {col.label}
                  {sortField===col.key && (
                    sortAsc
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
                  {editingId===m.id ? (
                    <>
                      {/* inline edit inputs (just name shown for brevity) */}
                      <td className="p-2">
                        <input
                          value={editData.name}
                          onChange={e=>handleEditChange('name',e.target.value)}
                          className="w-full px-2 py-1 border rounded-lg"
                        />
                      </td>
                      {/* …other fields… */}
                      <td className="p-2 space-x-2">
                        <button
                          onClick={()=>saveEdit(m.id)}
                          className="px-2 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{m.name}</td>
                      <td className="p-2">{m.mobile}</td>
                      <td className="p-2">{m.renewalStr}</td>
                      <td className="p-2">{m.period}</td>
                      <td className="p-2">{m.dueStr}</td>
                      <td className={`p-2 text-center ${statusColor(m.status)}`}>{m.status}</td>
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
                          className="px-2 py-1 bg-yellow-400 text-white rounded-lg hover:bg-yellow-500"
                        >
                          Edit
                        </button>
                        <button
                          onClick={()=>toggleFreeze(m.id,m.freeze)}
                          className={`px-2 py-1 rounded-lg ${
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
                          className={`px-2 py-1 rounded-lg ${
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
        {filtered.length===0 && (
          <p className="p-4 text-center text-gray-500">No records found.</p>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-4">
        {filtered.map(m=>(
          <motion.div
            key={m.id}
            initial={{opacity:0,scale:0.95}}
            animate={{opacity:1,scale:1}}
            exit={{opacity:0,scale:0.95}}
            transition={{duration:0.2}}
            className="bg-white p-4 rounded-lg shadow flex flex-col"
          >
            {/* Header */}
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
            {/* Details */}
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
            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={()=>startEdit(m)}
                className="flex-1 px-3 py-2 bg-yellow-400 text-white rounded-lg hover:bg-yellow-500 text-sm"
              >
                Edit
              </button>
              <button
                onClick={()=>toggleFreeze(m.id,m.freeze)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm ${
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
                className={`flex-1 px-3 py-2 rounded-lg text-sm ${
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
        {filtered.length===0 && (
          <p className="p-4 text-center text-gray-500">No records found.</p>
        )}
      </div>
    </div>
  );
}
