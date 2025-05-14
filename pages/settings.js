// pages/settings.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function SettingsPage() {
  const settingsRef = doc(db, 'settings', 'default');
  const [data, loading, error] = useDocumentData(settingsRef);

  // raw editor states
  const [raw, setRaw] = useState({
    batchOptions: '',
    categoryOptions: '',
    periodOptions: '',
    leadSourceOptions: '',
    sourceOptions: '',
    messageTemplates: '',
    messageInterval: '5',
    whatsappApiUrl: ''
  });
  const [initialLoad, setInitialLoad] = useState(true);
  const [saving, setSaving] = useState(false);

  // on first load, populate raw from Firestore
  useEffect(() => {
    if (data && initialLoad) {
      setRaw({
        batchOptions: data.batchOptions.join(', '),
        categoryOptions: data.categoryOptions.join(', '),
        periodOptions: data.periodOptions.join(', '),
        leadSourceOptions: data.leadSourceOptions.join(', '),
        sourceOptions: data.sourceOptions.join(', '),
        messageTemplates: JSON.stringify(data.messageTemplates, null, 2),
        messageInterval: String(data.messageInterval),
        whatsappApiUrl: data.whatsappApiUrl || ''
      });
      setInitialLoad(false);
    }
  }, [data, initialLoad]);

  if (loading) return <p>Loading settings…</p>;
  if (error)   return <p className="text-red-500">Error: {error.message}</p>;

  // handlers just update raw
  const handleRawChange = (key, val) => {
    setRaw(r => ({ ...r, [key]: val }));
  };

  const save = async () => {
    let msgTpl = {};
    try {
      msgTpl = JSON.parse(raw.messageTemplates);
    } catch (e) {
      alert('Invalid JSON in Message Templates');
      return;
    }
    // parse arrays
    const arrKeys = ['batchOptions','categoryOptions','periodOptions','leadSourceOptions','sourceOptions'];
    const obj = {
      ...data,
      messageTemplates: msgTpl,
      messageInterval: Number(raw.messageInterval),
      whatsappApiUrl: raw.whatsappApiUrl
    };
    arrKeys.forEach(key => {
      obj[key] = raw[key]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    });

    setSaving(true);
    await setDoc(settingsRef, obj);
    setSaving(false);
    alert('Settings saved');
  };

  return (
    <>
      <Head><title>Settings – Yoga Admin</title></Head>
      <Navbar />
      <main className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Arrays */}
        {['batchOptions','categoryOptions','periodOptions','leadSourceOptions','sourceOptions'].map(key => (
          <div key={key}>
            <label className="block font-medium mb-1">
              {key.replace(/([A-Z])/g,' $1')}
            </label>
            <textarea
              rows={2}
              value={raw[key]}
              onChange={e => handleRawChange(key, e.target.value)}
              className="w-full border rounded p-2"
            />
            <p className="text-sm text-gray-500">Comma-separate each value.</p>
          </div>
        ))}

        {/* Message Templates */}
        <div>
          <label className="block font-medium mb-1">Message Templates (JSON)</label>
          <textarea
            rows={8}
            value={raw.messageTemplates}
            onChange={e => handleRawChange('messageTemplates', e.target.value)}
            className="w-full border rounded p-2 font-mono"
          />
          <p className="text-sm text-gray-500">
            JSON object, e.g. <code>{'{ "3": "...", "0": "..." }'}</code>.
          </p>
        </div>

        {/* Interval */}
        <div>
          <label className="block font-medium mb-1">Message Interval (s)</label>
          <input
            type="number"
            value={raw.messageInterval}
            onChange={e => handleRawChange('messageInterval', e.target.value)}
            className="w-24 border rounded p-1"
            min={0}
          />
        </div>

        {/* WhatsApp URL */}
        <div>
          <label className="block font-medium mb-1">WhatsApp API URL</label>
          <input
            type="url"
            value={raw.whatsappApiUrl}
            onChange={e => handleRawChange('whatsappApiUrl', e.target.value)}
            className="w-full border rounded p-2"
            placeholder="https://your-whatsapp-api/send"
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </main>
    </>
  );
}
