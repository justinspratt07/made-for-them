export class OwnerLoginLimit {
  private clients = new Map<string, number[]>();
  constructor(private now: () => number = Date.now) {}
  take(key: string) {
    const current = this.now();
    for (const [client, attempts] of this.clients) {
      const live = attempts.filter((time) => current - time < 15 * 60 * 1000);
      if (!live.length) this.clients.delete(client);
      else this.clients.set(client, live);
    }
    const state = this.clients.get(key);
    if (state) {
      if (state.length >= 10) return false;
      state.push(current);
    } else {
      // Never evict a live counter to grant a new attempt budget.
      if (this.clients.size >= 5000) return false;
      this.clients.set(key, [current]);
    }
    return true;
  }
  reset(key: string) { this.clients.delete(key); }
}
