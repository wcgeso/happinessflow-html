import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'HF-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export const findUserByInviteCode = async (
  code: string
): Promise<{ uid: string; name: string; role: string } | null> => {
  const q = query(collection(db, 'users'), where('inviteCode', '==', code.toUpperCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  return { uid: data.uid, name: data.name, role: data.role };
};

// 往上追鏈找到最近的執行師 UID
export const computeEffectiveCoachId = async (referredByUid: string): Promise<string | null> => {
  let currentUid: string | null = referredByUid;
  const visited = new Set<string>();

  while (currentUid && !visited.has(currentUid)) {
    visited.add(currentUid);
    const snap = await getDoc(doc(db, 'users', currentUid));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.role === 'coach' || data.role === 'gm') return currentUid;
    if (!data.referredBy) return null;
    currentUid = data.referredBy;
  }
  return null;
};

// 玩家升格執行師時，更新其直接下線的 effectiveCoachId
export const handlePromotionToCoach = async (newCoachUid: string): Promise<void> => {
  const directRefs = await getDirectReferrals(newCoachUid);
  await Promise.all(directRefs.map(uid => updateSubtreeEffectiveCoach(uid, newCoachUid)));
};

const getDirectReferrals = async (uid: string): Promise<string[]> => {
  const q = query(collection(db, 'users'), where('referredBy', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.id);
};

// 遞迴更新子樹的 effectiveCoachId，遇到執行師節點停止
const updateSubtreeEffectiveCoach = async (uid: string, coachUid: string): Promise<void> => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const data = snap.data();
  // 若該節點本身是執行師，停止（他有自己的子樹）
  if (data.role === 'coach' && uid !== coachUid) return;
  await updateDoc(doc(db, 'users', uid), { effectiveCoachId: coachUid });
  const children = await getDirectReferrals(uid);
  await Promise.all(children.map(childUid => updateSubtreeEffectiveCoach(childUid, coachUid)));
};
