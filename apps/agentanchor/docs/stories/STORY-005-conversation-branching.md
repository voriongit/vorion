# Story 005: Conversation Branching & History Management

**Epic**: Enhanced Bot Capabilities
**Priority**: Medium
**Story Points**: 8
**Status**: Ready for Development

## User Story

**As a** user having complex conversations with bots
**I want** to branch conversations from any point and explore different paths
**So that** I can experiment with different approaches without losing my conversation history

## Background

Currently, conversations are linear. Users often want to:
- Try different questions or approaches from a specific point
- Explore "what-if" scenarios
- Keep multiple solution paths for comparison
- Recover from mistakes without starting over

## Acceptance Criteria

### AC1: Branch Creation
- [ ] "Branch conversation" button on each message
- [ ] Creates new conversation starting from selected message
- [ ] Copies all messages up to branch point
- [ ] Original conversation remains unchanged
- [ ] Visual indicator showing branch relationship

### AC2: Branch Visualization
- [ ] Conversation list shows parent-child relationships
- [ ] Tree view or graph view of conversation branches
- [ ] Visual distinction between main and branched conversations
- [ ] Branch metadata: created from message X, timestamp
- [ ] Navigate between related branches easily

### AC3: Database Schema

**New table: `conversation_branches`**
```sql
CREATE TABLE conversation_branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  parent_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  branch_point_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id)
);

CREATE INDEX idx_branches_parent ON conversation_branches(parent_conversation_id);
CREATE INDEX idx_branches_conversation ON conversation_branches(conversation_id);
```

**Add column to `conversations`:**
```sql
ALTER TABLE conversations ADD COLUMN is_branch BOOLEAN DEFAULT FALSE;
```

### AC4: Branch API Endpoints

**POST /api/conversations/[id]/branch**
- Request: `{ messageId: string, newTitle?: string }`
- Creates branch from specified message
- Returns new conversation ID
- Response: `{ success: boolean, branchId: string }`

**GET /api/conversations/[id]/branches**
- Returns all branches of a conversation
- Includes branch metadata and preview
- Response: `{ branches: Array<Branch> }`

**GET /api/conversations/[id]/tree**
- Returns full conversation tree (parent + all descendants)
- Useful for visualization
- Response: `{ tree: ConversationTree }`

### AC5: Branch UI Components

**Branch Button:**
- [ ] Hover on message shows "Branch from here" action
- [ ] Click opens branch dialog
- [ ] Dialog shows preview of messages to copy
- [ ] Option to customize new branch title
- [ ] Confirmation before creating branch

**Branch Navigation:**
- [ ] Breadcrumb showing: Root > Branch 1 > Branch 2
- [ ] "View branches" panel in conversation view
- [ ] Quick switch between branches
- [ ] Visual tree diagram (optional, future enhancement)

**Conversation List:**
- [ ] Indent branched conversations
- [ ] Show branch icon and parent link
- [ ] Filter: Show only root conversations or all

