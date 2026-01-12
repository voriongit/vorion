# Story 002: File Upload and Document Processing

**Epic**: Enhanced Bot Capabilities
**Priority**: High
**Story Points**: 13
**Status**: Ready for Development

## User Story

**As a** user chatting with a bot
**I want** to upload files (documents, images, code) to the conversation
**So that** my bot can analyze, process, and discuss the content with me

## Acceptance Criteria

### AC1: File Upload UI
- [ ] Chat interface includes file upload button/dropzone
- [ ] Drag-and-drop file upload support
- [ ] File type validation (documents: PDF, DOCX, TXT, MD; images: PNG, JPG, WEBP; code: all text files)
- [ ] File size limits (10MB per file, configurable)
- [ ] Visual upload progress indicator
- [ ] Preview uploaded files before sending
- [ ] Multiple file upload support (max 5 files per message)

### AC2: File Storage
- [ ] Integrate Supabase Storage for file persistence
- [ ] Storage bucket: `conversation-files` with RLS policies
- [ ] File naming: `{user_id}/{conversation_id}/{timestamp}-{filename}`
- [ ] Automatic cleanup: Delete files when conversation deleted
- [ ] Generate signed URLs for secure access (1-hour expiry)

### AC3: File Processing Pipeline
- [ ] PDF parsing: Extract text content
- [ ] Image analysis: Claude vision API integration
- [ ] Code file processing: Syntax highlighting, language detection
- [ ] Document parsing: DOCX, markdown conversion to plain text
- [ ] Error handling for unsupported/corrupted files

### AC4: Message Attachment Schema
Database updates to `messages` table:
```sql
ALTER TABLE messages ADD COLUMN attachments JSONB DEFAULT '[]';
```

Attachments format:
```json
[{
  "id": "uuid",
  "name": "document.pdf",
  "type": "application/pdf",
  "size": 123456,
  "url": "storage-url",
  "extracted_text": "...",
  "metadata": {}
}]
```

### AC5: Chat API File Integration
- [ ] Accept file data in POST /api/chat
- [ ] Process files before sending to Claude
- [ ] For images: Use Claude vision capabilities
- [ ] For documents: Include extracted text in context
- [ ] Augment user message: "User uploaded {filename}: {content preview}"
- [ ] Store attachment metadata in messages table

### AC6: UI Display
- [ ] Display file attachments in message bubbles
- [ ] Clickable file names to download/view
- [ ] Image thumbnails in chat
- [ ] File metadata (size, type) displayed
- [ ] Loading states during file processing

## Technical Details

### New Dependencies
```json
{
  "@supabase/storage-js": "^2.5.5",
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0",  // DOCX parsing
  "file-type": "^18.7.0"
}
```

### Files to Create
1. **`lib/file-processor.ts`** - File processing utilities
2. **`lib/storage.ts`** - Supabase storage helpers
3. **`components/FileUpload.tsx`** - Upload component
4. **`components/FileAttachment.tsx`** - Display component
5. **`app/api/files/upload/route.ts`** - File upload endpoint
6. **`app/api/files/[id]/route.ts`** - File retrieval/deletion

### Files to Modify
1. **`app/api/chat/route.ts`** - Add file processing logic
2. **`supabase/schema.sql`** - Add attachments column
3. **`app/chat/page.tsx`** - Integrate file upload UI
4. **`supabase/migrations/`** - New migration for attachments

### Supabase Storage Setup
```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('conversation-files', 'conversation-files', false);

-- RLS Policies
CREATE POLICY "Users can upload files to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'conversation-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their conversation files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'conversation-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Implementation Phases

**Phase 1: Infrastructure**
- Set up Supabase storage bucket
- Add database migration for attachments column
- Install file processing dependencies

**Phase 2: Upload Flow**
- Build FileUpload component
- Create upload API endpoint
- Implement file validation and storage

**Phase 3: Processing**
- PDF text extraction
- Image processing with Claude vision
- Code file handling
- DOCX parsing

**Phase 4: Chat Integration**
- Modify chat API to accept files
- Process and include in Claude context
- Store attachments with messages

**Phase 5: Display**
- Build FileAttachment component
- Integrate into chat UI
- Download/preview functionality

## Dependencies
- Story 001 (MCP Integration) - Optional but recommended for filesystem MCP
- Supabase storage configuration

## Testing Notes
- Test each file type: PDF, DOCX, images, code files
- Test file size limits and validation
- Test concurrent file uploads
- Security: Verify RLS policies prevent cross-user access
- Performance: Test with large files (9-10MB)
- Error handling: Corrupt files, unsupported types
- Mobile: Test upload on mobile devices

## Security Considerations
- Validate file types on server (don't trust client MIME types)
- Virus scanning for uploaded files (future: integrate ClamAV)
- Signed URLs prevent unauthorized access
- Rate limiting on upload endpoint
- Storage quota per user (future)

## Performance Considerations
- Lazy load file previews in chat history
- Stream large file processing
- Compress images before storage
- Background job for expensive processing (PDFs, large docs)

## Definition of Done
- [ ] All acceptance criteria met
- [ ] File upload works for all supported types
- [ ] Storage and RLS policies configured
- [ ] Code reviewed
- [ ] Integration tests passing
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Deployed and tested in production

## Future Enhancements
- File search across conversations
- OCR for scanned documents
- Audio/video file support
- Collaborative file annotations
- File version history
