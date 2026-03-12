const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');

initializeApp();

exports.notifyAdminOnNewPost = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post || post.status !== 'pending') return;

  const db = getFirestore();

  await db.collection('mail').add({
    to: 'YOUR_ADMIN_EMAIL',   // ← replace with real admin email before deploy
    message: {
      subject: '[holler.works] new post pending approval',
      text: [
        'New post submitted to holler.works and is pending your approval.',
        '',
        `Title:    ${post.title}`,
        `Type:     ${post.type}`,
        `Category: ${post.category}`,
        `Location: ${post.location}`,
        '',
        'Review it at: https://holler.works/#/admin',
      ].join('\n'),
    },
  });
});
