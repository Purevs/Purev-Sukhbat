import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

admin.initializeApp();
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export const sendEmailOnMailCreate = functions.firestore
  .document('mail/{mailId}')
  .onCreate(async (snap, context) => {
    const mailData = snap.data();
    
    const msg = {
      to: mailData.to,
      from: 'noreply@mpfarm.org', // Таны баталгаажуулсан имэйл
      subject: mailData.message.subject,
      text: mailData.message.text,
    };

    try {
      await sgMail.send(msg);
      await snap.ref.update({
        delivery: {
          state: 'SUCCESS',
          attempts: 1,
          error: null,
        },
      });
    } catch (error) {
      console.error('Error sending email:', error);
      await snap.ref.update({
        delivery: {
          state: 'ERROR',
          attempts: 1,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
