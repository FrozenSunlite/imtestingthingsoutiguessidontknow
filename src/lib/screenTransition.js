// One-second black fade used by main-menu section buttons. The action runs at
// the darkest point, then the overlay lifts over another second.
let state = { active: false, phase: "idle" };
const listeners = new Set();
let outTimer = 0;
let inTimer = 0;

const emit = () => listeners.forEach((listener) => listener());

export function subscribeScreenTransition(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getScreenTransition() {
  return state;
}

export function runScreenTransition(action, { outMs = 1000, inMs = 1000 } = {}) {
  if (state.active) return;
  clearTimeout(outTimer);
  clearTimeout(inTimer);
  state = { active: true, phase: "out" };
  emit();
  outTimer = setTimeout(() => {
    try {
      action?.();
    } catch (error) {
      console.error("Section transition action failed:", error);
    }
    state = { active: true, phase: "in" };
    emit();
    inTimer = setTimeout(() => {
      state = { active: false, phase: "idle" };
      emit();
    }, inMs);
  }, outMs);
}
