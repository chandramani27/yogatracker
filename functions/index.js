// functions/index.js
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Replace with your actual API endpoint
const WHATSAPP_API_URL = 'https://onlymsg.botmaster.co.in/send';

// Run every day at 08:00 AM Asia/Kolkata
export const scheduledReminders = functions
  .pubsub
  .schedule('0 8 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const membersSnap = await db.collection('members').get();
    const sendPromises = membersSnap.docs.map(async doc => {
      const m = doc.data();
      // Parse renewalDate
      const renewal = new Date(m.renewalDate);
      renewal.setHours(0,0,0,0);
      // Calculate dueDate from period (e.g. "3 month", "1 day")
      const [numStr, unit] = (m.period || '').split(' ');
      const n = parseInt(numStr, 10) || 0;
      const due = new Date(renewal);
      if (unit?.startsWith('month'))    due.setMonth(due.getMonth() + n);
      else if (unit?.startsWith('day')) due.setDate(due.getDate() + n);
      due.setHours(0,0,0,0);

      const diff = Math.floor((due - today) / (1000*60*60*24));
      let msg;
      switch (diff) {
        case  3: msg = '🗓️ Reminder: Your yoga subscription is due in 3 days. Please renew on time.'; break;
        case  2: msg = '🗓️ Reminder: Your yoga subscription is due in 2 days. Please renew on time.'; break;
        case  0: msg = '🧘 Friendly reminder: Your yoga subscription is due today. Kindly renew.'; break;
        case -1: msg = '⚠️ Your yoga subscription was due yesterday and is now overdue. Please renew.'; break;
        case -2: msg = '⚠️ Your yoga subscription is overdue by 2 days. Please renew immediately.'; break;
        default: return;  // no reminder outside of -2..3
      }

      // Choose recipient number
      const to = (m.paidBy || m.mobile || '').replace(/\D/g, '');
      if (!to) return;

      // Send WhatsApp via API
      let status = 'Sent';
      try {
        // Node 18+ on GCP has global fetch
        await fetch(`${WHATSAPP_API_URL}?mobile=${to}&msg=${encodeURIComponent(msg)}`);
      } catch (e) {
        console.error('WhatsApp send failed:', e);
        status = 'Failed';
      }

      // Log it
      await db.collection('reminderLogs').add({
        memberId:    doc.id,
        name:        m.name,
        mobile:      to,
        diffDays:    diff,
        message:     msg,
        status:      status,
        sentAt:      admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await Promise.all(sendPromises);
    return null;
  });
