import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage } from '../firebaseConfig';
import LogoHeader from '../components/LogoHeader';

const VendorSignPage = () => {
  const { id } = useParams();
  const [agreement, setAgreement] = useState(null);
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState({
    gst: null,
    pan: null,
    cheque: null,
    msme: null,
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const functions = getFunctions();
  const generateSignedPdf = httpsCallable(functions, 'generateSignedPdf');

  useEffect(() => {
    const fetchAgreement = async () => {
      try {
        console.log('Fetching agreement with ID:', id);
        const docRef = doc(db, 'agreements', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          console.log('Agreement data:', data);
          setAgreement(data);
          if (data.signed) setSubmitted(true);
        } else {
          console.error('Agreement document not found');
          setMessage('❌ Agreement not found.');
        }
      } catch (err) {
        console.error('Error fetching agreement:', err);
        setMessage('❌ Failed to load agreement.');
      }
    };
    fetchAgreement();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`Form field changed: ${name} = ${value}`);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    console.log(`File selected for ${name}:`, files[0]);
    setFiles((prev) => ({ ...prev, [name]: files[0] }));
  };

  const uploadFile = async (file, label) => {
    if (!file) {
      console.log(`No file provided for ${label}`);
      return null;
    }
    try {
      console.log(`Uploading file for ${label}:`, file.name);
      const fileRef = ref(storage, `vendor_uploads/${id}/${label}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      console.log(`File uploaded successfully for ${label}:`, url);
      return url;
    } catch (error) {
      console.error(`Error uploading file for ${label}:`, error);
      throw error;
    }
  };

  const validateForm = () => {
    const requiredFields = ['Company Name', 'Email', 'Phone'];
    const missingFields = requiredFields.filter(field => !formData[field] || formData[field].trim() === '');
    
    if (missingFields.length > 0) {
      setMessage(`❌ Please fill required fields: ${missingFields.join(', ')}`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      console.log('Submission already in progress, ignoring duplicate request');
      return;
    }

    try {
      setIsSubmitting(true);
      setShowConfirm(false);
      setMessage('⏳ Validating form data...');

      console.log('Current form data:', formData);
      
      if (!validateForm()) {
        return;
      }

      setMessage('⏳ Uploading files...');
      console.log('Starting file uploads...');

      // Upload files
      const gstUrl = await uploadFile(files.gst, 'gst');
      const panUrl = await uploadFile(files.pan, 'pan');
      const chequeUrl = await uploadFile(files.cheque, 'cheque');
      const msmeUrl = await uploadFile(files.msme, 'msme');

      console.log('File uploads completed:', { gstUrl, panUrl, chequeUrl, msmeUrl });

      setMessage('⏳ Preparing document data...');

      // Simplified field mapping - keep original form field names
      const vendorData = { ...formData };
      
      // Handle special case for payment cycle
      if (formData.PaymentCycle60Days) {
        vendorData['Payment Cycle 60 Days'] = formData.PaymentCycle60Days;
        delete vendorData.PaymentCycle60Days;
      }

      const updatedData = {
        ...vendorData,
        signed: true,
        signedAt: new Date().toISOString(),
        gstFile: gstUrl,
        panFile: panUrl,
        chequeFile: chequeUrl,
        msmeFile: msmeUrl,
      };

      console.log('Final data to submit:', JSON.stringify(updatedData, null, 2));

      setMessage('⏳ Saving agreement data...');

      // Update the agreement document
      const docRef = doc(db, 'agreements', id);
      
      // Check current document state before updating
      const docSnap = await getDoc(docRef);
      console.log('Current document state before update:', docSnap.exists() ? docSnap.data() : 'Document not found');

      if (!docSnap.exists()) {
        throw new Error('Agreement document not found');
      }

      await updateDoc(docRef, updatedData);
      console.log('Document updated successfully');

      setMessage('⏳ Generating signed PDF...');

      // Generate signed PDF
      console.log('Calling generateSignedPdf function...');
      const result = await generateSignedPdf({
        pdfUrl: agreement.pdfUrl,
        agreementId: id,
        vendorData: vendorData,
        signatureDataUrl: null,
      });

      console.log('PDF generation result:', result);

      if (result.data && result.data.signedPdfUrl) {
        console.log('Generated PDF URL:', result.data.signedPdfUrl);
        await updateDoc(docRef, {
          signedPdfUrl: result.data.signedPdfUrl,
        });
        console.log('PDF URL updated in document');
      } else {
        throw new Error('PDF generation did not return a valid URL');
      }

      setSubmitted(true);
      setMessage('✅ Agreement submitted successfully!');
      console.log('Submission completed successfully');

    } catch (err) {
      console.error('Submission error details:', {
        error: err,
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      
      const errorMsg = err.message || 'Unknown error occurred';
      setMessage('❌ Submission failed: ' + errorMsg);
      
      // Show detailed error to user
      alert(`Submission Error:\n${errorMsg}\n\nPlease check the console for more details and try again.`);

      // Log error to Firestore for debugging
      try {
        const errorRef = doc(db, 'submission_errors', new Date().toISOString().replace(/[:.]/g, '-'));
        await setDoc(errorRef, {
          error: errorMsg,
          fullError: err.toString(),
          code: err.code || 'unknown',
          time: new Date().toISOString(),
          agreementId: id,
          vendorEmail: formData.Email || 'unknown',
          formData: JSON.stringify(formData),
          platform: navigator.userAgent,
          source: 'VendorSignPage',
        });
        console.log('Error logged to Firestore');
      } catch (logErr) {
        console.warn('Failed to log error to Firestore:', logErr);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (message && !agreement) return <div style={{ padding: 20 }}><p>{message}</p></div>;
  if (!agreement) return <div style={{ padding: 20 }}><p>Loading agreement...</p></div>;
  if (submitted) return <div style={{ padding: 20 }}><p>✅ This agreement has already been submitted.</p></div>;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: 'auto' }}>
      <LogoHeader />
      <h2>🖊️ Vendor Agreement</h2>
      <iframe
        src={agreement.pdfUrl}
        title="Agreement"
        width="100%"
        height="500px"
        style={{ border: '1px solid #ccc', marginBottom: 20 }}
      />
      
      <h3>Vendor Details</h3>
      <div style={{ marginBottom: 10 }}>
        <small style={{ color: '#666' }}>* Required fields</small>
      </div>
      
      {[
        { name: 'Company Name', required: true },
        { name: 'Registered Address', required: false },
        { name: 'Phone', required: true },
        { name: 'Email', required: true },
        { name: 'Gst', required: false },
        { name: 'PaymentCycle60Days', required: false, placeholder: 'Payment Cycle 60 Days' },
        { name: 'Cash Discount', required: false },
        { name: 'Pan', required: false },
        { name: 'MSME', required: false },
        { name: 'Manufacturer or Trader', required: false },
        { name: 'Contact Person', required: false },
        { name: 'Contact Phone', required: false },
        { name: 'Payment To Be Made In Favor of', required: false },
        { name: 'Bank Account Number', required: false },
        { name: 'Bank Name', required: false },
        { name: 'Ifsc Code', required: false },
        { name: 'Brand Name', required: false },
        { name: 'Billing Address', required: false },
      ].map((field, idx) => (
        <input
          key={idx}
          name={field.name}
          placeholder={`${field.placeholder || field.name}${field.required ? ' *' : ''}`}
          value={formData[field.name] || ''}
          onChange={handleChange}
          style={{
            display: 'block',
            margin: '8px 0',
            width: '100%',
            padding: '8px',
            border: field.required && (!formData[field.name] || formData[field.name].trim() === '') 
              ? '2px solid #ff6b6b' : '1px solid #ccc',
          }}
        />
      ))}
      
      <label>
        Mode Of Working:
        <select
          name="modeOfWorking"
          value={formData.modeOfWorking || ''}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', margin: '8px 0', padding: '8px' }}
        >
          <option value="">Select</option>
          <option value="JIT">Just In Time (JIT)</option>
          <option value="MTO">Made To Order (MTO)</option>
        </select>
      </label>
      
      <label>
        Pricing Model:
        <select
          name="pricingModel"
          value={formData.pricingModel || ''}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', margin: '8px 0', padding: '8px' }}
        >
          <option value="">Select</option>
          <option value="MRP">MRP</option>
          <option value="Transfer Price">Transfer Price</option>
        </select>
      </label>
      
      {formData.pricingModel === 'MRP' && (
        <input
          name="percentageMargin"
          placeholder="Enter Percentage Margin"
          value={formData.percentageMargin || ''}
          onChange={handleChange}
          style={{ display: 'block', margin: '8px 0', width: '100%', padding: '8px' }}
        />
      )}
      
      <h4>📎 Upload Supporting Documents</h4>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', margin: '5px 0' }}>
          GST Certificate: 
          <input type="file" name="gst" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
          {files.gst && <span style={{ color: 'green', fontSize: '12px' }}> ✓ {files.gst.name}</span>}
        </label>
        
        <label style={{ display: 'block', margin: '5px 0' }}>
          PAN Card: 
          <input type="file" name="pan" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
          {files.pan && <span style={{ color: 'green', fontSize: '12px' }}> ✓ {files.pan.name}</span>}
        </label>
        
        <label style={{ display: 'block', margin: '5px 0' }}>
          Cancelled Cheque: 
          <input type="file" name="cheque" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
          {files.cheque && <span style={{ color: 'green', fontSize: '12px' }}> ✓ {files.cheque.name}</span>}
        </label>
        
        <label style={{ display: 'block', margin: '5px 0' }}>
          MSME Certificate: 
          <input type="file" name="msme" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
          {files.msme && <span style={{ color: 'green', fontSize: '12px' }}> ✓ {files.msme.name}</span>}
        </label>
      </div>
      
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isSubmitting}
          style={{ 
            padding: '12px 24px', 
            fontWeight: 'bold', 
            backgroundColor: isSubmitting ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Agreement'}
        </button>
      </div>
      
      {showConfirm && !isSubmitting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
          }}
        >
          <div style={{ background: '#fff', padding: 30, borderRadius: 10, maxWidth: '400px' }}>
            <h3>Confirm Submission</h3>
            <p>Please review your information carefully. Once submitted, you cannot edit the agreement.</p>
            <div style={{ marginTop: 20 }}>
              <button 
                onClick={handleSubmit} 
                style={{ 
                  marginRight: 10, 
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                Yes, Submit
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {message && (
        <div style={{ 
          marginTop: 20, 
          padding: '10px', 
          backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('❌') ? '#f8d7da' : '#fff3cd',
          border: '1px solid ' + (message.includes('✅') ? '#c3e6cb' : message.includes('❌') ? '#f5c6cb' : '#ffeaa7'),
          borderRadius: '4px'
        }}>
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}
      
      {/* Debug info - remove in production */}
      <details style={{ marginTop: 20, fontSize: '12px', color: '#666' }}>
        <summary>Debug Information</summary>
        <pre>{JSON.stringify({ formData, hasFiles: Object.keys(files).filter(k => files[k]).length }, null, 2)}</pre>
      </details>
    </div>
  );
};

export default VendorSignPage;