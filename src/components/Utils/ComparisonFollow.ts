type FollowState = { manualUntil: number; followed: number };
export function followComparisonLine(state: FollowState, active: number, now: number, scroll: () => void): void {
  if (active < 0 || now <= state.manualUntil || state.followed === active) return;
  scroll();
  state.followed = active;
}
