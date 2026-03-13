const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule }   = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const algoliasearch    = require('algoliasearch');

initializeApp();

function getAlgoliaIndex() {
  const client = algoliasearch(
    process.env.ALGOLIA_APP_ID,
    process.env.ALGOLIA_ADMIN_KEY
  );
  return client.initIndex('holler_works_posts');
}

// ── 1. Email admin on new post ─────────────────────────────────────────────
exports.onNewPost = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  if (!post || post.status !== 'pending') return;

  const db = getFirestore();
  await db.collection('mail').add({
    to: process.env.ADMIN_EMAIL,
    message: {
      subject: '[holler.works] new post pending approval',
      text: [
        'New post submitted to holler.works and is pending your approval.',
        '',
        `Title:    ${post.title}`,
        `Type:     ${post.type}`,
        `Category: ${post.category}`,
        `Location: ${post.location}`,
        `Comp:     ${post.compensation}`,
        `Contact:  ${post.contact}`,
        '',
        'Review it at: https://holler.works/#/admin',
      ].join('\n'),
    },
  });
});

// ── 2. Algolia sync on status change ──────────────────────────────────────
exports.onPostStatusChange = onDocumentUpdated('posts/{postId}', async (event) => {
  const before = event.data.before.data();
  const after  = event.data.after.data();

  // Guard: only act on status changes
  if (before.status === after.status) return;

  const postId = event.params.postId;
  const db     = getFirestore();
  const index  = getAlgoliaIndex();

  if (after.status === 'approved') {
    // Set approvedAt. This update triggers onPostStatusChange again, but the
    // guard (before.status === after.status) will short-circuit that second
    // invocation. The double-trigger is expected and visible in function logs.
    await db.collection('posts').doc(postId).update({
      approvedAt: FieldValue.serverTimestamp(),
    });

    // Add to Algolia
    await index.saveObject({
      objectID:       postId,
      title:          after.title          || '',
      description:    after.description    || '',
      category:       after.category       || '',
      location:       after.location       || '',
      type:           after.type           || '',
      compensation:   after.compensation   || '',
      remoteFriendly: after.remoteFriendly || false,
      approvedAt:     Date.now(),
    });

  } else if (after.status === 'expired' || after.status === 'rejected') {
    // Remove from Algolia (idempotent — safe if record doesn't exist)
    await index.deleteObject(postId);
  }
});

// ── 3. Daily expiry + featured cleanup ────────────────────────────────────
exports.dailyExpiry = onSchedule({ schedule: '0 0 * * *', timeZone: 'America/New_York' }, async () => {
  const db    = getFirestore();
  const index = getAlgoliaIndex();
  const now   = new Date();

  // ── Expire posts approved > 28 days ago ─────────────────────────────
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 28);

  const expireSnap = await db.collection('posts')
    .where('status', '==', 'approved')
    .where('approvedAt', '<', cutoff)
    .get();

  if (!expireSnap.empty) {
    const batch = db.batch();
    expireSnap.docs.forEach(d => batch.update(d.ref, { status: 'expired' }));
    await batch.commit();
    await index.deleteObjects(expireSnap.docs.map(d => d.id));
  }

  // ── Clear stale featured flags ────────────────────────────────────────
  const staleSnap = await db.collection('posts')
    .where('featured', '==', true)
    .where('featuredUntil', '<', now)
    .get();

  if (!staleSnap.empty) {
    const batch2 = db.batch();
    staleSnap.docs.forEach(d => batch2.update(d.ref, {
      featured: false,
      featuredUntil: null,
    }));
    await batch2.commit();
  }
});
