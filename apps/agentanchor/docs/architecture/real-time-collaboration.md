# Real-Time Collaboration Architecture

**Version:** 1.0
**Last Updated:** 2025-11-23
**Architect:** BMAD Master Agent
**Status:** Design

---

## Executive Summary

This document defines the architecture for real-time multi-user collaboration in bot conversations, enabling teams to interact with AI assistants simultaneously with live updates.

**Key Goals:**
- Real-time message synchronization across users
- Presence awareness (who's online, typing indicators)
- Collaborative editing and annotations
- Scalable to 10-50 concurrent users per conversation
- Low latency: <100ms message propagation
- Graceful degradation when offline

---

## Architecture Overview

### Real-Time Communication Stack

```
┌─────────────────────────────────────────┐
│           Client Applications           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ User A  │  │ User B  │  │ User C  │ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
└───────┼────────────┼────────────┼───────┘
        │            │            │
        │   WebSocket Connections │
        │            │            │
┌───────▼────────────▼────────────▼───────┐
│         WebSocket Server (Vercel)       │
│              OR                          │
│         Supabase Realtime               │
└───────┬─────────────────────────────────┘
        │
        │ Subscribe to channels
        │
┌───────▼─────────────────────────────────┐
│      Presence & Message Broker          │
│   ┌──────────────────────────────┐      │
│   │  Redis (Upstash)             │      │
│   │  - Pub/Sub for messages      │      │
│   │  - Presence tracking         │      │
│   │  - Typing indicators         │      │
│   └──────────────────────────────┘      │
└───────┬─────────────────────────────────┘
        │
        │ Persist to database
        │
┌───────▼─────────────────────────────────┐
│         Supabase PostgreSQL             │
│   ┌──────────────────────────────┐      │
│   │  conversations, messages     │      │
│   │  collaboration_sessions      │      │
│   │  user_presence               │      │
│   └──────────────────────────────┘      │
└─────────────────────────────────────────┘
```

---

## Implementation Approaches

### Approach 1: Supabase Realtime (Recommended)

**Pros:**
- Already integrated with Supabase
- No additional infrastructure
- Built-in presence
- PostgreSQL change streams
- RLS policies apply

**Cons:**
- Tied to Supabase
- Limited customization
- Potential scaling limits

**Implementation:**

```typescript
// lib/realtime.ts
import { createClient } from '@supabase/supabase-js';

export class RealtimeCollaboration {
  private supabase;
  private channel;

  constructor(conversationId: string, userId: string) {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.channel = this.supabase.channel(`conversation:${conversationId}`);
  }

  async join(userData: { name: string; avatar?: string }) {
    // Track presence
    await this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState();
        this.onPresenceChange(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.onUserJoin(newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this.onUserLeave(leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track(userData);
        }
      });

    // Listen for new messages
    this.channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        this.onNewMessage(payload.new);
      }
    );

    // Listen for typing indicators
    this.channel.on('broadcast', { event: 'typing' }, (payload) => {
      this.onTyping(payload);
    });

    return this.channel;
  }

  async sendTypingIndicator(isTyping: boolean) {
    await this.channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { isTyping },
    });
  }

  async leave() {
    await this.channel.untrack();
    await this.channel.unsubscribe();
  }

  // Callbacks (to be overridden)
  onPresenceChange(state: any) {}
  onUserJoin(users: any[]) {}
  onUserLeave(users: any[]) {}
  onNewMessage(message: any) {}
  onTyping(payload: any) {}
}
```

**Client Usage:**

```typescript
// app/chat/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { RealtimeCollaboration } from '@/lib/realtime';

export default function ChatPage({ conversationId, userId }: Props) {
  const [collaboration, setCollaboration] = useState<RealtimeCollaboration>();
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const collab = new RealtimeCollaboration(conversationId, userId);

    collab.onPresenceChange = (state) => {
      const users = Object.values(state).flat();
      setActiveUsers(users);
    };

    collab.onNewMessage = (message) => {
      // Add message to UI
      addMessageToChat(message);
    };

    collab.onTyping = (payload) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (payload.isTyping) {
          next.add(payload.userId);
        } else {
          next.delete(payload.userId);
        }
        return next;
      });
    };

    collab.join({ name: 'Current User' });
    setCollaboration(collab);

    return () => {
      collab.leave();
    };
  }, [conversationId, userId]);

  const handleTyping = () => {
    collaboration?.sendTypingIndicator(true);
    // Debounce and send false after 2s
  };

  return (
    <div>
      <ActiveUsers users={activeUsers} />
      <ChatMessages typing={typingUsers} />
      <MessageInput onTyping={handleTyping} />
    </div>
  );
}
```

---

### Approach 2: Custom WebSocket Server

**Pros:**
- Full control
- Custom protocols
- Advanced features
- Better performance

**Cons:**
- More infrastructure
- Maintenance burden
- Vercel serverless limitations

**Implementation (Next.js API Route + ws):**

```typescript
// app/api/ws/route.ts
import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';

// Note: Vercel doesn't support long-running WebSocket connections
// This would require deployment to a platform like Railway, Render, or AWS

const wss = new WebSocketServer({ noServer: true });

interface Client {
  ws: WebSocket;
  userId: string;
  conversationId: string;
  metadata: {
    name: string;
    avatar?: string;
  };
}

const clients = new Map<string, Client>();

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const conversationId = url.searchParams.get('conversationId');
  const userId = url.searchParams.get('userId');

  if (!conversationId || !userId) {
    ws.close(1008, 'Missing conversationId or userId');
    return;
  }

  const clientId = `${conversationId}:${userId}`;
  const client: Client = {
    ws,
    userId,
    conversationId,
    metadata: { name: 'User' },
  };

  clients.set(clientId, client);

  // Broadcast user joined
  broadcast(conversationId, {
    type: 'user_joined',
    userId,
  });

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(client, message);
    } catch (error) {
      console.error('Invalid message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    broadcast(conversationId, {
      type: 'user_left',
      userId,
    });
  });
});

function handleMessage(client: Client, message: any) {
  switch (message.type) {
    case 'typing':
      broadcast(client.conversationId, {
        type: 'typing',
        userId: client.userId,
        isTyping: message.isTyping,
      }, client.userId); // Exclude sender
      break;

    case 'message':
      // Save to database and broadcast
      saveMessage(message).then((saved) => {
        broadcast(client.conversationId, {
          type: 'new_message',
          message: saved,
        });
      });
      break;

    case 'cursor':
      // Collaborative cursor position
      broadcast(client.conversationId, {
        type: 'cursor',
        userId: client.userId,
        position: message.position,
      }, client.userId);
      break;
  }
}

function broadcast(
  conversationId: string,
  message: any,
  excludeUserId?: string
) {
  const payload = JSON.stringify(message);

  for (const [clientId, client] of clients.entries()) {
    if (client.conversationId === conversationId &&
        client.userId !== excludeUserId) {
      client.ws.send(payload);
    }
  }
}

async function saveMessage(message: any) {
  // Save to Supabase
  // Return saved message
}
```

**Recommendation**: Use Supabase Realtime for initial implementation, migrate to custom WebSocket server if advanced features needed.

---

## Database Schema

### Collaboration Sessions

```sql
CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  participant_count INTEGER DEFAULT 0,
  UNIQUE(conversation_id)
);

CREATE INDEX idx_collab_sessions_conversation ON collaboration_sessions(conversation_id);
```

### User Presence

```sql
CREATE TABLE user_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'online', -- online, away, offline
  last_seen TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}', -- cursor position, etc.
  UNIQUE(user_id, conversation_id)
);

CREATE INDEX idx_presence_conversation ON user_presence(conversation_id);
CREATE INDEX idx_presence_user ON user_presence(user_id);

-- Auto-update last_seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_last_seen
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_last_seen();
```

### Message Reactions (Collaborative Feature)

```sql
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reaction VARCHAR(50), -- emoji or reaction type
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);
```

---

## UI Components

### Active Users Display

```tsx
// components/ActiveUsers.tsx
interface User {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
}

export function ActiveUsers({ users }: { users: User[] }) {
  return (
    <div className="flex items-center gap-2 p-2 border-b">
      <span className="text-sm text-gray-600">Active:</span>
      <div className="flex -space-x-2">
        {users.map(user => (
          <div
            key={user.id}
            className="relative"
            title={user.name}
          >
            <img
              src={user.avatar || '/default-avatar.png'}
              alt={user.name}
              className="w-8 h-8 rounded-full border-2 border-white"
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
              }`}
            />
          </div>
        ))}
      </div>
      <span className="text-xs text-gray-500">{users.length} online</span>
    </div>
  );
}
```

### Typing Indicator

```tsx
// components/TypingIndicator.tsx
export function TypingIndicator({ users }: { users: string[] }) {
  if (users.length === 0) return null;

  const text = users.length === 1
    ? `${users[0]} is typing...`
    : users.length === 2
    ? `${users[0]} and ${users[1]} are typing...`
    : `${users.length} people are typing...`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{text}</span>
    </div>
  );
}
```

### Message Reactions

```tsx
// components/MessageReactions.tsx
interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  userReacted: boolean;
}

