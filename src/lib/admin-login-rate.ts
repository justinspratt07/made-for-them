export class OwnerLoginLimit {
  private attempts: number[] = [];
  constructor(private now: () => number = Date.now) {}
  take() {
    const current = this.now();
    this.attempts = this.attempts.filter((time) => current - time < 15 * 60 * 1000);
    if (this.attempts.length >= 10) return false;
    this.attempts.push(current);
    return true;
  }
  reset() { this.attempts = []; }
}
