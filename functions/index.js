const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { PDFDocument, rgb } = require('pdf-lib');
const fetch = require('node-fetch');

admin.initializeApp();

const gmailEmail = functions.config().gmail.email;
const gmailAppPassword = functions.config().gmail.password;
const notifyEmail = functions.config().notify.email;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: gmailEmail, pass: gmailAppPassword },
});

exports.sendAgreementEmail = functions.firestore
  .document('agreements/{agreementId}')
  .onCreate(async (snap, context) => {
    try {
      const data = snap.data();
      if (!data.vendorEmail || !data.agreementId || !data.vendorName) {
        throw new Error('Missing required fields: vendorEmail, agreementId, or vendorName');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.vendorEmail)) {
        throw new Error(`Invalid vendorEmail format: ${data.vendorEmail}`);
      }

      if (!gmailEmail || !gmailAppPassword) {
        throw new Error('Gmail credentials not configured');
      }

      const link = `https://digitalagreement-8755c.web.app/sign/${data.agreementId}`;

      const mailOptions = {
        from: `Cbazaar <${gmailEmail}>`,
        to: data.vendorEmail,
        subject: '📝 Agreement from Cbazaar',
        html: `
          <div style="font-family: Arial, sans-serif; background: #f8f8f8; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
              <img src="https://i.ytimg.com/vi/goUjjZURu-Q/maxresdefault.jpg" alt="Cbazaar" style="height: 50px; margin-bottom: 20px;" />
              <h2>Hello ${data.vendorName},</h2>
              <p>You've received a digital agreement from <strong>Cbazaar</strong>.</p>
              <div style="margin: 30px 0; text-align: center;">
                <a href="${link}" target="_blank"
                   style="background: #007bff; color: #fff; padding: 14px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  📥 Review & Sign Agreement
                </a>
              </div>
              <p>If the button doesn't work, copy this link:</p>
              <p><a href="${link}">${link}</a></p>
              <hr style="margin-top: 40px;">
              <p style="font-size: 12px; color: #aaa;">© Cbazaar. All rights reserved.</p>
            </div>
          </div>`
      };

      await transporter.sendMail(mailOptions);
      console.log(`📩 Email sent to ${data.vendorEmail} for agreement ${data.agreementId}`);
    } catch (error) {
      console.error(`❌ Failed to send email for agreement ${context.params.agreementId}:`, error);
      await admin.firestore().collection('email_errors').doc(new Date().toISOString()).set({
        error: error.message,
        agreementId: context.params.agreementId,
        vendorEmail: snap.data().vendorEmail || 'unknown',
        timestamp: new Date().toISOString(),
      });
      throw new functions.https.HttpsError('internal', 'Failed to send email: ' + error.message);
    }
  });

exports.generateSignedPdf = functions
  .runWith({ timeoutSeconds: 120, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const { pdfUrl, agreementId, vendorData, signatureDataUrl } = data;

    try {
      if (!pdfUrl || !agreementId || !vendorData) {
        throw new Error('Missing required fields: pdfUrl, agreementId, or vendorData');
      }

      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      const originalPdf = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(originalPdf);

      const newPage = pdfDoc.addPage([595, 1200]); // Increased height
      const { height } = newPage.getSize();

      let y = height - 50;
      for (const [key, value] of Object.entries(vendorData)) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        newPage.drawText(`${label}: ${value}`, { x: 50, y, size: 10, color: rgb(0, 0, 0) });
        y -= 14;
      }

      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      newPage.drawText(`Signed At: ${timestamp}`, {
        x: 50,
        y: y - 20,
        size: 12,
        color: rgb(0, 0, 0),
      });
      y -= 40;

      if (signatureDataUrl) {
        const signatureBytes = Buffer.from(signatureDataUrl.split(',')[1], 'base64');
        const signatureImage = await pdfDoc.embedPng(signatureBytes);
        newPage.drawText('Authorized Vendor Signature (Below)', {
          x: 50,
          y: y - 20,
          size: 10,
          color: rgb(0, 0, 0),
        });
        newPage.drawImage(signatureImage, {
          x: 50,
          y: y - 80,
          width: 150,
          height: 60,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const bucket = admin.storage().bucket();
      const filePath = `signed_agreements/${agreementId}_signed.pdf`;
      const fileRef = bucket.file(filePath);

      await fileRef.save(Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        resumable: false,
      });

      await fileRef.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      return { signedPdfUrl: publicUrl };
    } catch (err) {
      console.error('PDF merge failed:', err);
      throw new functions.https.HttpsError('internal', 'PDF generation failed: ' + err.message);
    }
  });

exports.notifyOnVendorSign = functions.firestore
  .document('agreements/{agreementId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before.signed && after.signed) {
      const { vendorName, vendorEmail, signedAt, signedPdfUrl } = after;

      const mailOptions = {
        from: `Cbazaar <${gmailEmail}>`,
        to: notifyEmail,
        subject: `✅ Agreement Signed by ${vendorName}`,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Agreement Signed</h2>
            <p><strong>Vendor:</strong> ${vendorName}</p>
            <p><strong>Email:</strong> ${vendorEmail}</p>
            <p><strong>Signed At:</strong> ${new Date(signedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            <p><a href="${signedPdfUrl}" target="_blank">📄 View Signed PDF</a></p>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`📩 Admin notified at ${notifyEmail}`);
      } catch (error) {
        console.error('❌ Email sending failed:', error);
        await admin.firestore().collection('email_errors').doc(new Date().toISOString()).set({
          error: error.message,
          agreementId: change.after.id,
          vendorEmail: vendorEmail || 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
    }
  });