export function MessageReactions({
  reactions,
  onReact,
}: {
  reactions: Reaction[];
  onReact: (emoji: string) => void;
}) {
  return (
    <div className="flex gap-1 mt-1">
      {reactions.map(reaction => (
        <button
          key={reaction.emoji}
          onClick={() => onReact(reaction.emoji)}
          className={`px-2 py-1 text-sm rounded-full border ${
            reaction.userReacted
              ? 'bg-blue-100 border-blue-500'
              : 'bg-gray-100 border-gray-300'
          }`}
          title={reaction.users.join(', ')}
        >
          {reaction.emoji} {reaction.count}
        </button>
      ))}
      <button
        onClick={() => {/* Open emoji picker */}}
        className="px-2 py-1 text-sm rounded-full border border-gray-300 hover:bg-gray-100"
      >
        +
      </button>
    </div>
  );
}
```

---

## Conflict Resolution

### Optimistic Updates

```typescript
class OptimisticMessageManager {
  private pendingMessages = new Map<string, Message>();

  async sendMessage(tempId: string, message: Message) {
    // Add to UI immediately
    this.pendingMessages.set(tempId, message);
    this.renderMessage(message);

    try {
      // Send to server
      const saved = await api.sendMessage(message);

      // Replace temp with real
      this.pendingMessages.delete(tempId);
      this.updateMessage(tempId, saved);
    } catch (error) {
      // Show error, allow retry
      this.markMessageFailed(tempId);
    }
  }

