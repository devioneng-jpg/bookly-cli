class MemoryStore {
  constructor() {
    this.interactions = [];
  }

  add(role, content, conversationId = null) {
    const entry = {
      id: this.interactions.length,
      role,
      content,
      conversationId,
      timestamp: Date.now(),
    };
    this.interactions.push(entry);
    return entry;
  }

  getAll() {
    return this.interactions;
  }

  getRecent(count = 10) {
    return this.interactions.slice(-count);
  }

  getById(id) {
    return this.interactions.find((entry) => entry.id === id);
  }

  findByRole(role) {
    return this.interactions.filter((entry) => entry.role === role);
  }

  findByConversation(conversationId) {
    return this.interactions.filter(
      (entry) => entry.conversationId === conversationId,
    );
  }

  clear() {
    this.interactions = [];
  }

  get size() {
    return this.interactions.length;
  }
}

const memory = new MemoryStore();

export default memory;
