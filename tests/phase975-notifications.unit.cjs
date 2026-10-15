/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
let session = { userId: 11, roleId: 3 }, account = { isActive: true, roleId: 3, email: 'fixture@example.invalid' };
let fail = false, reads = 0, updates = 0;
const revalidated = [];
const records = [
    { id: 1, userId: 11, isRead: false },
    { id: 2, userId: 22, isRead: false },
];
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === 'next/cache') return { revalidatePath: path => revalidated.push(path) };
    if (id === '@/lib/auth/authorization') return { requireAuth: async () => {
        if (!session) throw new Error('LOGIN_REDIRECT'); return session;
    } };
    if (id === '@/lib/repositories/user.repository') return { findUserById: async () => account };
    if (id === '@/lib/repositories/notification.repository') return {
        findNotificationPreview: async userId => {
            reads++; assert.equal(userId, 11); if (fail) throw new Error('PRIVATE_DATABASE_ERROR');
            return { recent: [{ id: 1, title: 'Synthetic', message: 'Fixture', isRead: false, createdAt: new Date(0) }], unreadCount: 12 };
        },
        findNotificationById: async id => records.find(record => record.id === id),
        markNotificationAsRead: async id => { updates++; records.find(record => record.id === id).isRead = true; },
        markAllNotificationsAsRead: async userId => {
            if (fail) throw new Error('PRIVATE_DATABASE_ERROR');
            records.filter(record => record.userId === userId).forEach(record => { record.isRead = true; });
        },
    };
    return original.call(this, id, ...args);
};
const { getCurrentNotificationPreview, markCurrentNotificationAsRead, markAllCurrentNotificationsAsRead } = require('../lib/services/notification.service.ts');
const { notificationHistoryHref } = require('../lib/constants/notification.ts');
(async () => {
    for (const [roleId, path] of [[1, 'admin'], [2, 'adviser'], [3, 'student'], [4, null]]) {
        session.roleId = account.roleId = roleId;
        const result = await getCurrentNotificationPreview();
        assert.equal(result.success, true);
        assert.equal(result.data.unreadCount, 12);
        assert.equal(notificationHistoryHref(roleId), path ? `/dashboard/${path}/notifications` : null);
        assert.ok(!JSON.stringify(result).includes('userId'));
    }
    const before = reads;
    account.isActive = false;
    assert.equal((await markAllCurrentNotificationsAsRead()).success, false);
    assert.equal((await getCurrentNotificationPreview()).success, false);
    assert.equal((await markCurrentNotificationAsRead(1)).success, false);
    account.isActive = true; account.roleId = 2;
    assert.equal((await getCurrentNotificationPreview()).success, false);
    session.roleId = account.roleId = 99;
    assert.equal((await markAllCurrentNotificationsAsRead()).success, false);
    assert.equal((await getCurrentNotificationPreview()).success, false);
    account = null;
    assert.equal((await getCurrentNotificationPreview()).success, false);
    assert.equal(reads, before);
    account = { isActive: true, roleId: 3 }; session.roleId = 3;
    fail = true;
    const failed = await getCurrentNotificationPreview();
    assert.equal(failed.success, false); assert.equal(failed.data, undefined);
    assert.ok(!failed.message.includes('PRIVATE_DATABASE_ERROR')); fail = false;
    for (const invalid of [0, -1, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 1])
        assert.equal((await markCurrentNotificationAsRead(invalid)).success, false);
    assert.equal((await markCurrentNotificationAsRead(2)).success, false, 'Cross-recipient mutation denied');
    assert.equal(updates, 0);
    assert.equal((await markCurrentNotificationAsRead(1)).success, true);
    assert.equal((await markCurrentNotificationAsRead(1)).success, true);
    assert.equal(updates, 1, 'Idempotent read');
    const { markNotificationAsReadAction } = require('../lib/actions/notification.action.ts');
    await assert.rejects(() => markNotificationAsReadAction(2), /authorized/);
    assert.deepEqual(revalidated, [], 'Denied actions never report success or revalidate');
    await markNotificationAsReadAction(1);
    assert.equal(revalidated.length, 6, 'Existing history and dashboard revalidation retained');
    records[0].isRead = false;
    fail = true;
    assert.equal((await markAllCurrentNotificationsAsRead()).success, false);
    assert.equal(records[0].isRead, false);
    fail = false;
    const { markAllNotificationsAsReadAction } = require('../lib/actions/notification.action.ts');
    await markAllNotificationsAsReadAction();
    assert.equal(records[0].isRead, true);
    assert.equal(records[1].isRead, false, 'Mark all never modifies another recipient');
    assert.equal(revalidated.length, 12);
    assert.equal((await markAllCurrentNotificationsAsRead()).success, true, 'Bulk action is idempotent');
    session = null;
    await assert.rejects(getCurrentNotificationPreview(), /LOGIN_REDIRECT/);
    console.log('PASS notification four-role DTOs, active/current-role/unsupported/missing/anonymous denial, safe errors, ID validation, cross-recipient ownership and idempotent read; synthetic doubles');
})().catch(error => { console.error(error); process.exitCode = 1; });