### AC6: Message Copying
- [ ] When branching, copy messages up to branch point
- [ ] Deep copy: Create new message records (don't reference originals)
- [ ] Preserve message order, timestamps, attachments
- [ ] Copy bot_id for assistant messages
- [ ] Generate new UUIDs for copied messages

### AC7: Branch Limits & Cleanup
- [ ] Max branch depth: 5 levels (prevent excessive nesting)
- [ ] Max branches per conversation: 20
- [ ] Display warning when approaching limits
- [ ] Delete cascade: Deleting parent deletes all child branches (optional)
- [ ] Orphan cleanup: Handle deleted parent conversations

## Technical Details

### Files to Create
1. **`lib/conversation-branching.ts`** - Branch logic utilities
2. **`app/api/conversations/[id]/branch/route.ts`** - Branch creation endpoint
3. **`app/api/conversations/[id]/branches/route.ts`** - List branches
4. **`app/api/conversations/[id]/tree/route.ts`** - Get conversation tree
5. **`components/BranchButton.tsx`** - Branch action button
6. **`components/BranchNavigator.tsx`** - Branch navigation UI
7. **`components/ConversationTree.tsx`** - Visual tree diagram (future)
8. **`supabase/migrations/add_conversation_branching.sql`** - Schema migration

### Files to Modify
1. **`app/chat/page.tsx`** - Add branch UI elements
2. **`app/conversations/page.tsx`** - Show branch relationships
3. **`components/ChatMessage.tsx`** - Add branch button
4. **`lib/types.ts`** - Add Branch types

### TypeScript Types

```typescript
interface Branch {
  id: string;
  conversationId: string;
  parentConversationId: string | null;
  branchPointMessageId: string | null;
  title: string;
  messageCount: number;
  createdAt: string;
  depth: number; // How many levels deep in branch tree
}

interface ConversationTree {
  conversation: Conversation;
  branches: ConversationTree[];
  branchPoint?: Message;
}
```

### Branch Creation Logic

**`lib/conversation-branching.ts`:**
```typescript
import { createClient } from '@supabase/supabase-js';

export async function createBranch(
  supabase: any,
  userId: string,
  parentConversationId: string,
  branchPointMessageId: string,
  newTitle?: string
): Promise<string> {
  // 1. Verify user owns parent conversation
  const { data: parent } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', parentConversationId)
    .eq('user_id', userId)
    .single();

  if (!parent) throw new Error('Parent conversation not found');

  // 2. Check branch depth limit
  const depth = await getBranchDepth(supabase, parentConversationId);
  if (depth >= 5) throw new Error('Maximum branch depth reached');

  // 3. Get messages up to branch point
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', parentConversationId)
    .order('created_at', { ascending: true });

  const branchPointIndex = messages.findIndex(
    (m: any) => m.id === branchPointMessageId
  );
  const messagesToCopy = messages.slice(0, branchPointIndex + 1);

  // 4. Create new conversation
  const { data: newConversation } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      bot_id: parent.bot_id,
      team_id: parent.team_id,
      title: newTitle || `${parent.title} (branch)`,
      is_branch: true,
    })
    .select()
    .single();

  // 5. Copy messages
  const copiedMessages = messagesToCopy.map((m: any) => ({
    conversation_id: newConversation.id,
    role: m.role,
    content: m.content,
    bot_id: m.bot_id,
    attachments: m.attachments,
  }));

  await supabase.from('messages').insert(copiedMessages);

  // 6. Create branch record
  await supabase.from('conversation_branches').insert({
    conversation_id: newConversation.id,
    parent_conversation_id: parentConversationId,
    branch_point_message_id: branchPointMessageId,
  });

  return newConversation.id;
}

async function getBranchDepth(
  supabase: any,
  conversationId: string
): Promise<number> {
  let depth = 0;
  let currentId = conversationId;

  while (currentId) {
    const { data: branch } = await supabase
      .from('conversation_branches')
      .select('parent_conversation_id')
      .eq('conversation_id', currentId)
      .single();

    if (!branch?.parent_conversation_id) break;

    depth++;
    currentId = branch.parent_conversation_id;
  }

  return depth;
}
```

## Implementation Phases

**Phase 1: Database Schema**
- Create migration for branches table
- Add is_branch column
- Test migrations

**Phase 2: Backend Logic**
- Implement branch creation logic
- Create API endpoints
- Add branch query functions

**Phase 3: Basic UI**
- Add branch button to messages
- Implement branch dialog
- Basic branch list view

**Phase 4: Navigation**
- Build breadcrumb navigation
- Branch switcher component
- Enhanced conversation list

**Phase 5: Advanced Features**
- Branch comparison view (future)
- Merge branches (future)
- Visual tree diagram (future)

## Dependencies
- None (independent feature)

## Testing Notes
- Test branch creation at various message points
- Verify message copying is complete and accurate
- Test max depth enforcement (5 levels)
- Test orphan handling (deleted parent)
- Performance: Test with conversations having 100+ messages
- Security: Verify users can only branch their own conversations
- Edge case: Branch from first message (should create copy)
- Edge case: Branch from last message (should work)

## UX Considerations
- Don't overwhelm users with too many branches
- Make branch relationships clear visually
- Prevent accidental branch creation
- Easy way to "flatten" or merge branches back (future)
- Mobile: Ensure branch UI works on small screens

## Performance Considerations
- Copying 100+ messages could be slow
- Use database transactions for atomicity
- Background job for large conversations (future)
- Index on conversation_branches for fast lookups
- Lazy load branch tree (don't load all upfront)

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Database migration created and tested
- [ ] Branch creation API working
- [ ] UI components built and integrated
- [ ] Branch navigation functional
- [ ] Limits enforced (depth, count)
- [ ] Code reviewed
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] User guide created

## Future Enhancements
- **Branch Comparison**: Side-by-side view of different branches
- **Merge Branches**: Combine insights from multiple branches
- **Branch Templates**: Save common branch patterns
- **Collaborative Branching**: Share branches with team members
- **Branch Analytics**: Which branches led to best outcomes
- **Auto-branching**: AI suggests good branch points
- **Branch Export**: Export specific branch as standalone conversation
