# Story 001: Complete MCP Server Integration

**Epic**: Core Platform Enhancement
**Priority**: High
**Story Points**: 8
**Status**: Ready for Development

## User Story

**As a** bot creator
**I want** to configure and attach MCP servers to my bots
**So that** my bots can access external capabilities like filesystem, GitHub, databases, and web search

## Acceptance Criteria

### AC1: MCP Server Creation UI
- [ ] Users can navigate to `/mcp/new` to create a new MCP server
- [ ] Form includes fields: name, type (dropdown), description, configuration (JSON editor)
- [ ] Configuration schema validation based on selected type
- [ ] Success message and redirect to MCP list after creation
- [ ] Error handling with user-friendly messages

### AC2: MCP Server Management
- [ ] List view at `/mcp` shows all user's MCP servers
- [ ] Each server displays: name, type, status, bots using it
- [ ] Edit and delete actions available
- [ ] Delete confirmation dialog
- [ ] Cascade delete or warning if server is in use by bots

### AC3: Bot-MCP Association
- [ ] Bot creation/edit form includes MCP server selector
- [ ] Multi-select interface for choosing multiple MCP servers
- [ ] Display selected servers with permissions configuration
- [ ] Save associations to `bot_mcp_servers` table
- [ ] Visual indicator on bot cards showing MCP integrations

### AC4: Runtime MCP Context Injection
- [ ] Chat API loads associated MCP servers for bot
- [ ] System prompt augmented using `getBMADEnhancedPrompt()` from `lib/bmad-mcp-config.ts`
- [ ] MCP capabilities clearly described in bot's context
- [ ] Performance: Cache MCP configurations (reduce DB queries)

### AC5: MCP Server Types Implementation

**Filesystem MCP:**
- [ ] Configuration: `allowed_directories`, `read_only`, `auto_create_output`
- [ ] Validation: Ensure paths are safe (no `..` traversal)
- [ ] Context injection includes accessible directories

**GitHub MCP:**
- [ ] Configuration: `default_branch`, `auto_commit`, `commit_message_prefix`
- [ ] Requires GitHub token in config
- [ ] Secure token storage (encrypted in database)

**Database MCP:**
- [ ] Configuration: `connection_string`, `read_only`, `allowed_tables`
- [ ] Support PostgreSQL initially
- [ ] Connection pooling configuration

**Web Search MCP:**
- [ ] Configuration: `search_provider` (Google, Bing, DuckDuckGo)
- [ ] API key configuration
- [ ] Rate limit settings

## Technical Details

### Database Changes
No schema changes needed - tables already exist:
- `mcp_servers` (lib/orchestrator-config.ts references)
- `bot_mcp_servers` (junction table)

### Files to Modify
1. **`app/mcp/page.tsx`** - MCP list view (create new file)
2. **`app/mcp/new/page.tsx`** - MCP creation form (create new file)
3. **`app/mcp/[id]/page.tsx`** - MCP detail/edit (create new file)
4. **`app/api/mcp/route.ts`** - GET (list) and POST (create) endpoints
5. **`app/api/mcp/[id]/route.ts`** - GET, PUT, DELETE for single MCP
6. **`app/bots/new/page.tsx`** - Add MCP selector (modify existing)
7. **`app/bots/[id]/page.tsx`** - Add MCP management (modify existing)
8. **`app/api/chat/route.ts`** - Replace basic MCP context with `getBMADEnhancedPrompt()` (line 68-77)

### Implementation Approach
1. Start with UI for MCP server creation
2. Implement API endpoints with validation
3. Add bot-MCP association UI
4. Enhance chat API with proper MCP context injection
5. Add comprehensive error handling
6. Write tests for each MCP type

## Dependencies
- None (all tables and libraries already in place)

## Testing Notes
- Test each MCP type configuration
- Verify secure storage of API keys/tokens
- Test permission boundaries (users can only see their own MCPs)
- Integration test: Create bot → Attach MCP → Chat → Verify context
- Security test: Path traversal prevention for filesystem MCP

## Definition of Done
- [ ] All acceptance criteria met
- [ ] Code reviewed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Deployed to staging and tested
- [ ] Product owner approval

## Notes
- Consider implementing MCP marketplace in future (users share public MCPs)
- MCP servers are currently defined but context injection is minimal
- BMAD integration already has comprehensive MCP config templates we can leverage
