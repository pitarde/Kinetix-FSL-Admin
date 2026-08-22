import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

// The public `users/{uid}` profiles (world-readable) — avatar, banner, bio-ish
// counts. The analytics come from `progress/{uid}`, which carries no avatar, so
// the Users screen merges this in to show each learner's real profile picture
// and a background (followers, communities joined, account age).

export function subscribeUserProfiles(onData, onError) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const map = {}
      snap.docs.forEach((d) => {
        const p = d.data()
        map[d.id] = {
          uid: d.id,
          displayName: p.displayName || '',
          avatarUrl: p.avatarUrl || null,
          bannerUrl: p.bannerUrl || null,
          followerCount: Number(p.followerCount) || 0,
          followingCount: Number(p.followingCount) || 0,
          joinedCommunityIds: Array.isArray(p.joinedCommunityIds) ? p.joinedCommunityIds : [],
          createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : null,
          lastActiveAt: p.lastActiveAt?.toDate ? p.lastActiveAt.toDate() : null,
        }
      })
      onData(map)
    },
    (err) => onError?.(err),
  )
}
