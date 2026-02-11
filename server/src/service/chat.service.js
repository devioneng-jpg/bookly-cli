import memory from '../memory.js';

let conversationCounter = 0;

export class ChatService {
  /**
   * @param {string} userId
   * @param {string} mode
   * @param {string} title
   */
  createConversation(userId, mode = 'chat', title = null) {
    conversationCounter++;
    const conversation = {
      id: `conv_${conversationCounter}_${Date.now()}`,
      userId,
      mode,
      title: title || `New ${mode} conversation`,
      createdAt: Date.now(),
      messages: [],
    };

    memory.add('system', JSON.stringify(conversation));
    return conversation;
  }

  /**
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} mode
   */
  getOrCreateConversation(userId, conversationId = null, mode = 'chat') {
    if (conversationId) {
      const existing = this.getConversationById(conversationId);
      if (existing) return existing;
    }
    return this.createConversation(userId, mode);
  }

  getConversationById(conversationId) {
    const systems = memory.findByRole('system');
    for (const entry of systems) {
      try {
        const data = JSON.parse(entry.content);
        if (data.id === conversationId) {
          return data;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  addMessage(conversationId, role, content) {
    return memory.add(role, content);
  }

  getMessages(conversationId) {
    return memory
      .getAll()
      .filter((e) => e.role === 'user' || e.role === 'assistant');
  }

  getRecentMessages(count = 10) {
    return memory.getRecent(count);
  }

  formatMessagesForAI(messages) {
    return messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
      }));
  }

  updateTitle(conversationId, title) {
    const systems = memory.findByRole('system');
    for (const entry of systems) {
      try {
        const data = JSON.parse(entry.content);
        if (data.id === conversationId) {
          data.title = title;
          entry.content = JSON.stringify(data);
          return data;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  getUserConversations(userId) {
    const systems = memory.findByRole('system');
    const conversations = [];
    for (const entry of systems) {
      try {
        const data = JSON.parse(entry.content);
        if (data.userId === userId) {
          conversations.push(data);
        }
      } catch {
        continue;
      }
    }
    return conversations;
  }
}
