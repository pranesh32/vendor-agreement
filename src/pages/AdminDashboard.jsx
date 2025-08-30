import React, { useEffect, useState } from 'react';
import { useNavigate} from 'react-router-dom';
import { db, storage, auth } from '../firebaseConfig';
import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import LogoHeader from '../components/LogoHeader';
const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [senderEmail, setSenderEmail] = useState('');
  const navigate = useNavigate();


  // 🔐 Check if admin is logged in
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        setSenderEmail(user.email);
      } else {
        setIsAuthenticated(false);
      }
    });
  }, []);

  // 📄 Load agreements
  useEffect(() => {
    const fetchAgreements = async () => {
      const snap = await getDocs(collection(db, 'agreements'));
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAgreements(data);
    };
    fetchAgreements();
  }, [message]);

  // 📤 Send agreement to vendor
  const handleSendAgreement = async () => {
    if (!vendorName || !vendorEmail || !pdfFile) {
      setMessage('❌ All fields required');
      return;
    }

    const agreementId = uuidv4();
    try {
      const fileRef = ref(storage, `agreements/${agreementId}.pdf`);
      await uploadBytes(fileRef, pdfFile);
      const pdfUrl = await getDownloadURL(fileRef);

      await setDoc(doc(db, 'agreements', agreementId), {
        vendorName,
        vendorEmail,
        agreementId,
        pdfUrl,
        senderEmail,
        signed: false,
        createdAt: Timestamp.now(),
      });

      setMessage('✅ Agreement uploaded and sent!');
      setVendorName('');
      setVendorEmail('');
      setPdfFile(null);
    } catch (err) {
      console.error(err);
      setMessage('❌ Upload failed');
    }
  };

  // 🔒 Logout

    const handleLogout = async () => {
    await signOut(auth);
    navigate('/')
    window.location.reload();
  };


  // 🔍 Filter logic
  const filtered = agreements.filter((a) => {
    const matchesQuery =
      a.vendorName?.toLowerCase().includes(query.toLowerCase()) ||
      a.vendorEmail?.toLowerCase().includes(query.toLowerCase());
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'signed'
        ? a.signed
        : !a.signed;
    return matchesQuery && matchesStatus;
  });

  // 🔐 Auth status rendering
  if (isAuthenticated === null) return <p>Checking login...</p>;
  if (!isAuthenticated) return <p>⛔ Please log in as admin to view dashboard.</p>;

  return (
    <div style={{ padding: 30 }}>
      <LogoHeader />
      <h2>📋 Admin Dashboard</h2>
      <button onClick={handleLogout} style={{ marginBottom: 20 }}>
        Logout
      </button>

      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Search vendor name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: 8, width: '40%', marginRight: 10 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: 8 }}
        >
          <option value="all">All</option>
          <option value="signed">Signed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div style={{ marginBottom: 40 }}>
        <h4>📨 Send New Agreement</h4>
        <input
          placeholder="Vendor Name"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
        /><br />
        <input
          placeholder="Vendor Email"
          value={vendorEmail}
          onChange={(e) => setVendorEmail(e.target.value)}
        /><br />
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files[0])}
        /><br />
        <button onClick={handleSendAgreement} style={{ marginTop: 10 }}>
          Send
        </button>
        <p>{message}</p>
      </div>

      <h3>📄 All Agreements</h3>
      {filtered.length === 0 && <p>No agreements found.</p>}
      {filtered.map((a) => (
        <div
          key={a.id}
          style={{
            border: '1px solid #ccc',
            padding: 15,
            marginBottom: 15,
            background: a.signed ? '#e6ffed' : '#fff',
          }}
        >
          <p><strong>Vendor:</strong> {a.vendorName}</p>
          <p><strong>Email:</strong> {a.vendorEmail}</p>
          <p><strong>Status:</strong> {a.signed ? '✅ Signed' : '⏳ Pending'}</p>
          <p><strong>Sent By:</strong> {a.senderEmail || 'N/A'}</p>
          <a href={a.pdfUrl} target="_blank" rel="noreferrer">📄 View Original PDF</a><br />
          {a.signed && a.signedPdfUrl && (
            <a href={a.signedPdfUrl} target="_blank" rel="noreferrer">🖊️ View Signed PDF</a>
          )}
          <div style={{ marginTop: 10 }}>
            {a.gstFile && <a href={a.gstFile} target="_blank" rel="noreferrer">📎 GST</a>}<br />
            {a.panFile && <a href={a.panFile} target="_blank" rel="noreferrer">📎 PAN</a>}<br />
            {a.chequeFile && <a href={a.chequeFile} target="_blank" rel="noreferrer">📎 Cheque</a>}<br />
            {a.msmeFile && <a href={a.msmeFile} target="_blank" rel="noreferrer">📎 MSME</a>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminDashboard;