  onServerMessage(message: Message) {
    // Check if we already have this (from another user)
    if (!this.pendingMessages.has(message.id)) {
      this.renderMessage(message);
    }
  }
}
```

### Concurrent Editing

For collaborative editing of shared documents:

```typescript
// Use Operational Transformation or CRDTs
import { Y } from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  'conversation-123',
  ydoc
);

const ytext = ydoc.getText('shared-notes');

// Bind to editor
ytext.observe(event => {
  // Update editor with changes
});
```

---

## Performance & Scalability

### Connection Management

```typescript
// Heartbeat to detect disconnections
setInterval(() => {
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.ping();
    } else {
      // Clean up dead connection
      clients.delete(client.id);
    }
  }
}, 30000); // Every 30s
```

### Message Throttling

```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 messages per 10s
});

async function handleMessage(client: Client, message: any) {
  const { success } = await ratelimit.limit(client.userId);

  if (!success) {
    client.ws.send(JSON.stringify({
      type: 'error',
      message: 'Rate limit exceeded',
    }));
    return;
  }

  // Process message...
}
```

### Scaling Considerations

1. **Horizontal Scaling**: Use Redis Pub/Sub to sync across multiple WebSocket servers
2. **Message Buffering**: Queue messages in Redis for reliability
3. **Connection Limits**: Limit concurrent connections per conversation (e.g., 50)
4. **Auto-cleanup**: Remove inactive sessions after 30 minutes

---

## Offline Support

```typescript
// Service Worker for offline queueing
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/messages')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Queue for later
        return queueMessage(event.request);
      })
    );
  }
});

// Sync when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(sendQueuedMessages());
  }
});
```

---

## Security Considerations

1. **Authentication**: Verify WebSocket connections with JWT
2. **Authorization**: Check user has access to conversation
3. **Rate Limiting**: Prevent message spam
4. **Input Validation**: Sanitize all user inputs
5. **Encryption**: Use WSS (WebSocket Secure)

---

## Monitoring & Debugging

**Metrics to Track:**
- Active WebSocket connections
- Message latency (send to receive)
- Connection failures
- Presence updates per second
- Messages per conversation

**Debugging Tools:**
- WebSocket connection logs
- Message trace IDs
- User action replays

---

## Testing Strategy

1. **Unit Tests**: Message handling, presence logic
2. **Integration Tests**: Full collaboration flow
3. **Load Tests**: 50+ concurrent users
4. **Network Tests**: Simulate disconnections, latency
5. **Concurrency Tests**: Multiple users typing simultaneously

---

## Future Enhancements

1. **Voice/Video**: WebRTC integration for calls
2. **Screen Sharing**: Collaborative screen sharing
3. **Co-editing**: Real-time document editing
4. **Annotations**: Annotate messages/files together
5. **Playback**: Replay conversation history
